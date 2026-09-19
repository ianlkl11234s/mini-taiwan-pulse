import type { NearbyResult, NearbyRow } from "./nearbyData";

type Props = { result: NearbyResult; opacity: number; onOpacity: (value: number) => void; onSelect: (row: NearbyRow) => void; onClear: () => void };
export function NearbyResults({ result, opacity, onOpacity, onSelect, onClear }: Props) {
  const exclusions = result.exclusions;
  const excluded = exclusions ? exclusions.missingGeometry + exclusions.nonPoint + exclusions.invalidCoordinates : null;
  return <section className="nearby-results" aria-label="附近查詢結果">
    <div className="nearby-results-title"><h3>附近的學校</h3><button onClick={onClear}>清除結果</button></div>
    <p><strong>{result.totalMatched} 筆符合</strong> · 半徑 {result.radiusM.toLocaleString()} 公尺</p>
    <small>地表直線距離，並非步行距離或服務範圍。此資料集內的紀錄數，不保證現況完整。</small>
    <p>虛線：查詢半徑。點位沿用已開啟圖層的分類與顏色，不代表全部都符合本次查詢。</p>
    <label>範圍圈透明度<input aria-label="附近範圍圈透明度" type="range" min="0" max="1" step="0.05" value={opacity} onChange={event => onOpacity(Number(event.target.value))} /></label>
    {result.truncated && <p>共 {result.totalMatched} 筆，下方清單顯示最近 {result.returned} 筆。</p>}
    {result.totalMatched === 0 && <p>這份資料在指定半徑內沒有符合的有效點位；不代表現地一定沒有學校。</p>}
    <ol>{result.rows.map(row => <li key={row.id}><button onClick={() => onSelect(row)}><span>{row.name || "未提供名稱"}</span><span>{row.distanceM.toFixed(0)} 公尺</span></button></li>)}</ol>
    <details><summary>來源與計算限制</summary><p>資料檔：{result.source?.reference ?? "未知"}</p><p>資料時間／完整覆蓋：未確認；讀取時間 {result.source?.observedAt ?? "未知"} 不代表資料更新時間。</p><p>方法：Haversine，球半徑 6,371,008.8 公尺；包含半徑邊界。{excluded === null ? "缺值統計未知。" : `排除無效／非點位紀錄 ${excluded} 筆。`}</p><small>同一學校代碼可能對應不同紀錄或校區，這裡逐筆計算。</small></details>
  </section>;
}
