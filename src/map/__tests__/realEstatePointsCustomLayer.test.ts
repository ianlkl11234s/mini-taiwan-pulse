import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Map as MapboxMap } from "mapbox-gl";

const scenes = vi.hoisted(() => ({
  instances: [] as Array<{
    init: ReturnType<typeof vi.fn>;
    setBuffer: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
    applyState: ReturnType<typeof vi.fn>;
    render: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock("../../three/RealEstatePointsScene", () => ({
  RealEstatePointsScene: class {
    init = vi.fn();
    setBuffer = vi.fn();
    dispose = vi.fn();
    applyState = vi.fn();
    render = vi.fn();
    constructor() { scenes.instances.push(this); }
  },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

async function flush() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

function map() {
  const triggerRepaint = vi.fn();
  return {
    map: { triggerRepaint, getZoom: () => 8 } as unknown as MapboxMap,
    triggerRepaint,
  };
}

async function subject() {
  vi.resetModules();
  return import("../realEstatePointsCustomLayer");
}

beforeEach(() => { scenes.instances.length = 0; });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("real estate point buffer lifecycle", () => {
  it("移除後延遲 buffer 完成不會再寫入 scene 或觸發已移除 map", async () => {
    const result = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn(() => result.promise));
    const { createRealEstatePointsLayer } = await subject();
    const layer = createRealEstatePointsLayer();
    const instanceMap = map();
    layer.onAdd!(instanceMap.map, {} as WebGL2RenderingContext);
    const instance = scenes.instances[0]!;
    layer.onRemove!(instanceMap.map, {} as WebGL2RenderingContext);
    result.resolve(new Response(new Float32Array([1, 2, 3, 4, 5]).buffer, { status: 200 }));
    await flush();

    expect(instance.setBuffer).not.toHaveBeenCalled();
    expect(instanceMap.triggerRepaint).not.toHaveBeenCalled();
    expect(instance.dispose).toHaveBeenCalledOnce();
  });

  it("兩個 instance 共用同一個 inflight 讀取", async () => {
    const result = deferred<Response>();
    const fetchMock = vi.fn(() => result.promise);
    vi.stubGlobal("fetch", fetchMock);
    const { createRealEstatePointsLayer } = await subject();
    const first = createRealEstatePointsLayer();
    const second = createRealEstatePointsLayer();
    const firstScene = scenes.instances[0]!;
    const secondScene = scenes.instances[1]!;
    const firstMap = map();
    const secondMap = map();
    first.onAdd!(firstMap.map, {} as WebGL2RenderingContext);
    second.onAdd!(secondMap.map, {} as WebGL2RenderingContext);
    result.resolve(new Response(new Float32Array([1, 2, 3, 4, 5]).buffer, { status: 200 }));
    await flush();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(firstScene.setBuffer).toHaveBeenCalledOnce();
    expect(secondScene.setBuffer).toHaveBeenCalledOnce();
    expect(firstScene.setBuffer.mock.calls[0]![0]).toBe(secondScene.setBuffer.mock.calls[0]![0]);
    expect([...firstScene.setBuffer.mock.calls[0]![0] as Float32Array]).toEqual([1, 2, 3, 4, 5]);
    expect(firstMap.triggerRepaint).toHaveBeenCalledOnce();
    expect(secondMap.triggerRepaint).toHaveBeenCalledOnce();
  });

  it("HTTP 失敗不快取 rejected promise，下一次可重新讀取", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(new Float32Array([1, 2, 3, 4, 5]).buffer, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { createRealEstatePointsLayer } = await subject();
    createRealEstatePointsLayer().onAdd!(map().map, {} as WebGL2RenderingContext);
    await flush();
    const retryMap = map();
    createRealEstatePointsLayer().onAdd!(retryMap.map, {} as WebGL2RenderingContext);
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(scenes.instances[1]!.setBuffer).toHaveBeenCalledOnce();
    expect(retryMap.triggerRepaint).toHaveBeenCalledOnce();
  });
});
