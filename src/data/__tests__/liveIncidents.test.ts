import { describe, expect, it } from "vitest";
import { buildFire119Display, buildPbsDisplay, normalizeFire119, normalizePbs, returnedFade } from "../liveIncidentsLoader";
import townPoints from "../townRepresentativePoints.json";

const NOW = Date.parse("2026-11-16T21:00:00+08:00");
const iso = (minAgo: number) => new Date(NOW - minAgo * 60_000).toISOString();

function feat(p: Record<string, unknown>, coord: [number, number] | null = null) {
  return { type: "Feature", geometry: coord ? { type: "Point", coordinates: coord } : null, properties: p };
}

const RAW = {
  type: "FeatureCollection",
  meta: { truncated: false, generated_at: iso(0) },
  features: [
    feat({ incident_key: "tpe:1", category: "ems", status: "dispatched", geom_precision: "fuzzy", road_key: "r1", received_at: iso(5), updated_at: iso(5) }, [121.5, 25.04]),
    feat({ incident_key: "khh:1", category: "fire", status: "arrived", geom_precision: "road", road_key: "r2", received_at: iso(20), updated_at: iso(10) }, [120.3, 22.6]),
    feat({ incident_key: "tnn:1", category: "ems", status: "returned", geom_precision: "district", town_code: "67000010", received_at: iso(30), updated_at: iso(25) }),
    feat({ incident_key: "tnn:2", category: "rescue", status: "returned", geom_precision: "district", town_code: "67000010", received_at: iso(40), updated_at: iso(35) }),
    feat({ incident_key: "ntpc:1", category: "ems", status: "transporting", geom_precision: "none", hospital: "某醫院", dest_lon: 121.46, dest_lat: 25.01, received_at: null, updated_at: iso(3) }),
    feat({ incident_key: "ntpc:2", category: "ems", status: "transporting", geom_precision: "none", hospital: "某醫院", dest_lon: 121.46, dest_lat: 25.01, received_at: null, updated_at: iso(8) }),
    // 沒有任何位置：不能靜默消失，要算進「未上圖」
    feat({ incident_key: "kee:1", category: "other", status: "received", geom_precision: "none", received_at: iso(2), updated_at: iso(2) }),
    // 屏東清單帶的數月前舊案：依受理時間排除
    feat({ incident_key: "ptn:old", category: "ems", status: "returned", geom_precision: "road", received_at: "2026-08-01T10:00:00+08:00", updated_at: iso(1) }, [120.5, 22.6]),
    // 返隊超過 60 分鐘：淡出到不上圖
    feat({ incident_key: "tpe:old", category: "ems", status: "returned", geom_precision: "exact", received_at: iso(150), updated_at: iso(90) }, [121.52, 25.05]),
  ],
};

describe("即時 119 案件上圖規則", () => {
  const raw = normalizeFire119(RAW);
  const d = buildFire119Display(raw, NOW, 180);

  it("點只畫 exact／fuzzy／road，舊案與淡出完的返隊不上圖", () => {
    expect(d.points.features.map((f) => f.properties?.incident_key).sort()).toEqual(["khh:1", "tpe:1"]);
  });

  it("只到行政區的案件依 town_code 聚合；新北依目的醫院聚合", () => {
    expect(d.districts.get("67000010")?.length).toBe(2);
    expect([...d.hospitals.values()].map((h) => h.cases.length)).toEqual([2]);
  });

  it("沒有位置的案件計入未上圖，不當成 0", () => {
    expect(d.unmapped).toBe(1);
    expect(d.total).toBe(7); // 返隊逾 60 分鐘的 tpe:old 不計入
  });

  it("進行中脈動、返隊依 updated_at 淡出", () => {
    const tpe = d.points.features.find((f) => f.properties?.incident_key === "tpe:1")!;
    expect(tpe.properties?._pulse).toBe(1);
    expect(tpe.properties?._mark).toBe("pulse");
    const ret = raw.cases.find((c) => c.key === "tnn:1")!;
    expect(returnedFade(ret, NOW)).toBeCloseTo(1 - 25 / 60, 5);
  });

  it("返隊逾淡出時間的區級案件不計入區聚合與 total", () => {
    const expired = normalizeFire119({
      type: "FeatureCollection", meta: { truncated: false },
      features: [
        feat({ incident_key: "tnn:x", category: "ems", status: "returned", geom_precision: "district", town_code: "67000010", received_at: iso(100), updated_at: iso(90) }),
        feat({ incident_key: "tnn:y", category: "ems", status: "dispatched", geom_precision: "district", town_code: "67000010", received_at: iso(10), updated_at: iso(5) }),
      ],
    });
    const out = buildFire119Display(expired, NOW, 180);
    expect(out.districts.get("67000010")?.map((c) => c.key)).toEqual(["tnn:y"]);
    expect(out.total).toBe(1);
  });

  it("時間範圍縮到 1 小時就排除受理 150 分鐘前的案件", () => {
    expect(buildFire119Display(raw, NOW, 60).total).toBe(7);
  });

  it("鄉鎮代表點涵蓋臺南市中西區等 8 碼鄉鎮碼", () => {
    expect(Object.keys(townPoints).length).toBe(368);
    expect((townPoints as Record<string, unknown>)["67000370"]).toBeTruthy();
  });
});

describe("警廣即時路況", () => {
  it("依發生時間篩，無座標另計", () => {
    const raw = normalizePbs({
      type: "FeatureCollection", meta: { truncated: false },
      features: [
        feat({ uid: "a", category: "traffic_incident", status: "cleared", happened_at: iso(10) }, [121.5, 25]),
        feat({ uid: "b", category: "other", status: "reported", happened_at: iso(600) }, [121.4, 25]),
        feat({ uid: "c", category: "other", status: "reported", happened_at: iso(10) }),
      ],
    });
    const d = buildPbsDisplay(raw, NOW, 180);
    expect(d.fc.features.map((f) => f.properties?.uid)).toEqual(["a"]);
    expect(d.unmapped).toBe(1);
  });
});
