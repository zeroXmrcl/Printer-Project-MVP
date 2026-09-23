type CurvePoint = { nozzle: number | null; bed: number | null; percent: number | null };

export function TelemetrySpark({ samples }: { samples: CurvePoint[] }) {
  const usable = samples.filter((sample) => sample.nozzle !== null || sample.bed !== null || sample.percent !== null);
  if (usable.length < 2) return null;
  const stride = Math.max(1, Math.ceil(usable.length / 500));
  const points = usable.filter((_, index) => index % stride === 0 || index === usable.length - 1);
  return (
    <svg className="chart" viewBox="0 0 640 180" preserveAspectRatio="none" role="img" aria-label="Nozzle, bed, and progress">
      <g stroke="#2e2e2e" strokeWidth="1">
        <line x1="0" y1="36" x2="640" y2="36" />
        <line x1="0" y1="90" x2="640" y2="90" />
        <line x1="0" y1="144" x2="640" y2="144" />
      </g>
      <polyline fill="none" stroke="#e7a8a0" strokeWidth="2" points={line(points, (sample) => sample.nozzle, 300)} />
      <polyline fill="none" stroke="#e4d2a4" strokeWidth="2" points={line(points, (sample) => sample.bed, 120)} />
      <polyline fill="none" stroke="#f4f4f5" strokeWidth="2" points={line(points, (sample) => sample.percent, 100)} />
    </svg>
  );
}

function line(points: CurvePoint[], read: (sample: CurvePoint) => number | null, max: number): string {
  return points
    .map((sample, index) => {
      const value = read(sample);
      if (value === null) return null;
      const x = points.length === 1 ? 0 : (index / (points.length - 1)) * 640;
      const y = 160 - (Math.max(0, Math.min(max, value)) / max) * 140;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .filter(Boolean)
    .join(" ");
}
