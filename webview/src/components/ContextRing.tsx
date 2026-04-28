import { cappyPalette } from "../theme";

interface ContextRingProps {
  ratio: number;
}

export function ContextRing({ ratio }: ContextRingProps): JSX.Element {
  const clampedRatio = Math.max(0, Math.min(1, ratio));
  const normalizedRadius = 7.6;
  const circumference = 2 * Math.PI * normalizedRadius;
  const strokeOffset = circumference - circumference * clampedRatio;
  const strokeColor =
    clampedRatio < 0.6 ? cappyPalette.textAccent : clampedRatio < 0.85 ? cappyPalette.amber : cappyPalette.redSoft;

  return (
    <svg viewBox="0 0 24 24" width={18} height={18} style={{ transform: "rotate(-90deg)" }} aria-hidden="true">
      <circle cx="12" cy="12" r={normalizedRadius} fill="none" stroke={cappyPalette.borderSurface} strokeWidth={2.2} />
      <circle
        cx="12"
        cy="12"
        r={normalizedRadius}
        fill="none"
        stroke={strokeColor}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={strokeOffset}
      />
    </svg>
  );
}
