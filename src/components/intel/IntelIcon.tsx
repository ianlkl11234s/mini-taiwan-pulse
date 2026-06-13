import type { CSSProperties } from "react";

/** lucide-flavored inline icons（1.6 stroke） */
export const ICON = {
  radio: ["M4.9 19.1C1 15.2 1 8.8 4.9 4.9", "M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5", "M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5", "M19.1 4.9C23 8.8 23 15.2 19.1 19.1"],
  x: ["M18 6 6 18", "M6 6l12 12"],
  refresh: ["M3 12a9 9 0 0 1 15-6.7L21 8", "M21 3v5h-5", "M21 12a9 9 0 0 1-15 6.7L3 16", "M3 21v-5h5"],
  chevDown: ["M6 9l6 6 6-6"],
  chevRight: ["M9 6l6 6-6 6"],
  ext: ["M15 3h6v6", "M10 14 21 3", "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"],
  copy: ["M8 4v12a2 2 0 0 0 2 2h8M16 4h2a2 2 0 0 1 2 2v8", "M8 4H6a2 2 0 0 0-2 2v0"],
  play: ["M6 4l14 8-14 8z"],
  pause: ["M7 4v16", "M17 4v16"],
  layers: ["M12 2 2 7l10 5 10-5-10-5z", "M2 17l10 5 10-5", "M2 12l10 5 10-5"],
  cluster: ["M5 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4z", "M19 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4z", "M5 7v6a2 2 0 0 0 2 2h8"],
  alert: ["M12 9v4", "M12 17h.01", "M10.3 3.3 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0z"],
};

export type IconKey = keyof typeof ICON;

interface Props {
  d: string[];
  size?: number;
  color?: string;
  fill?: string;
  sw?: number;
  style?: CSSProperties;
}

export function IntelIcon({ d, size = 14, color = "currentColor", fill = "none", sw = 1.6, style }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={color}
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, ...style }}
    >
      {d.map((p, i) => (
        <path key={i} d={p} />
      ))}
    </svg>
  );
}
