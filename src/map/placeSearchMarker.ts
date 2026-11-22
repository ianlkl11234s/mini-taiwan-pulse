import mapboxgl from "mapbox-gl";
import type { Map as MapboxMap } from "mapbox-gl";
import type { PlaceSearchHit } from "../lib/placeSearch";
import "../components/mapMeasure.css";

/**
 * 側欄地點搜尋選到一筆：行政區、路段用 bbox fitBounds，車站、門牌 flyTo，並放一個暫時標記（路段不放）
 * （沿用右鍵選單的 .map-ctx-pin 藍點樣式，design-system §5.44）。回傳移除函式。
 */
export function showPlaceSearchResult(map: MapboxMap, place: PlaceSearchHit, isDarkTheme: boolean): () => void {
  if (place.bbox) {
    const [w, s, e, n] = place.bbox;
    const maxZoom = place.kind === "road" ? 16 : place.kind === "village" ? 15 : 13;
    map.fitBounds([[w, s], [e, n]], { padding: 80, maxZoom, duration: 2000 });
  } else {
    map.flyTo({ center: place.center, zoom: place.kind === "address" ? 17 : 15, duration: 2000 });
  }
  // 路段只框範圍、不放點（中心點不是真實門牌）
  if (place.kind === "road") return () => {};
  const el = document.createElement("div");
  el.className = `map-ctx-pin place-search-pin${isDarkTheme ? "" : " map-ctx-pin--light"}`;
  const marker = new mapboxgl.Marker({ element: el }).setLngLat(place.center).addTo(map);
  return () => marker.remove();
}
