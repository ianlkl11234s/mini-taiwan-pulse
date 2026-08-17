import * as z from "zod/v4";

export const PROTOCOL_VERSION = "1" as const;
export const MAX_SCENE_LAYERS = 128;
export const MAX_MAP_STATE_LAYERS = 512;
export const MAX_LAYER_ID_LENGTH = 128;
export const MAX_LAYER_PARAMS = 64;

const idSchema = z.string().trim().min(1).max(MAX_LAYER_ID_LENGTH);
const shortTextSchema = z.string().max(512);
const longitudeSchema = z.number().min(-180).max(180);
const latitudeSchema = z.number().min(-90).max(90);
const sessionIdSchema = z.string().trim().min(1).max(128);
const commandIdSchema = z.string().trim().min(1).max(128);

export const protocolVersionSchema = z.literal(PROTOCOL_VERSION);

export const coordinateSchema = z.tuple([longitudeSchema, latitudeSchema]);

export const boundsSchema = z
  .tuple([longitudeSchema, latitudeSchema, longitudeSchema, latitudeSchema])
  .refine(([west, south, east, north]) => west <= east && south <= north, {
    message: "bounds must be ordered as west, south, east, north",
  });

export const cameraSchema = z.strictObject({
  center: coordinateSchema.optional(),
  zoom: z.number().min(0).max(24).optional(),
  pitch: z.number().min(0).max(85).optional(),
  bearing: z.number().min(-180).max(180).optional(),
  bounds: boundsSchema.optional(),
  padding: z.number().min(0).max(2_048).optional(),
});

export const layerParamValueSchema = z.union([
  z.string().max(2_048),
  z.number(),
  z.boolean(),
]);

export const layerParamsSchema = z
  .record(z.string().trim().min(1).max(128), layerParamValueSchema)
  .refine((params) => Object.keys(params).length <= MAX_LAYER_PARAMS, {
    message: `params may contain at most ${MAX_LAYER_PARAMS} entries`,
  });

export const sceneLayerSchema = z.strictObject({
  id: idSchema,
  visible: z.boolean(),
  opacity: z.number().min(0).max(1).optional(),
  params: layerParamsSchema.optional(),
});

export const mapTimeSchema = z.strictObject({
  at: z.string().datetime({ offset: true }).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  playing: z.boolean().optional(),
  speed: z.number().positive().max(64).optional(),
});

export const mapSelectionSchema = z.strictObject({
  layerId: idSchema,
  featureIds: z.array(z.string().min(1).max(256)).max(1_000),
});

export const resultOverlaySchema = z.strictObject({
  analysisId: z.string().trim().min(1).max(128),
  stylePreset: z.string().trim().min(1).max(64),
});

export const datasetReferenceSchema = z.strictObject({
  datasetId: z.string().trim().min(1).max(128),
  title: z.string().trim().min(1).max(256).optional(),
  url: z.string().url().max(2_048).optional(),
  version: z.string().trim().min(1).max(128).optional(),
});

export const mapSceneSchema = z.strictObject({
  camera: cameraSchema.optional(),
  layers: z.array(sceneLayerSchema).max(MAX_SCENE_LAYERS),
  time: mapTimeSchema.optional(),
  selection: mapSelectionSchema.optional(),
  resultOverlay: resultOverlaySchema.optional(),
  narration: z.string().max(4_000).optional(),
  citations: z.array(datasetReferenceSchema).max(64).optional(),
});

export const mapStateLayerSchema = z.strictObject({
  id: idSchema,
  visible: z.boolean(),
  opacity: z.number().min(0).max(1).optional(),
  params: layerParamsSchema.optional(),
});

export const mapStateSummarySchema = z.strictObject({
  revision: z.number().int().nonnegative(),
  camera: cameraSchema,
  layers: z.array(mapStateLayerSchema).max(MAX_MAP_STATE_LAYERS),
  time: mapTimeSchema.optional(),
  selection: mapSelectionSchema.optional(),
  resultOverlay: resultOverlaySchema.optional(),
});

export const deniedTargetSchema = z.strictObject({
  target: shortTextSchema,
  reason: z.string().min(1).max(1_024),
});

export const mapCommandResultSchema = z.strictObject({
  commandId: commandIdSchema,
  success: z.boolean(),
  previousRevision: z.number().int().nonnegative(),
  newRevision: z.number().int().nonnegative(),
  applied: z.array(shortTextSchema).max(256),
  denied: z.array(deniedTargetSchema).max(256),
  warnings: z.array(z.string().max(1_024)).max(256),
  actualState: mapStateSummarySchema,
});

export const browserClientIdentitySchema = z.strictObject({
  name: z.string().trim().min(1).max(128),
  version: z.string().trim().min(1).max(64),
});

export const browserHelloEnvelopeSchema = z.strictObject({
  type: z.literal("hello"),
  protocolVersion: protocolVersionSchema,
  token: z.string().min(16).max(512),
  sessionId: sessionIdSchema,
  client: browserClientIdentitySchema,
});

export const getMapStateCommandSchema = z.strictObject({
  type: z.literal("get_map_state"),
});

export const applySceneCommandSchema = z.strictObject({
  type: z.literal("apply_scene"),
  scene: mapSceneSchema,
  expectedRevision: z.number().int().nonnegative().optional(),
});

export const browserMapCommandSchema = z.discriminatedUnion("type", [
  getMapStateCommandSchema,
  applySceneCommandSchema,
]);

export const browserCommandEnvelopeSchema = z.strictObject({
  type: z.literal("command"),
  protocolVersion: protocolVersionSchema,
  commandId: commandIdSchema,
  command: browserMapCommandSchema,
});

export const browserCommandErrorSchema = z.strictObject({
  code: z.string().trim().min(1).max(64),
  message: z.string().min(1).max(1_024),
});

export const browserResultSuccessEnvelopeSchema = z.strictObject({
  type: z.literal("result"),
  protocolVersion: protocolVersionSchema,
  commandId: commandIdSchema,
  ok: z.literal(true),
  result: z.union([mapStateSummarySchema, mapCommandResultSchema]),
});

export const browserResultErrorEnvelopeSchema = z.strictObject({
  type: z.literal("result"),
  protocolVersion: protocolVersionSchema,
  commandId: commandIdSchema,
  ok: z.literal(false),
  error: browserCommandErrorSchema,
});

export const browserResultEnvelopeSchema = z.discriminatedUnion("ok", [
  browserResultSuccessEnvelopeSchema,
  browserResultErrorEnvelopeSchema,
]);

export const browserClientMessageSchema = z.union([
  browserHelloEnvelopeSchema,
  browserResultEnvelopeSchema,
]);

export const browserServerMessageSchema = browserCommandEnvelopeSchema;

export type Coordinate = z.infer<typeof coordinateSchema>;
export type Camera = z.infer<typeof cameraSchema>;
export type LayerParamValue = z.infer<typeof layerParamValueSchema>;
export type SceneLayer = z.infer<typeof sceneLayerSchema>;
export type MapScene = z.infer<typeof mapSceneSchema>;
export type MapStateLayer = z.infer<typeof mapStateLayerSchema>;
export type MapStateSummary = z.infer<typeof mapStateSummarySchema>;
export type MapCommandResult = z.infer<typeof mapCommandResultSchema>;
export type DatasetReference = z.infer<typeof datasetReferenceSchema>;
export type BrowserClientIdentity = z.infer<typeof browserClientIdentitySchema>;
export type BrowserHelloEnvelope = z.infer<typeof browserHelloEnvelopeSchema>;
export type GetMapStateCommand = z.infer<typeof getMapStateCommandSchema>;
export type ApplySceneCommand = z.infer<typeof applySceneCommandSchema>;
export type BrowserMapCommand = z.infer<typeof browserMapCommandSchema>;
export type BrowserCommandEnvelope = z.infer<typeof browserCommandEnvelopeSchema>;
export type BrowserCommandError = z.infer<typeof browserCommandErrorSchema>;
export type BrowserResultEnvelope = z.infer<typeof browserResultEnvelopeSchema>;
export type BrowserClientMessage = z.infer<typeof browserClientMessageSchema>;
export type BrowserServerMessage = z.infer<typeof browserServerMessageSchema>;
