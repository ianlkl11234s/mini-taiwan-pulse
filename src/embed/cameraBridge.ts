export const EMBED_CAMERA_MESSAGE_TYPE = "mini-taiwan-pulse:camera";
export const EMBED_CAMERA_REQUEST_TYPE = "mini-taiwan-pulse:camera-request";

export interface EmbedCameraSnapshot {
  lng: number;
  lat: number;
  zoom: number;
  pitch: number;
  bearing: number;
}

export interface EmbedCameraMessage {
  type: typeof EMBED_CAMERA_MESSAGE_TYPE;
  version: 1;
  camera: EmbedCameraSnapshot;
}

export function isEmbedCameraRequest(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const request = value as { type?: unknown; version?: unknown };
  return request.type === EMBED_CAMERA_REQUEST_TYPE && request.version === 1;
}

interface CameraReadable {
  getCenter(): { lng: number; lat: number };
  getZoom(): number;
  getPitch(): number;
  getBearing(): number;
}

interface MessageTarget {
  postMessage(message: EmbedCameraMessage, targetOrigin: string): void;
}

export function readEmbedCamera(map: CameraReadable): EmbedCameraSnapshot {
  const center = map.getCenter();
  return {
    lng: center.lng,
    lat: center.lat,
    zoom: map.getZoom(),
    pitch: map.getPitch(),
    bearing: map.getBearing(),
  };
}

export function postEmbedCamera(map: CameraReadable, target: MessageTarget): EmbedCameraMessage {
  const message: EmbedCameraMessage = {
    type: EMBED_CAMERA_MESSAGE_TYPE,
    version: 1,
    camera: readEmbedCamera(map),
  };
  target.postMessage(message, "*");
  return message;
}
