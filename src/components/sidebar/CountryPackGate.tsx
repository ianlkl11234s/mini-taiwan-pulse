import type { ReactNode } from "react";
import type { CountryCode } from "../../constants/countries";
import { countryDef } from "../../constants/countries";
import { ensureCountryPack, useCountryPackStatus } from "../../countries/packs";
import { useLocale } from "../../state/localeStore";
import { FONT_CJK, FONT_SIZE, RADIUS } from "../../styles/designTokens";
import { useRailTheme } from "./railTheme";

/**
 * 國家包（B1 P5a）載入中：主題樹照畫（名稱、顏色來自索引）但整片變灰、不能點，頂端一行骨架提示；
 * 載入失敗：提示＋重試。沒有國家包或已載入就原樣顯示。
 */
export function CountryPackGate({ country, children }: { country?: CountryCode; children: ReactNode }) {
  const status = useCountryPackStatus(country ?? "TW");
  const { t } = useLocale();
  const { DIM, ALLOFF_BG, ALLOFF_BORDER, TEXT_STRONG } = useRailTheme();
  if (!country || (status !== "loading" && status !== "error")) return <>{children}</>;
  const name = t(countryDef(country).labelKey);
  return (
    <div aria-busy={status === "loading"}>
      <div role="status" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", color: DIM, fontFamily: FONT_CJK, fontSize: FONT_SIZE.base }}>
        <span style={{ flex: 1 }}>{t(status === "loading" ? "layers.packLoading" : "layers.packFailed", { country: name })}</span>
        {status === "error" && (
          <button
            type="button"
            onClick={() => { void ensureCountryPack(country).catch(() => undefined); }}
            style={{ padding: "3px 10px", background: ALLOFF_BG, border: `1px solid ${ALLOFF_BORDER}`, borderRadius: RADIUS.lg, color: TEXT_STRONG, fontSize: FONT_SIZE.base, fontFamily: FONT_CJK, cursor: "pointer" }}
          >
            {t("layers.packRetry")}
          </button>
        )}
      </div>
      <div inert style={{ opacity: 0.45, pointerEvents: "none" }}>{children}</div>
    </div>
  );
}
