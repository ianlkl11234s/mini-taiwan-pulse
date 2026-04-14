import { useEffect, useRef, useState } from "react";
import type { RailData, RailTrain } from "../types";
import { RailEngine } from "../engines/RailEngine";
import { TraTrainEngine } from "../engines/TraTrainEngine";
import { timeStore } from "../state/timeStore";

export function useRailEngine(
  railData: RailData | null,
  enabled = true,
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

  // 訂閱 timeStore 計算列車位置（不開獨立 RAF）
  // 暫停時 timeStore 不通知 → engine 不計算 → 省 CPU
  useEffect(() => {
    if (!enabled || (!railEngineRef.current && !traEngineRef.current)) return;
    let lastCountUpdate = 0;

    const update = (now: number) => {
      const allTrains: RailTrain[] = [];
      if (railEngineRef.current) {
        const r = railEngineRef.current.update(now);
        for (let i = 0; i < r.length; i++) allTrains.push(r[i]!);
      }
      if (traEngineRef.current) {
        const t = traEngineRef.current.update(now);
        for (let i = 0; i < t.length; i++) allTrains.push(t[i]!);
      }
      activeTrainsRef.current = allTrains;

      // 每 500ms 才更新一次計數（給 UI 顯示用）
      const ts = performance.now();
      if (ts - lastCountUpdate > 500) {
        lastCountUpdate = ts;
        setTrainCount(allTrains.length);
      }
    };

    update(timeStore.getTime()); // 初始化
    return timeStore.subscribe(update);
  }, [railData, enabled]);

  // 停用時清空計數
  useEffect(() => {
    if (!enabled) {
      activeTrainsRef.current = [];
      setTrainCount(0);
    }
  }, [enabled]);

  return { trainCount, activeTrainsRef };
}
