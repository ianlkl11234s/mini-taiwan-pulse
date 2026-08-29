import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";
import { useGlobalMaritimeLayers } from "../../hooks/useGlobalMaritimeLayers";
import { useGfwHourlyGridLayer } from "../../hooks/useGfwHourlyGridLayer";
import { useGfwHourlyTracksLayer } from "../../hooks/useGfwHourlyTracksLayer";
import { useGfwV4TracksLayer } from "../../hooks/useGfwV4TracksLayer";
import type { GfwV4TrackBucket } from "../../data/gfwV4SpatialTracksLoader";
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
  const bucketParams: ReadonlyArray<readonly [GfwV4TrackBucket, string]> = [
    ["FISHING", "gfwHourlyTracksFishing"],
    ["CARGO", "gfwHourlyTracksCargo"],
    ["PASSENGER", "gfwHourlyTracksPassenger"],
    ["CARRIER", "gfwHourlyTracksCarrier"],
    ["OTHER", "gfwHourlyTracksOther"],
    ["UNKNOWN", "gfwHourlyTracksUnknown"],
  ];
  const enabledBuckets = bucketParams
    .filter(([, name]) => paramBool(values, "gfwHourlyTracks", name))
    .map(([bucket]) => bucket);
  const formalReady = useGfwV4TracksLayer(
    deps.mapRef,
    deps.layerVisibility.gfwHourlyTracks,
    paramNum(values, "gfwHourlyTracks", "gfwHourlyTracksOpacity"),
    enabledBuckets,
    paramNum(values, "gfwHourlyTracks", "gfwHourlyTracksWindow"),
    deps.isDarkTheme,
  );
  // v2/v3 remains a no-data fallback only. It never wins when a verified formal
  // v4 root/release has loaded, and has no URL/DEV selector.
  useGfwHourlyTracksLayer(
    deps.mapRef,
    deps.layerVisibility.gfwHourlyTracks && !formalReady,
    paramNum(values, "gfwHourlyTracks", "gfwHourlyTracksOpacity"),
    paramNum(values, "gfwHourlyTracks", "gfwHourlyTracksWindow"),
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
