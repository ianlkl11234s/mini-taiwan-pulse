import { useEffect, useState } from "react";
import { loadTemperatureGrid, type TemperatureGridData } from "../data/temperatureLoader";

export function useTemperatureData() {
  const [data, setData] = useState<TemperatureGridData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    loadTemperatureGrid()
      .then(setData)
      .catch((err) => console.warn("Temperature grid data:", err))
      .finally(() => setLoading(false));
  }, []);

  return { temperatureData: data, temperatureLoading: loading };
}
