import { useEffect, useState } from "react";
import { loadTemperatureGrid, type TemperatureGridData } from "../data/temperatureLoader";
import type { TimeRange } from "../types";

export function useTemperatureData(enabled: boolean) {
  const [data, setData] = useState<TemperatureGridData | null>(null);
  const [loading, setLoading] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>({ start: 0, end: 0 });

  useEffect(() => {
    if (!enabled) return;  // boot lazy：圖層關閉不抓
    setLoading(true);
    loadTemperatureGrid()
      .then((d) => {
        setData(d);
        if (d.frames.length > 0) {
          setTimeRange({
            start: d.frames[0]!.time,
            end: d.frames[d.frames.length - 1]!.time,
          });
        }
      })
      .catch((err) => console.warn("Temperature grid data:", err))
      .finally(() => setLoading(false));
  }, [enabled]);

  return { temperatureData: data, temperatureLoading: loading, temperatureTimeRange: timeRange };
}
