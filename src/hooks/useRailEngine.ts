import { useEffect, useRef, useState } from "react";
import type { RailData, RailTrain } from "../types";
import { RailEngine } from "../engines/RailEngine";
import { TraTrainEngine } from "../engines/TraTrainEngine";

export function useRailEngine(
  railData: RailData | null,
  timeRef: React.RefObject<number>,
) {
  const railEngineRef = useRef<RailEngine | null>(null);
  const traEngineRef = useRef<TraTrainEngine | null>(null);
  const [activeTrains, setActiveTrains] = useState<RailTrain[]>([]);
  const activeTrainsRef = useRef<RailTrain[]>(activeTrains);
  activeTrainsRef.current = activeTrains;

  // 初始化 RailEngine + TraTrainEngine
  useEffect(() => {
    if (railData) {
      railEngineRef.current = new RailEngine(railData.systems);
      traEngineRef.current = railData.traData
        ? new TraTrainEngine(railData.traData)
        : null;
    }
  }, [railData]);

  // 每幀更新軌道列車
  useEffect(() => {
    if (!railEngineRef.current && !traEngineRef.current) return;
    let animId: number;
    const tick = () => {
      const now = timeRef.current;
      let allTrains: RailTrain[] = [];
      if (railEngineRef.current) {
        allTrains = railEngineRef.current.update(now);
      }
      if (traEngineRef.current) {
        allTrains = [...allTrains, ...traEngineRef.current.update(now)];
      }
      activeTrainsRef.current = allTrains;
      setActiveTrains(allTrains);
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [railData, timeRef]);

  return { activeTrains, activeTrainsRef };
}
