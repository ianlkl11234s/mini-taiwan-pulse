/**
 * UpstreamRegistry 一致性測試
 *
 * 目的：保護 layer ↔ catalog dataset 雙向配對，未來新增 layer / 動 catalog
 * 任一邊不一致時 CI 紅燈。
 *
 * 三大檢查：
 *  1. UPSTREAM_REGISTRY 涵蓋所有 LAYER_COLORS keys（不漏 layer）
 *  2. 每個 verified entry 的 datasetId 真實存在於 catalog .md 檔
 *  3. status 與 datasets 陣列一致（verified 必有 ≥1 dataset；其他狀態必空）
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { LAYER_COLORS } from "../../components/sidebar/layerCatalog";
import { UPSTREAM_REGISTRY, resolveUpstreamDatasets } from "../upstreamRegistry";

// 解析 catalog 所有 dataset_id（從 frontmatter + 檔名 fallback）
function loadCatalogDatasetIds(): Set<string> {
  const catalogRoot = resolve(__dirname, "../../../../taipei-gis-analytics/docs/data-catalog");
  if (!existsSync(catalogRoot)) {
    // CI 沒 sibling repo 時 graceful skip — 只擋本 repo 內部一致性
    return new Set<string>();
  }
  const ids = new Set<string>();
  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        if (entry.startsWith("_")) continue;
        walk(full);
        continue;
      }
      if (!entry.endsWith(".md")) continue;
      if (entry === "_template.md" || entry === "README.md") continue;
      const text = readFileSync(full, "utf-8");
      // Parse frontmatter
      let id = "";
      if (text.startsWith("---")) {
        const end = text.indexOf("\n---", 3);
        if (end > 0) {
          const fm = text.slice(3, end);
          const m1 = fm.match(/^dataset_id:\s*(\S+)/m);
          const m2 = fm.match(/^source_id:\s*(\S+)/m);
          id = (m1?.[1] || m2?.[1] || "").trim();
        }
      }
      if (!id) id = entry.replace(/\.md$/, "");
      ids.add(id);
    }
  }
  walk(catalogRoot);
  return ids;
}

describe("UPSTREAM_REGISTRY consistency", () => {
  it("covers every LAYER_COLORS key", () => {
    const layerKeys = Object.keys(LAYER_COLORS);
    const registryKeys = new Set(Object.keys(UPSTREAM_REGISTRY));
    const missing = layerKeys.filter((k) => !registryKeys.has(k));
    expect(missing, `Missing UPSTREAM_REGISTRY entries: ${missing.join(", ")}`).toEqual([]);
  });

  it("has no orphan keys (UPSTREAM_REGISTRY entries not in LAYER_COLORS)", () => {
    const layerKeys = new Set(Object.keys(LAYER_COLORS));
    const orphans = Object.keys(UPSTREAM_REGISTRY).filter((k) => !layerKeys.has(k));
    expect(orphans, `Orphan UPSTREAM_REGISTRY keys: ${orphans.join(", ")}`).toEqual([]);
  });

  it("status and datasets shape is consistent", () => {
    const violations: string[] = [];
    for (const [key, ref] of Object.entries(UPSTREAM_REGISTRY)) {
      if (ref.status === "verified" && ref.datasets.length === 0) {
        violations.push(`${key}: status=verified but datasets empty`);
      }
      if (ref.status !== "verified" && ref.datasets.length > 0) {
        violations.push(`${key}: status=${ref.status} but has datasets`);
      }
      for (const d of ref.datasets) {
        if (!d.datasetId || !d.confidence) {
          violations.push(`${key}: dataset entry missing fields`);
        }
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("pulse_only derivedFromLayers reference real layer_keys", () => {
    const layerKeys = new Set(Object.keys(LAYER_COLORS));
    const broken: string[] = [];
    for (const [key, ref] of Object.entries(UPSTREAM_REGISTRY)) {
      if (ref.status !== "pulse_only") continue;
      for (const src of ref.derivedFromLayers ?? []) {
        if (!layerKeys.has(src)) broken.push(`${key} → ${src}`);
      }
    }
    expect(broken, `Broken derivedFromLayers refs:\n  ${broken.join("\n  ")}`).toEqual([]);
  });

  it("pulse_only derivations transitively resolve to at least one upstream dataset", () => {
    const noUpstream: string[] = [];
    for (const [key, ref] of Object.entries(UPSTREAM_REGISTRY)) {
      if (ref.status !== "pulse_only") continue;
      if (!ref.derivedFromLayers?.length && !ref.derivedFromDatasets?.length) continue;
      const upstream = resolveUpstreamDatasets(key as keyof import("../../types").LayerVisibility);
      if (upstream.length === 0) noUpstream.push(key);
    }
    expect(
      noUpstream,
      `pulse_only layers with lineage but no resolvable upstream:\n  ${noUpstream.join("\n  ")}`
    ).toEqual([]);
  });

  it("every verified datasetId exists in catalog (skips if sibling repo absent)", () => {
    const catalogIds = loadCatalogDatasetIds();
    if (catalogIds.size === 0) {
      console.log("⚠ taipei-gis-analytics not at sibling path; skipping cross-repo check");
      return;
    }
    const broken: string[] = [];
    for (const [key, ref] of Object.entries(UPSTREAM_REGISTRY)) {
      if (ref.status !== "verified") continue;
      for (const d of ref.datasets) {
        if (!catalogIds.has(d.datasetId)) {
          broken.push(`${key} → ${d.datasetId}`);
        }
      }
    }
    expect(broken, `Broken catalog refs:\n  ${broken.join("\n  ")}`).toEqual([]);
  });
});
