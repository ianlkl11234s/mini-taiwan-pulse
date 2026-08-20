import { useAnimalAdoptionLayer } from "../../hooks/useAnimalAdoptionLayer";
import { useAnimalShelterPressureLayer } from "../../hooks/useAnimalShelterPressureLayer";
import { useAnimalWelfarePointsLayer } from "../../hooks/useAnimalWelfarePointsLayer";
import { bumpHostRender, type LayerHostComponent } from "../layerHostDeps";
import { useKeyOverlayParams } from "../layerParamsAccess";

export const AnimalAdoptionHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useAnimalAdoptionLayer");
  const p = useKeyOverlayParams("animalAdoption");
  useAnimalAdoptionLayer(deps.mapRef, deps.layerVisibility.animalAdoption, p.animalAdoptionOpacity ?? 0.85, p.animalAdoptionScale ?? 1);
  return null;
};

export const AnimalShelterPressureHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useAnimalShelterPressureLayer");
  const p = useKeyOverlayParams("animalShelterPressure");
  useAnimalShelterPressureLayer(deps.mapRef, deps.layerVisibility.animalShelterPressure, p.animalShelterPressureOpacity ?? 0.78);
  return null;
};

export const AnimalWelfarePointsHost: LayerHostComponent = ({ deps }) => {
  bumpHostRender("useAnimalWelfarePointsLayer");
  const p = useKeyOverlayParams("animalWelfarePoints");
  useAnimalWelfarePointsLayer(
    deps.mapRef, deps.layerVisibility.animalWelfarePoints,
    p.animalWelfarePointsOpacity ?? 0.85, p.animalWelfarePointsScale ?? 1, p.animalWelfarePointsTypeIdx ?? 0,
  );
  return null;
};
