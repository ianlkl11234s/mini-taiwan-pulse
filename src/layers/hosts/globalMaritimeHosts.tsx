import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";
import { useGlobalMaritimeLayers } from "../../hooks/useGlobalMaritimeLayers";
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
