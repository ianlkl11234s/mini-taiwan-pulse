import { describe, expect, it } from "vitest";
import { caQuakeEventType, caQuakeLiveUrl, caQuakePlaceEn, parseCaQuakeText } from "../caLiveQuakesLoader";

const SAMPLE = `#EventID|Time|Latitude|Longitude|Depth/km|MagType|Magnitude|EventLocationName
ca2026vycq|2026-11-05T15:56:06.000Z|54.5418|-117.3|3|MLy|2.33|Suspected industry-related event, 36 km WNW of Fox Creek, AB/Événement lié à l'industrie soupçonné, 36 km ONO de Fox Creek, AB
ca2026vxdk|2026-11-05T03:20:31.000Z|47.513|-70.0831|11.21|MwN|1.54|16 km SSE of La Malbaie, QC/16 km SSE de La Malbaie, QC
ca2026vwvf|2026-11-04T23:14:25.000Z|55.5835|-122.2519|0|ML|2.68|Quarry blast, 3 km SE of Willow Creek Mine, BC/Dynamitage de carrière, 3 km SE de la mine Willow Creek, BC
bad|2026-11-04T00:00:00.000Z|x|y|0|ML|1|broken
`;

describe("加拿大即時地震（NRCan FDSN text）", () => {
  it("解析 text 成 GeoJSON，略過座標壞掉的列", () => {
    const fc = parseCaQuakeText(SAMPLE);
    expect(fc.features).toHaveLength(3);
    const f = fc.features[1]!;
    expect(f.geometry.coordinates).toEqual([-70.0831, 47.513]);
    expect(f.properties).toMatchObject({ event_id: "ca2026vxdk", time_utc: "2026-11-05T03:20:31Z", magnitude: 1.54, depth_km: 11.21, mag_type: "MwN", place: "16 km SSE of La Malbaie, QC", event_type: "earthquake" });
  });

  it("依英文地名前綴分事件類型", () => {
    expect(caQuakeEventType("Suspected industry-related event, 36 km WNW of Fox Creek, AB")).toBe("industry");
    expect(caQuakeEventType("Quarry blast, 3 km SE of Willow Creek Mine, BC")).toBe("blast");
    expect(caQuakeEventType("Blast, Goldex Mine, QC")).toBe("blast");
    expect(caQuakeEventType("Mining event, Creighton Mine, ON")).toBe("mining");
    expect(caQuakeEventType("Preliminary; 94 km NNE of Yakutat, AK")).toBe("earthquake");
  });

  it("英法雙語地名取英文段；斜線數不對稱時保留原文", () => {
    expect(caQuakePlaceEn("A/B/C/D")).toBe("A/B");
    expect(caQuakePlaceEn("A/B/C")).toBe("A/B/C");
    expect(caQuakePlaceEn("Only English")).toBe("Only English");
  });

  it("查詢網址：現在往前 30 天、format=text", () => {
    expect(caQuakeLiveUrl(Date.UTC(2026, 10, 6, 9, 0, 0))).toBe("https://earthquakescanada.nrcan.gc.ca/fdsnws/event/1/query?starttime=2026-10-07T09:00:00&format=text");
  });
});
