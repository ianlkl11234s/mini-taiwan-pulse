/**
 * 國家包（B1 P5a）：沒載入時的行為、任意子集與載入順序都排回原位、分享網址參數要等包載入才套得上。
 * 每個情境用 vi.resetModules() 取一份全新的模組圖（登記簿是模組層級狀態）。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CountryCode } from "../../constants/countries";

beforeEach(() => {
  vi.resetModules();
});

interface Registries {
  packs: typeof import("../packs");
  manifest: Record<string, unknown>;
  params: Record<string, unknown>;
  hosts: readonly { id: string; keys: readonly string[] }[];
  clicks: readonly { type: string }[];
  legends: readonly { id: string }[];
}

async function freshRegistries(): Promise<Registries> {
  const [packs, m, p, h, c, l] = await Promise.all([
    import("../packs"),
    import("../../data/layerManifest"),
    import("../../data/layerParamsSpec"),
    import("../../layers/layerHookRegistry"),
    import("../../map/gisClickRegistry"),
    import("../../components/LegendPanel"),
  ]);
  return {
    packs,
    manifest: m.LAYER_MANIFEST as Record<string, unknown>,
    params: p.LAYER_PARAMS_SPEC as Record<string, unknown>,
    hosts: h.LAYER_HOOK_REGISTRY,
    clicks: c.GIS_LAYERS,
    legends: (l as unknown as { LEGEND_REGISTRY: readonly { id: string }[] }).LEGEND_REGISTRY,
  };
}

function signature(r: Registries) {
  return {
    manifest: Object.keys(r.manifest),
    params: Object.keys(r.params),
    hosts: r.hosts.map((e) => e.id),
    clicks: r.clicks.map((e) => e.type),
    legends: r.legends.map((e) => e.id),
  };
}
type Signature = ReturnType<typeof signature>;

/** 某國國家包自己帶的 key／條目 id（用來從完整順序扣掉沒載入的國家） */
async function packMembers(cc: "CN" | "GB"): Promise<Signature> {
  const pack = (cc === "CN" ? await import("../cn/pack") : await import("../gb/pack")).default;
  const ids = <T,>(slots: Readonly<Record<number, readonly T[]>> | undefined, f: (x: T) => string) =>
    Object.values(slots ?? {}).flat().map(f);
  return {
    manifest: Object.keys(pack.records.layerManifest ?? {}),
    params: Object.keys(pack.records.layerParamsSpec ?? {}),
    hosts: ids(pack.slots.layerHosts as Record<number, { id: string }[]>, (e) => e.id),
    clicks: ids(pack.slots.gisClickLayers as Record<number, { type: string }[]>, (e) => e.type),
    legends: ids(pack.slots.legends as Record<number, { id: string }[]>, (e) => e.id),
  };
}

describe("國家包沒載入時", () => {
  it("登記簿沒有中英兩國的條目；側欄、國家歸屬、網址解析改讀索引照常", async () => {
    const r = await freshRegistries();
    expect(r.manifest).not.toHaveProperty("gbSchools");
    expect(r.manifest).not.toHaveProperty("cnAdminBoundaries");
    expect(r.manifest).toHaveProperty("statsGbPopulation"); // 英國統計這輪留在靜態登記簿
    expect(r.hosts.some((e) => e.keys.includes("gbSchools"))).toBe(false);

    const { layerCountryOf, getLayerEntry } = await import("../../data/layerLookup");
    expect(layerCountryOf("gbSchools")).toBe("GB");
    // 開發環境：漏了 ensureCountryPack 直接報錯；同國留在靜態登記簿的 key 照常
    expect(() => getLayerEntry("gbSchools")).toThrow(/ensureCountryPack/);
    expect(getLayerEntry("statsGbPopulation")).toBeDefined();

    // 側欄主題樹：英國圖層列（名稱來自索引）
    const { THEMES } = await import("../../components/sidebar/layerCatalog");
    const gbRow = THEMES.flatMap((t) => t.groups.flatMap((g) => g.layers)).find((l) => l.key === "gbSchools");
    expect(gbRow?.label).toBeTruthy();

    const { parseUrlState, URL_STATE_VERSION } = await import("../../lib/urlState");
    expect(parseUrlState(`?v=${URL_STATE_VERSION}&c=gb&layers=gbSchools`).layers).toEqual(["gbSchools"]);

    const { isRightSideKey } = await import("../../map/compareCountrySides");
    expect(isRightSideKey("gbSchools", "GB")).toBe(true);

    expect(r.packs.isCountryPackReady("GB")).toBe(false);
  }, 120_000);

  it("嵌入頁的白名單沒有國家包的圖層（embed 不載國家包；之後若要放行，要先在 embed 接 ensureCountryPack）", async () => {
    const { EMBED_ALLOWED } = await import("../../embed/embedWhitelist");
    const { layerCountryOf } = await import("../../data/layerLookup");
    const { hasCountryPack } = await import("../packs");
    const offending = [...EMBED_ALLOWED].filter((k) => { const cc = layerCountryOf(k); return cc && hasCountryPack(cc); });
    expect(offending).toEqual([]);
  });
});

describe("任意子集、任意載入順序都排回搬家前的位置", () => {
  const ORDERS: CountryCode[][] = [[], ["CN"], ["GB"], ["CN", "GB"], ["GB", "CN"]];
  let full: Signature | null = null;
  const members: Partial<Record<"CN" | "GB", Signature>> = {};

  async function expected(loaded: readonly CountryCode[]): Promise<Signature> {
    if (!full) {
      vi.resetModules();
      const r = await freshRegistries();
      await r.packs.loadAllPacks();
      full = signature(r);
      members.CN = await packMembers("CN");
      members.GB = await packMembers("GB");
      vi.resetModules();
    }
    const out = structuredClone(full);
    for (const cc of ["CN", "GB"] as const) {
      if (loaded.includes(cc)) continue;
      const m = members[cc]!;
      for (const k of Object.keys(out) as (keyof Signature)[]) {
        const drop = new Set(m[k]);
        // clicks 的 type 可能跨國重複（不會，但保險）：只扣國家包帶的那幾筆的數量
        out[k] = out[k].filter((x) => !drop.has(x));
      }
    }
    return out;
  }

  for (const order of ORDERS) {
    it(`載入 ${order.length ? order.join(" → ") : "（不載）"}`, async () => {
      const want = await expected(order);
      const r = await freshRegistries();
      for (const cc of order) await r.packs.ensureCountryPack(cc);
      expect(signature(r)).toEqual(want);
    }, 120_000);
  }
});

describe("分享網址 ?c=GB&layers=…&p=…：參數要等國家包載入後才套得上", () => {
  it("開站解析出要載英國包；包沒載入前英國圖層的 p.* 解不出（所以 App 必須等），載入後解得出、Host 也才掛上", async () => {
    // 先在完整載入的模組圖裡，造一組「透明度不是預設」的分享參數
    const a = await freshRegistries();
    await a.packs.ensureCountryPack("GB");
    const { layerParamsForUrl } = await import("../../lib/urlLayerParams");
    const specs = a.params.gbSchools as { kind: string; name: string; default: unknown; min?: number; max?: number }[];
    const slider = specs.find((s) => s.kind === "slider" && typeof s.default === "number")!;
    const value = (slider.default as number) === slider.max ? slider.min! : slider.max!;
    const p = layerParamsForUrl(["gbSchools"], { gbSchools: { [slider.name]: value } })!;
    expect(p).toBeDefined();

    vi.resetModules();
    const { URL_STATE_VERSION } = await import("../../lib/urlState");
    const search = `?v=${URL_STATE_VERSION}&c=gb&layers=gbSchools&${Object.entries(p).map(([k, v]) => `p.${k}=${v}`).join("&")}`;
    const { packCountriesForSearch } = await import("../bootPacks");
    expect(packCountriesForSearch(search)).toEqual(["GB"]);

    const b = await freshRegistries();
    const { resolveUrlLayerParams } = await import("../../lib/urlLayerParams");
    const { parseUrlState } = await import("../../lib/urlState");
    const url = parseUrlState(search);
    expect(url.layers).toEqual(["gbSchools"]);
    // 包還沒載入：規格是空的，參數會被當成不存在（這就是不能直接套的原因）
    expect(resolveUrlLayerParams(url.params, url.layers!, {})).toEqual([]);
    expect(b.hosts.some((e) => e.keys.includes("gbSchools"))).toBe(false);

    await b.packs.ensureCountryPack("GB");
    expect(resolveUrlLayerParams(url.params, url.layers!, {})).toContainEqual({ key: "gbSchools", name: slider.name, value });
    expect(b.hosts.some((e) => e.keys.includes("gbSchools"))).toBe(true);
  }, 120_000);
});

describe("載入標籤", () => {
  it("loadingRegistry 標籤是「載入〈國名〉圖層清單」，未載入狀態是 idle", async () => {
    const r = await freshRegistries();
    expect(r.packs.countryPackStatus("CN")).toBe("idle");
    expect(r.packs.countryPackStatus("TW")).toBe("none");
    expect(r.packs.packLoadingLabel("GB")).toBe("載入英國圖層清單");
    expect(r.packs.packLoadingLabel("CN")).toBe("載入中國大陸圖層清單"); // 國名取 zh-TW 字典（country.CN）
  });
});
