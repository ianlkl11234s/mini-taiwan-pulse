/** 與主地圖共用的選取代號（useMapInteraction 的 featureRequest）：任一張圖開始新的選取就讓舊的非同步結果失效 */
export interface SelectionRequest {
  begin: () => number;
  isCurrent: (token: number) => boolean;
}

/**
 * 比較右圖的非同步 probe（例如日本樹冠高度 raster 取像素）：點擊當下取號，結果回來時
 * 若主地圖或右圖已有更新的選取、或右圖已關閉／換國（isDisposed），就丟掉不發佈。
 */
export function startRightMapProbe<T>(
  request: SelectionRequest,
  isDisposed: () => boolean,
  sample: () => Promise<T>,
  publish: (result: T) => void,
): void {
  const token = request.begin();
  void sample().then((result) => {
    if (isDisposed() || !request.isCurrent(token)) return;
    publish(result);
  });
}
