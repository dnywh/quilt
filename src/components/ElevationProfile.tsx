import { useEffect, useState, useRef } from "preact/hooks";
import styles from "./ElevationProfile.module.css";

interface ElevationPoint {
  lon: number;
  lat: number;
  ele: number;
  distance: number;
}

interface Props {
  gpxUrl: string;
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

export default function ElevationProfile({ gpxUrl, mapContainerId }: Props) {
  const [points, setPoints] = useState<ElevationPoint[]>([]);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadGpx() {
      try {
        const response = await fetch(gpxUrl);
        const gpxText = await response.text();
        const parser = new DOMParser();
        const gpxDoc = parser.parseFromString(gpxText, "text/xml");

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

        setPoints(trackPoints);
      } catch (error) {
        console.error("Error loading GPX for elevation:", error);
      }
    }

    loadGpx();
  }, [gpxUrl]);

  useEffect(() => {
    const event = new CustomEvent("elevation-hover", {
      detail:
        hoverIndex !== null
          ? { lon: points[hoverIndex].lon, lat: points[hoverIndex].lat }
          : null,
    });
    document.getElementById(mapContainerId)?.dispatchEvent(event);
  }, [hoverIndex, points, mapContainerId]);

  if (points.length === 0) return null;

  const elevations = points.map((p) => p.ele);
  const minEle = Math.min(...elevations);
  const maxEle = Math.max(...elevations);
  const eleRange = maxEle - minEle || 1;
  const totalDistance = points[points.length - 1].distance;

  let elevationGain = 0;
  for (let i = 1; i < points.length; i++) {
    const diff = points[i].ele - points[i - 1].ele;
    if (diff > 0) elevationGain += diff;
  }

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
      </div>
    </div>
  );
}
