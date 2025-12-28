import { useEffect, useState, useRef } from "preact/hooks";
import styles from "./ElevationProfile.module.css";

interface ElevationPoint {
  lon: number;
  lat: number;
  ele: number;
  distance: number;
}

interface TrackData {
  name: string;
  points: ElevationPoint[];
  totalDistance: number;
  elevationGain: number;
  minEle: number;
  maxEle: number;
}

interface Props {
  gpxUrls: string[];
  mapContainerId: string;
}

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/*
 * Layout constants - these define the chart geometry.
 * The SVG viewBox uses these values, and CSS custom properties mirror them.
 *
 * viewBoxHeight (100) = the elevation data area
 * viewBoxExtension (25) = extra space below for the "lie" that covers axis text
 * viewBoxExtended (125) = total viewBox height
 *
 * The ratio viewBoxHeight/viewBoxExtended (80%) determines where:
 * - The elevation floor line sits (yAxisMin border-top)
 * - The hover line ends
 * - The xAxisEnd label aligns
 */
const VIEW_BOX_WIDTH = 100;
const VIEW_BOX_HEIGHT = 100; // Elevation data area
const VIEW_BOX_EXTENSION = 25; // Extra space below for text coverage
const VIEW_BOX_EXTENDED = VIEW_BOX_HEIGHT + VIEW_BOX_EXTENSION; // 125
const ELEVATION_RATIO = VIEW_BOX_HEIGHT / VIEW_BOX_EXTENDED; // 0.8 (80%)

export default function ElevationProfile({ gpxUrls, mapContainerId }: Props) {
  const [tracks, setTracks] = useState<TrackData[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadAllGpx() {
      const loadedTracks: TrackData[] = [];

      for (let i = 0; i < gpxUrls.length; i++) {
        try {
          const response = await fetch(gpxUrls[i]);
          const gpxText = await response.text();
          const parser = new DOMParser();
          const gpxDoc = parser.parseFromString(gpxText, "text/xml");

          // Try to get track name from GPX
          const nameNode = gpxDoc.querySelector("trk > name") || gpxDoc.querySelector("metadata > name");
          const trackName = nameNode?.textContent || `Track ${i + 1}`;

          const trackPoints: ElevationPoint[] = [];
          let cumulativeDistance = 0;

          const segments = gpxDoc.querySelectorAll("trkseg");
          segments.forEach((seg, segIndex) => {
            const pts = seg.querySelectorAll("trkpt");
            pts.forEach((pt, ptIndex) => {
              const lat = parseFloat(pt.getAttribute("lat") || "0");
              const lon = parseFloat(pt.getAttribute("lon") || "0");
              const eleNode = pt.querySelector("ele");
              const ele = eleNode ? parseFloat(eleNode.textContent || "0") : 0;

              if (segIndex > 0 && ptIndex === 0) {
                // New segment - don't add distance from previous segment
              } else if (trackPoints.length > 0) {
                const prev = trackPoints[trackPoints.length - 1];
                cumulativeDistance += haversineDistance(
                  prev.lat,
                  prev.lon,
                  lat,
                  lon
                );
              }

              trackPoints.push({ lon, lat, ele, distance: cumulativeDistance });
            });
          });

          if (trackPoints.length > 0) {
            const elevations = trackPoints.map((p) => p.ele);
            const minEle = Math.min(...elevations);
            const maxEle = Math.max(...elevations);
            const totalDistance = trackPoints[trackPoints.length - 1].distance;

            let elevationGain = 0;
            for (let j = 1; j < trackPoints.length; j++) {
              const diff = trackPoints[j].ele - trackPoints[j - 1].ele;
              if (diff > 0) elevationGain += diff;
            }

            loadedTracks.push({
              name: trackName,
              points: trackPoints,
              totalDistance,
              elevationGain,
              minEle,
              maxEle,
            });
          }
        } catch (error) {
          console.error(`Error loading GPX ${gpxUrls[i]}:`, error);
        }
      }

      setTracks(loadedTracks);
    }

    loadAllGpx();
  }, [gpxUrls]);

  useEffect(() => {
    const track = tracks[selectedIndex];
    const event = new CustomEvent("elevation-hover", {
      detail:
        hoverIndex !== null && track
          ? { lon: track.points[hoverIndex].lon, lat: track.points[hoverIndex].lat }
          : null,
    });
    document.getElementById(mapContainerId)?.dispatchEvent(event);
  }, [hoverIndex, tracks, selectedIndex, mapContainerId]);

  if (tracks.length === 0) return null;

  const track = tracks[selectedIndex];
  const { points, totalDistance, elevationGain, minEle, maxEle } = track;
  const eleRange = maxEle - minEle || 1;

  const pathD = points
    .map((p, i) => {
      const x = (p.distance / totalDistance) * VIEW_BOX_WIDTH;
      const y =
        VIEW_BOX_HEIGHT - ((p.ele - minEle) / eleRange) * VIEW_BOX_HEIGHT;
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  // Area fill extends to the bottom of the extended viewBox
  const areaD = `${pathD} L ${VIEW_BOX_WIDTH} ${VIEW_BOX_EXTENDED} L 0 ${VIEW_BOX_EXTENDED} Z`;

  // Shared handler for both mouse and touch - finds closest point to X position
  const updateHoverFromClientX = (clientX: number) => {
    if (!chartRef.current) return;
    const rect = chartRef.current.getBoundingClientRect();
    const relX = (clientX - rect.left) / rect.width;

    if (relX < 0 || relX > 1) {
      setHoverIndex(null);
      return;
    }

    const targetDistance = relX * totalDistance;
    let closest = 0;
    let minDiff = Infinity;
    for (let i = 0; i < points.length; i++) {
      const diff = Math.abs(points[i].distance - targetDistance);
      if (diff < minDiff) {
        minDiff = diff;
        closest = i;
      }
    }
    setHoverIndex(closest);
  };

  const handleMouseMove = (e: MouseEvent) => {
    updateHoverFromClientX(e.clientX);
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  // Touch handlers for mobile scrubbing
  const handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 1) {
      updateHoverFromClientX(e.touches[0].clientX);
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (e.touches.length === 1) {
      e.preventDefault(); // Prevent scrolling while scrubbing
      updateHoverFromClientX(e.touches[0].clientX);
    }
  };

  const handleTouchEnd = () => {
    setHoverIndex(null);
  };

  const hoverPercent =
    hoverIndex !== null
      ? (points[hoverIndex].distance / totalDistance) * 100
      : 0;
  const hoverYPercent =
    hoverIndex !== null
      ? (1 - (points[hoverIndex].ele - minEle) / eleRange) * 100
      : 0;

  // Clamp label position so text stays inside chart bounds
  // Labels are ~40px wide, need ~20px clearance. At 600px chart width, that's ~3%
  const labelPercent = Math.max(2, Math.min(98, hoverPercent));

  // CSS custom properties for the chart geometry (keeps CSS in sync with JS constants)
  const chartStyle = {
    "--elevation-ratio": ELEVATION_RATIO,
  } as React.CSSProperties;

  return (
    <div class={styles.container}>
      <div
        ref={chartRef}
        class={styles.chartArea}
        style={chartStyle}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <span class={styles.yAxisMax}>{Math.round(maxEle)}m</span>
        <span class={styles.yAxisMin}>{Math.round(minEle)}m</span>
        <span class={styles.xAxisEnd}>
          {(totalDistance / 1000).toFixed(1)}km
        </span>

        <svg
          class={styles.chart}
          viewBox={`0 0 ${VIEW_BOX_WIDTH} ${VIEW_BOX_EXTENDED}`}
          preserveAspectRatio="none"
        >
          <path d={areaD} fill="rgba(255, 0, 0, 0.15)" />
          <path
            d={pathD}
            fill="none"
            stroke="#ff0000"
            stroke-width="2"
            vector-effect="non-scaling-stroke"
          />
        </svg>

        {hoverIndex !== null && (
          <>
            <div class={styles.hoverLine} style={{ left: `${hoverPercent}%` }}>
              <span
                class={styles.hoverDot}
                style={{ top: `${hoverYPercent}%` }}
              />
            </div>
            <span class={styles.hoverEle} style={{ left: `${labelPercent}%` }}>
              {Math.round(points[hoverIndex].ele)}m
            </span>
            <span class={styles.hoverDist} style={{ left: `${labelPercent}%` }}>
              {(points[hoverIndex].distance / 1000).toFixed(1)}km
            </span>
          </>
        )}
      </div>

      <div class={styles.stats}>
        <span>Distance: {(totalDistance / 1000).toFixed(2)} km</span>
        <span>Elevation gain: {Math.round(elevationGain)} m</span>
        <span>
          Range: {Math.round(minEle)}–{Math.round(maxEle)} m
        </span>
        {tracks.length > 1 && (
          <select
            class={styles.trackSelector}
            value={selectedIndex}
            onChange={(e) => setSelectedIndex(Number((e.target as HTMLSelectElement).value))}
          >
            {tracks.map((t, i) => (
              <option key={i} value={i}>{t.name}</option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
