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
  const activeTrainsRef = useRef<RailTrain[]>([]);
  // 只用於 UI 顯示數字，throttle 更新避免每幀 re-render
  const [trainCount, setTrainCount] = useState(0);

  // 初始化 RailEngine + TraTrainEngine
  useEffect(() => {
    if (railData) {
      railEngineRef.current = new RailEngine(railData.systems);
      traEngineRef.current = railData.traData
        ? new TraTrainEngine(railData.traData)
        : null;
    }
  }, [railData]);

  // 每幀更新軌道列車（只寫 ref，不觸發 re-render）
  useEffect(() => {
    if (!railEngineRef.current && !traEngineRef.current) return;
    let animId: number;
    let lastCountUpdate = 0;

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

      // 每 500ms 才更新一次計數（給 UI 顯示用）
      const ts = performance.now();
      if (ts - lastCountUpdate > 500) {
        lastCountUpdate = ts;
        setTrainCount(allTrains.length);
      }

      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [railData, timeRef]);

  return { trainCount, activeTrainsRef };
}
