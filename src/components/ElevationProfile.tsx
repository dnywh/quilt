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
  const R = 6371000; // Earth's radius in meters
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

export default function ElevationProfile({ gpxUrl, mapContainerId }: Props) {
  const [points, setPoints] = useState<ElevationPoint[]>([]);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

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

  // Calculate total elevation gain
  let elevationGain = 0;
  for (let i = 1; i < points.length; i++) {
    const diff = points[i].ele - points[i - 1].ele;
    if (diff > 0) elevationGain += diff;
  }

  const padding = { top: 10, right: 10, bottom: 20, left: 40 };
  const width = 600;
  const height = 100;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const pathD = points
    .map((p, i) => {
      const x = padding.left + (p.distance / totalDistance) * chartWidth;
      const y =
        padding.top + chartHeight - ((p.ele - minEle) / eleRange) * chartHeight;
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  const areaD =
    pathD +
    ` L ${padding.left + chartWidth} ${padding.top + chartHeight} L ${padding.left} ${padding.top + chartHeight} Z`;

  const handleMouseMove = (e: MouseEvent) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    // Convert from rendered pixels to viewBox coordinates
    const scaleX = width / rect.width;
    const viewBoxX = mouseX * scaleX;

    // Calculate relative position within the chart area (0-1)
    const relX = (viewBoxX - padding.left) / chartWidth;

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

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  const hoverX =
    hoverIndex !== null
      ? padding.left + (points[hoverIndex].distance / totalDistance) * chartWidth
      : 0;
  const hoverY =
    hoverIndex !== null
      ? padding.top +
        chartHeight -
        ((points[hoverIndex].ele - minEle) / eleRange) * chartHeight
      : 0;

  return (
    <div class={styles.container}>
      <svg
        ref={svgRef}
        class={styles.chart}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Filled area */}
        <path d={areaD} fill="rgba(255, 0, 0, 0.15)" />
        {/* Line */}
        <path d={pathD} fill="none" stroke="#ff0000" stroke-width="2" />

        {/* Y-axis labels */}
        <text
          x={padding.left - 4}
          y={padding.top + 4}
          text-anchor="end"
          font-size="10"
          fill="#666"
        >
          {Math.round(maxEle)}m
        </text>
        <text
          x={padding.left - 4}
          y={padding.top + chartHeight}
          text-anchor="end"
          font-size="10"
          fill="#666"
        >
          {Math.round(minEle)}m
        </text>

        {/* X-axis labels */}
        <text
          x={padding.left}
          y={height - 4}
          text-anchor="start"
          font-size="10"
          fill="#666"
        >
          0
        </text>
        <text
          x={padding.left + chartWidth}
          y={height - 4}
          text-anchor="end"
          font-size="10"
          fill="#666"
        >
          {(totalDistance / 1000).toFixed(1)}km
        </text>

        {/* Hover indicator */}
        {hoverIndex !== null && (
          <>
            <line
              x1={hoverX}
              y1={padding.top}
              x2={hoverX}
              y2={padding.top + chartHeight}
              stroke="#666"
              stroke-width="1"
              stroke-dasharray="3,3"
            />
            <circle cx={hoverX} cy={hoverY} r="4" fill="#ff0000" />
            <text
              x={hoverX}
              y={padding.top - 2}
              text-anchor="middle"
              font-size="10"
              fill="#333"
            >
              {Math.round(points[hoverIndex].ele)}m
            </text>
          </>
        )}
      </svg>
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
