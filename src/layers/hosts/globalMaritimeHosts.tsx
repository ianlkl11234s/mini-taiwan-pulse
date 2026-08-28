import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";
import { useGlobalMaritimeLayers } from "../../hooks/useGlobalMaritimeLayers";
import { useGfwHourlyGridLayer } from "../../hooks/useGfwHourlyGridLayer";
import { useGfwHourlyTracksLayer } from "../../hooks/useGfwHourlyTracksLayer";
import { useGfwV4ShadowTracksLayer } from "../../hooks/useGfwV4ShadowTracksLayer";
import { isGfwV4ShadowRuntimeEnabled } from "../../data/gfwV4ShadowTracksLoader";
import type { TrackBucket } from "../../gfw-v4-bench/types";
import { useGfwFishingEffortLayer } from "../../hooks/useGfwFishingEffortLayer";
import { useGfwDarkVesselsLayer } from "../../hooks/useGfwDarkVesselsLayer";
import { paramBool, paramNum, useLayerParams } from "../layerParamsAccess";

export const GlobalMaritimeHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGlobalMaritimeLayers");
  const aisValues = useLayerParams("aisstreamVessels");
  const gfwValues = useLayerParams("gfwVesselPresence");
  useGlobalMaritimeLayers(
    deps.mapRef,
    deps.layerVisibility.aisstreamVessels,
    deps.layerVisibility.gfwVesselPresence,
    paramNum(aisValues, "aisstreamVessels", "aisstreamVesselsOpacity"),
    paramNum(gfwValues, "gfwVesselPresence", "gfwVesselPresenceOpacity"),
  );
  return null;
};

export const GfwHourlyGridHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGfwHourlyGridLayer");
  const values = useLayerParams("gfwHourlyGrid");
  useGfwHourlyGridLayer(
    deps.mapRef,
    deps.layerVisibility.gfwHourlyGrid,
    paramNum(values, "gfwHourlyGrid", "gfwHourlyGridOpacity"),
  );
  return null;
};

export const GfwHourlyTracksHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGfwHourlyTracksLayer");
  const values = useLayerParams("gfwHourlyTracks");
  const shadowEnabled = isGfwV4ShadowRuntimeEnabled(import.meta.env.DEV);
  const bucketParams: ReadonlyArray<readonly [TrackBucket, string]> = [
    ["cargo", "gfwHourlyTracksCargo"],
    ["tanker", "gfwHourlyTracksTanker"],
    ["passenger", "gfwHourlyTracksPassenger"],
    ["fishing", "gfwHourlyTracksFishing"],
    ["other", "gfwHourlyTracksOther"],
  ];
  const enabledBuckets = bucketParams
    .filter(([, name]) => paramBool(values, "gfwHourlyTracks", name))
    .map(([bucket]) => bucket);
  useGfwHourlyTracksLayer(
    deps.mapRef,
    deps.layerVisibility.gfwHourlyTracks && !shadowEnabled,
    paramNum(values, "gfwHourlyTracks", "gfwHourlyTracksOpacity"),
    paramNum(values, "gfwHourlyTracks", "gfwHourlyTracksWindow"),
    deps.isDarkTheme,
  );
  useGfwV4ShadowTracksLayer(
    deps.mapRef,
    deps.layerVisibility.gfwHourlyTracks && shadowEnabled,
    paramNum(values, "gfwHourlyTracks", "gfwHourlyTracksOpacity"),
    paramNum(values, "gfwHourlyTracks", "gfwHourlyTracksWindow"),
    enabledBuckets,
    deps.isDarkTheme,
  );
  return null;
};

export const GfwFishingEffortHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGfwFishingEffortLayer");
  const values = useLayerParams("gfwFishingEffort");
  useGfwFishingEffortLayer(
    deps.mapRef,
    deps.layerVisibility.gfwFishingEffort,
    paramNum(values, "gfwFishingEffort", "gfwFishingEffortOpacity"),
  );
  return null;
};

export const GfwDarkVesselsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useGfwDarkVesselsLayer");
  const values = useLayerParams("gfwDarkVessels");
  useGfwDarkVesselsLayer(
    deps.mapRef,
    deps.layerVisibility.gfwDarkVessels,
    paramNum(values, "gfwDarkVessels", "gfwDarkVesselsOpacity"),
  );
  return null;
};
