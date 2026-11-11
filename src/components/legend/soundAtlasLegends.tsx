/**
 * City Sound Atlas 聲景（實驗）圖例：十個家族共用一份（legend id "soundAtlas"）。
 * 家族色、接收點、無法判斷（灰色空心）、連線與雷聲波前（示意）；固定註明非 dB。
 */
import { LegendNote, LegendRow, LegendTitle, SwatchDot } from "./legendKit";
import { useLocale } from "../../state/localeStore";
import { SOUND_FAMILY_COLORS, SOUND_RECEIVER_COLOR, SOUND_UNKNOWN_COLOR } from "../../sound/soundAtlasColors";
import { FAMILY_KEYS } from "../sound/soundAtlasText";
import { SOUND_FAMILIES_ALL } from "../../sound/engines/receiverQuery";
import type { SoundSourceFamily } from "../../sound/types";

const FAMILIES: readonly SoundSourceFamily[] = SOUND_FAMILIES_ALL;

export function SoundAtlasLegend() {
  const { t } = useLocale();
  return <div>
    <LegendTitle zh={t("legend.soundAtlas.title")} />
    {FAMILIES.map((f) => (
      <LegendRow key={f} swatch={<SwatchDot color={SOUND_FAMILY_COLORS[f]} />}>{t(FAMILY_KEYS[f])}</LegendRow>
    ))}
    <LegendRow swatch={<SwatchDot color="#ffffff" stroke={SOUND_RECEIVER_COLOR} strokeWidth={3} opacity={1} />}>{t("legend.soundAtlas.receiver")}</LegendRow>
    <LegendRow swatch={<SwatchDot color="transparent" stroke={SOUND_UNKNOWN_COLOR} strokeWidth={1.5} opacity={1} />}>{t("legend.soundAtlas.unknown")}</LegendRow>
    <LegendNote>{t("legend.soundAtlas.size")}</LegendNote>
    <LegendNote>{t("legend.soundAtlas.link")}</LegendNote>
    <LegendNote>{t("legend.soundAtlas.wavefront")}</LegendNote>
    <LegendNote>{t("legend.soundAtlas.animation")}</LegendNote>
    <LegendNote>{t("legend.soundAtlas.rail")}</LegendNote>
    <LegendNote>{t("legend.soundAtlas.roadTypical")}</LegendNote>
    <LegendNote>{t("legend.soundAtlas.roadTraffic")}</LegendNote>
    <LegendNote>{t("legend.soundAtlas.roadwork")}</LegendNote>
    <LegendNote>{t("legend.soundAtlas.wind")}</LegendNote>
    <LegendNote>{t("legend.soundAtlas.wave")}</LegendNote>
    <LegendNote>{t("legend.soundAtlas.river")}</LegendNote>
    <LegendNote>{t("legend.soundAtlas.naturalSnapshot")}</LegendNote>
    <LegendNote>{t("legend.soundAtlas.attribution")}</LegendNote>
    <LegendNote>{t("legend.soundAtlas.naturalAttribution")}</LegendNote>
    <LegendNote>{t("soundAtlas.disclaimer")}</LegendNote>
  </div>;
}
