/**
 * cwaImageryLayer.ts — 管理 Mapbox 原生 image source + raster layer。
 *
 * 包一層薄的 helper，方便 hook 動態 add/updateImage/remove。
 */

import type { Map as MapboxMap, ImageSource, RasterLayer } from "mapbox-gl";

export interface CwaImageryBBox {
  lonMin: number;
  lonMax: number;
  latMin: number;
  latMax: number;
}

export interface CwaImageryLayerHandle {
  readonly sourceId: string;
  readonly layerId: string;
  setUrl(url: string): void;
  setOpacity(opacity: number): void;
  setVisible(visible: boolean): void;
  /** 如果 style reload 導致 layer 消失，重新 attach（沿用目前狀態） */
  ensure(): void;
  remove(): void;
}

export interface CreateCwaImageryLayerOptions {
  sourceId: string;
  layerId: string;
  bbox: CwaImageryBBox;
  initialUrl: string;
  opacity: number;
  /** beforeId: 放在哪個 layer 下方（未指定則置於最上層） */
  beforeId?: string;
}

function bboxToCoordinates(
  bbox: CwaImageryBBox,
): [[number, number], [number, number], [number, number], [number, number]] {
  return [
    [bbox.lonMin, bbox.latMax], // top-left
    [bbox.lonMax, bbox.latMax], // top-right
    [bbox.lonMax, bbox.latMin], // bottom-right
    [bbox.lonMin, bbox.latMin], // bottom-left
  ];
}

export function createCwaImageryLayer(
  map: MapboxMap,
  opts: CreateCwaImageryLayerOptions,
): CwaImageryLayerHandle {
  const coordinates = bboxToCoordinates(opts.bbox);
  let currentUrl = opts.initialUrl;
  let currentOpacity = opts.opacity;
  let currentVisible = true;

  const attach = () => {
    if (!map.getSource(opts.sourceId)) {
      map.addSource(opts.sourceId, {
        type: "image",
        url: currentUrl,
        coordinates,
      });
    }
    if (!map.getLayer(opts.layerId)) {
      map.addLayer(
        {
          id: opts.layerId,
          type: "raster",
          source: opts.sourceId,
          paint: {
            "raster-opacity": currentOpacity,
            "raster-fade-duration": 0,
          },
          layout: {
            visibility: currentVisible ? "visible" : "none",
          },
        } as RasterLayer,
        opts.beforeId,
      );
    }
  };

  attach();

  return {
    sourceId: opts.sourceId,
    layerId: opts.layerId,
    setUrl(url: string) {
      currentUrl = url;
      const src = map.getSource(opts.sourceId) as ImageSource | undefined;
      if (src && typeof (src as ImageSource).updateImage === "function") {
        (src as ImageSource).updateImage({ url, coordinates });
      }
    },
    setOpacity(opacity: number) {
      currentOpacity = opacity;
      if (map.getLayer(opts.layerId)) {
        map.setPaintProperty(opts.layerId, "raster-opacity", opacity);
      }
    },
    setVisible(visible: boolean) {
      currentVisible = visible;
      if (map.getLayer(opts.layerId)) {
        map.setLayoutProperty(opts.layerId, "visibility", visible ? "visible" : "none");
      }
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
