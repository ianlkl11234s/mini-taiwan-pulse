import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";
import { useGlobalMaritimeLayers } from "../../hooks/useGlobalMaritimeLayers";
import { useGfwHourlyGridLayer } from "../../hooks/useGfwHourlyGridLayer";
import { useGfwHourlyTracksLayer } from "../../hooks/useGfwHourlyTracksLayer";
import { useGfwDarkVesselsLayer } from "../../hooks/useGfwDarkVesselsLayer";
import { paramNum, useLayerParams } from "../layerParamsAccess";

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
  useGfwHourlyTracksLayer(
    deps.mapRef,
    deps.layerVisibility.gfwHourlyTracks,
    paramNum(values, "gfwHourlyTracks", "gfwHourlyTracksOpacity"),
    paramNum(values, "gfwHourlyTracks", "gfwHourlyTracksWindow"),
    deps.isDarkTheme,
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
