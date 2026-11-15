/**
 * W6-10：綜合聲景的「這天資料不足」提示，放在圖層展開區（呈現方式選單下方）。
 * 原本在底部預覽列（W6-4/5），呈現方式改成正式切換後預覽列移除，提示與「看 11/09 範例」按鈕搬到這裡。
 * 只在綜合圖層開著、且最近一幀有族因為沒有全範圍來源檔而整幀無法判斷時出現。
 */
import { useSyncExternalStore } from "react";
import { useLocale } from "../../state/localeStore";
import { useLayerVisible } from "../../state/layerVisibilityStore";
import { compositeFrameStore, NO_SOURCE_NOTES } from "../../sound/grid/compositeState";
import { selectSoundScene } from "../../sound/soundAtlasActions";

export function SoundCompositeDataHint() {
  const { t } = useLocale();
  const on = useLayerVisible("soundComposite");
  const notes = useSyncExternalStore(compositeFrameStore.subscribe, () => compositeFrameStore.get().notes);
  const noSource = !!notes && Object.values(notes).some((n) => n != null && NO_SOURCE_NOTES.has(n));
  if (!on || !noSource) return null;
  return (
    <span role="note" className="lpc-note">
      {t("soundAtlas.composite.noSourceShort")}{" "}
      <button type="button" className="lpc-link" onClick={() => selectSoundScene("taipei-1109")}>
        {t("soundAtlas.composite.sampleDay")}
      </button>
    </span>
  );
}
