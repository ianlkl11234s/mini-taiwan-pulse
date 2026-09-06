import { createHash } from "node:crypto";
import { existsSync, openSync, readFileSync, readSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PMTiles, type RangeResponse, type Source } from "pmtiles";
import { OVERLAY_REGISTRY } from "../overlayRegistry";

const FILE = "public/police_justice/crime_area_monthly/crime_area_monthly.pmtiles";
const SHA256 = "3f47f175cb4e31bc40c9eb981371ad04d76a92bb73e9d80564e82c4b9efdc25a";

class NodeFileSource implements Source {
  private fd: number;
  constructor(private path: string) { this.fd = openSync(path, "r"); }
  getKey() { return this.path; }
  async getBytes(offset: number, length: number): Promise<RangeResponse> {
    const buffer = Buffer.alloc(length);
    readSync(this.fd, buffer, 0, length, offset);
    return { data: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer };
  }
}

describe("crimeAreaMonthly static PMTiles", () => {
  it("ships the registered 368-township archive instead of silently rendering no data", async () => {
    expect(existsSync(FILE), `${FILE} missing`).toBe(true);
    expect(statSync(FILE).size).toBe(4_792_305);
    expect(createHash("sha256").update(readFileSync(FILE)).digest("hex")).toBe(SHA256);

    const config = OVERLAY_REGISTRY.find((item) => item.id === "crimeAreaMonthly");
    expect(config?.sourceUrl).toBe("./police_justice/crime_area_monthly/crime_area_monthly.pmtiles");
    expect(config?.pmtiles).toEqual({ sourceLayer: "crime_area_monthly", minzoom: 5, maxzoom: 12 });

    const archive = new PMTiles(new NodeFileSource(FILE));
    const [header, metadata] = await Promise.all([
      archive.getHeader(),
      archive.getMetadata() as Promise<{ vector_layers?: { id: string }[]; tilestats?: { layers?: { layer: string; count: number }[] } }>,
    ]);
    expect([header.specVersion, header.tileType, header.minZoom, header.maxZoom]).toEqual([3, 1, 5, 12]);
    expect(metadata.vector_layers?.map((layer) => layer.id)).toEqual(["crime_area_monthly"]);
    expect(metadata.tilestats?.layers?.find((layer) => layer.layer === "crime_area_monthly")?.count).toBe(368);
  });
});
