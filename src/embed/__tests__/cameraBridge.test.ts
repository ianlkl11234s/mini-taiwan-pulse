import { describe, expect, it, vi } from "vitest";
import {
  EMBED_CAMERA_MESSAGE_TYPE,
  EMBED_CAMERA_REQUEST_TYPE,
  isEmbedCameraRequest,
  postEmbedCamera,
  readEmbedCamera,
} from "../cameraBridge";

const map = {
  getCenter: () => ({ lng: 120.912345, lat: 23.765432 }),
  getZoom: () => 6.875,
  getPitch: () => 12.5,
  getBearing: () => -8.25,
};

describe("embed camera bridge", () => {
  it("reads the complete live camera without rounding the payload", () => {
    expect(readEmbedCamera(map)).toEqual({
      lng: 120.912345,
      lat: 23.765432,
      zoom: 6.875,
      pitch: 12.5,
      bearing: -8.25,
    });
  });

  it("posts a versioned message that article parents can identify", () => {
    const postMessage = vi.fn();
    const message = postEmbedCamera(map, { postMessage });

    expect(message.type).toBe(EMBED_CAMERA_MESSAGE_TYPE);
    expect(message.version).toBe(1);
    expect(postMessage).toHaveBeenCalledWith(message, "*");
  });

  it("accepts only the versioned request handshake", () => {
    expect(isEmbedCameraRequest({ type: EMBED_CAMERA_REQUEST_TYPE, version: 1 })).toBe(true);
    expect(isEmbedCameraRequest({ type: EMBED_CAMERA_REQUEST_TYPE, version: 2 })).toBe(false);
    expect(isEmbedCameraRequest({ type: EMBED_CAMERA_MESSAGE_TYPE, version: 1 })).toBe(false);
    expect(isEmbedCameraRequest(null)).toBe(false);
  });
});
