/**
 * AqiProductSwitcher — 色階圖產品切換 (AQI/PM2.5/PM10/O3/NO2)
 *
 * 僅當 aqiImagery 圖層開啟時才由 App 掛上。
 */
import { FONT_DATA, RADIUS, FONT_SIZE } from "../styles/designTokens";

import { AQI_PRODUCT_LABELS, type AqiProduct } from "../types";

const PRODUCTS: AqiProduct[] = ["AQI", "PM25", "PM10", "O3", "NO2"];

interface Props {
  current: AqiProduct;
  onChange: (p: AqiProduct) => void;
  isDark: boolean;
}

export function AqiProductSwitcher({ current, onChange, isDark }: Props) {
  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        padding: 6,
        background: isDark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.7)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderRadius: RADIUS.xl,
        fontFamily: FONT_DATA,
      }}
    >
      {PRODUCTS.map((p) => {
        const active = p === current;
        return (
          <button
            key={p}
            onClick={() => onChange(p)}
            style={{
              fontSize: FONT_SIZE.sm,
              fontFamily: FONT_DATA,
              padding: "4px 8px",
              borderRadius: RADIUS.md,
              border: "1px solid",
              borderColor: active
                ? "rgba(139, 195, 74, 0.7)"
                : (isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)"),
              background: active
                ? (isDark ? "rgba(139, 195, 74, 0.25)" : "rgba(139, 195, 74, 0.2)")
                : (isDark ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.5)"),
              color: active
                ? (isDark ? "#fff" : "#000")
                : (isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.55)"),
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {AQI_PRODUCT_LABELS[p]}
          </button>
        );
      })}
    </div>
  );
}
