import { useEffect, useState } from "react";
import { FONT_CJK, FONT_SIZE } from "../../styles/designTokens";
import { useLocale } from "../../state/localeStore";
import { useRailTheme } from "./railTheme";
import { loadAddressManifest } from "../../data/addressIndexLoader";
import type { AddressCountySource, AddressManifest } from "../../lib/addressSearch";

/**
 * 門牌搜尋的來源署名。
 * - 政府門牌（政府資料開放授權條款第1版）必標：提供機關、年份、資料名稱（與版本）、條款連結；漏標授權視為自始不存在。
 * - OSM（ODbL 1.0）：「© OpenStreetMap contributors」連到版權頁；門牌分片以 ODbL 提供。
 * 文字（機關、資料名稱）取自建置 manifest（data.gov.tw metadata），不手打。
 */
function SourceLine({ name, source }: { name: string; source: AddressCountySource }) {
  const { t } = useLocale();
  const linkStyle = { color: "inherit", textDecoration: "underline" } as const;
  if (source.kind === "osm") {
    return (
      <li>
        {name}：<a href={source.license.copyright_url} target="_blank" rel="noreferrer" style={linkStyle}>{source.license.attribution}</a>
        {"，"}
        <a href={source.license.url} target="_blank" rel="noreferrer" style={linkStyle}>{source.license.name}</a>
        {`（${t("addressSearch.attribution.osmShare")}）`}
      </li>
    );
  }
  const dataset = source.dataset_version ? `${source.dataset}（${source.dataset_version}）` : source.dataset;
  return (
    <li>
      {name}：{source.provider}（{source.year}）〈
      {source.dataset_url ? <a href={source.dataset_url} target="_blank" rel="noreferrer" style={linkStyle}>{dataset}</a> : dataset}
      〉，<a href={source.license.url} target="_blank" rel="noreferrer" style={linkStyle}>{source.license.name}</a>
    </li>
  );
}

function SourceList({ manifest, countyCodes }: { manifest: AddressManifest; countyCodes: readonly string[] }) {
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 2 }}>
      {countyCodes.map((code) => {
        const c = manifest.counties[code];
        return c ? <SourceLine key={code} name={c.name} source={c.source} /> : null;
      })}
    </ul>
  );
}

/** 搜尋結果底下：只列這次結果用到的縣市來源 */
export function AddressAttribution({ manifest, countyCodes }: { manifest: AddressManifest; countyCodes: readonly string[] }) {
  const { DIM } = useRailTheme();
  const { t } = useLocale();
  if (!countyCodes.length) return null;
  return (
    <div data-testid="address-attribution" style={{ padding: "4px 12px 6px 28px", fontSize: FONT_SIZE.xs, color: DIM, fontFamily: FONT_CJK, lineHeight: 1.5 }}>
      <div>{t("addressSearch.attribution.title")}</div>
      <SourceList manifest={manifest} countyCodes={countyCodes} />
    </div>
  );
}

/** 資料來源面板：全部 22 縣市門牌來源（展開時才載 manifest） */
export function AddressSourcesList() {
  const { DIM } = useRailTheme();
  const { t } = useLocale();
  const [state, setState] = useState<{ status: "loading" } | { status: "ready"; manifest: AddressManifest } | { status: "error" }>({ status: "loading" });
  useEffect(() => {
    let alive = true;
    loadAddressManifest(t("addressSearch.loading.manifest")).then(
      (manifest) => { if (alive) setState({ status: "ready", manifest }); },
      () => { if (alive) setState({ status: "error" }); },
    );
    return () => { alive = false; };
  }, [t]);
  const style = { padding: "4px 12px 8px", fontSize: FONT_SIZE.xs, color: DIM, fontFamily: FONT_CJK, lineHeight: 1.5 } as const;
  if (state.status === "loading") return <div style={style}>{t("addressSearch.loading.manifest")}…</div>;
  if (state.status === "error") return <div role="alert" style={style}>{t("addressSearch.loadFailed")}</div>;
  return (
    <div style={style}>
      <div>{t("addressSearch.attribution.panelNote")}</div>
      <SourceList manifest={state.manifest} countyCodes={Object.keys(state.manifest.counties)} />
    </div>
  );
}
