/** owner-data 上傳計畫（scripts/deploy/upload-owner-data-private.mjs 的純函式）：bucket 已有的不需要本機檔。 */
import { describe, expect, it } from "vitest";
import { ownerDataKey, planOwnerDataUpload } from "../../../scripts/deploy/upload-owner-data-private.mjs";

const sha = (c: string) => c.repeat(64);
const A = { product: "a", filename: "a.json", size: 10, sha256: sha("a") };
const B = { product: "b", filename: "b.json.gz", size: 20, sha256: sha("b") };
const C = { product: "c", filename: "c.pmtiles", size: 30, sha256: sha("c") };
const validation = { assets: { "b.json.gz": { size: 20, sha256: sha("b") } } };

describe("planOwnerDataUpload", () => {
  it("bucket 已有＝present（不看本機）；沒有但本機有且一致＝upload；兩者都沒有＝missing", () => {
    const existing = new Map([[ownerDataKey(A), 10]]);
    const local = new Map([["b.json.gz", { size: 20, sha256: sha("b") }]]);
    const plan = planOwnerDataUpload([A, B, C], existing, validation, local);
    expect(plan.present.map((x) => x.product)).toEqual(["a"]);
    expect(plan.upload.map((x) => x.product)).toEqual(["b"]);
    expect(plan.missing.map((x) => x.product)).toEqual(["c"]);
    expect(plan.errors).toEqual([]);
  });

  it("key 是內容定址 <prefix>/<sha256>/<filename>", () => {
    expect(ownerDataKey(B)).toBe(`private-research/owner-data/${sha("b")}/b.json.gz`);
  });

  it("要上傳的檔：local_validation.json 缺列或不一致、本機 bytes 不一致都算錯誤，不上傳", () => {
    const local = new Map([["b.json.gz", { size: 20, sha256: sha("b") }]]);
    expect(planOwnerDataUpload([B], new Map(), null, local).errors).toHaveLength(1);
    expect(planOwnerDataUpload([B], new Map(), { assets: { "b.json.gz": { size: 21, sha256: sha("b") } } }, local).errors).toHaveLength(1);
    const badLocal = new Map([["b.json.gz", { size: 20, sha256: sha("d") }]]);
    const plan = planOwnerDataUpload([B], new Map(), validation, badLocal);
    expect(plan.errors).toHaveLength(1);
    expect(plan.upload).toEqual([]);
  });

  it("bucket 物件大小和契約不符＝錯誤；契約本身無效＝錯誤", () => {
    expect(planOwnerDataUpload([A], new Map([[ownerDataKey(A), 11]]), null, new Map()).errors).toHaveLength(1);
    expect(planOwnerDataUpload([{ ...A, sha256: "x" }], new Map(), null, new Map()).errors).toHaveLength(1);
  });
});
