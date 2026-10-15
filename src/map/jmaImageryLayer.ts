/**
 * jmaImageryLayer.ts — JMA 發布幀的 Mapbox image source + raster layer（raster-color 上色）。
 *
 * 與 cwaImageryLayer 的差別：
 *  - PNG 是 LA 值編碼，顏色由 paint 的 raster-color 決定（色票 SSOT = data/jmaTypes.ts）
 *  - 每幀可能有不同四角 → setFrame 每次都帶 coordinates
 */

import type { Map as MapboxMap, ImageSource, RasterLayer } from "mapbox-gl";

export interface JmaImageryBBox {
  lonMin: number;
  lonMax: number;
  latMin: number;
  latMax: number;
}

export type JmaImageryCoordinates = [[number, number], [number, number], [number, number], [number, number]];

export function jmaImageryCoordinates(b: JmaImageryBBox): JmaImageryCoordinates {
  return [
    [b.lonMin, b.latMax], // top-left
    [b.lonMax, b.latMax], // top-right
    [b.lonMax, b.latMin], // bottom-right
    [b.lonMin, b.latMin], // bottom-left
  ];
}

export interface JmaImageryLayerHandle {
  readonly sourceId: string;
  readonly layerId: string;
  setFrame(url: string, bbox: JmaImageryBBox): void;
  setOpacity(opacity: number): void;
  setVisible(visible: boolean): void;
  /** style reload 後重新 attach */
  ensure(): void;
  remove(): void;
}

export interface CreateJmaImageryLayerOptions {
  sourceId: string;
  layerId: string;
  url: string;
  bbox: JmaImageryBBox;
  /** 不含 raster-opacity 的 paint（jmaImageryRasterPaint 產生） */
  paint: (opacity: number) => Record<string, unknown>;
  opacity: number;
  attribution?: string;
}

export function createJmaImageryLayer(map: MapboxMap, opts: CreateJmaImageryLayerOptions): JmaImageryLayerHandle {
  let url = opts.url;
  let coordinates = jmaImageryCoordinates(opts.bbox);
  let opacity = opts.opacity;
  let visible = true;

  const attach = () => {
    if (!map.getSource(opts.sourceId)) {
      map.addSource(opts.sourceId, { type: "image", url, coordinates, ...(opts.attribution ? { attribution: opts.attribution } : {}) } as never);
    }
    if (!map.getLayer(opts.layerId)) {
      map.addLayer({
        id: opts.layerId,
        type: "raster",
        source: opts.sourceId,
        paint: opts.paint(opacity),
        layout: { visibility: visible ? "visible" : "none" },
      } as RasterLayer);
    }
  };
  attach();

  return {
    sourceId: opts.sourceId,
    layerId: opts.layerId,
    setFrame(nextUrl, bbox) {
      url = nextUrl;
      coordinates = jmaImageryCoordinates(bbox);
      const src = map.getSource(opts.sourceId) as ImageSource | undefined;
      if (src && typeof src.updateImage === "function") src.updateImage({ url, coordinates });
    },
    setOpacity(next) {
      opacity = next;
      if (map.getLayer(opts.layerId)) map.setPaintProperty(opts.layerId, "raster-opacity", next);
    },
    setVisible(next) {
      visible = next;
      if (map.getLayer(opts.layerId)) map.setLayoutProperty(opts.layerId, "visibility", next ? "visible" : "none");
    },
    ensure() {
      attach();
    },
    remove() {
      if (map.getLayer(opts.layerId)) map.removeLayer(opts.layerId);
      if (map.getSource(opts.sourceId)) map.removeSource(opts.sourceId);
    },
  };
}
