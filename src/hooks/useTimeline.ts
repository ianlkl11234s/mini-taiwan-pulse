import { useCallback, useEffect, useRef, useState } from "react";
import type { TimeMode } from "../types";

interface UseTimelineOptions {
  startTime: number;
  endTime: number;
  timeMode?: TimeMode;
}

interface UseTimelineReturn {
  currentTime: number;
  playing: boolean;
  speed: number;
  progress: number;
  timeMode: TimeMode;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  setSpeed: (s: number) => void;
  seek: (time: number) => void;
  seekByProgress: (p: number) => void;
  setTimeMode: (mode: TimeMode) => void;
}

export function useTimeline({
  startTime,
  endTime,
  timeMode: initialTimeMode = "replay",
}: UseTimelineOptions): UseTimelineReturn {
  const [currentTime, setCurrentTime] = useState(startTime);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(60); // 60x real-time
  const [timeMode, setTimeMode] = useState<TimeMode>(initialTimeMode);
  const rafRef = useRef<number>(0);
  const lastFrameRef = useRef<number>(0);

  const duration = endTime - startTime;
  const progress = duration > 0 ? (currentTime - startTime) / duration : 0;

  // Replay: reset to start when startTime changes
  useEffect(() => {
    if (timeMode === "replay") {
      setCurrentTime(startTime);
    }
  }, [startTime, timeMode]);

  // Live mode: tick currentTime = Date.now()/1000
  useEffect(() => {
    if (timeMode !== "live") return;
    setPlaying(false); // live mode doesn't use play/pause

    const tick = () => {
      setCurrentTime(Date.now() / 1000);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [timeMode]);

  // Replay mode: animation loop
  useEffect(() => {
    if (timeMode !== "replay" || !playing) return;

    const animate = (now: number) => {
      if (lastFrameRef.current === 0) lastFrameRef.current = now;
      const dt = (now - lastFrameRef.current) / 1000; // 秒
      lastFrameRef.current = now;

      setCurrentTime((prev) => {
        const next = prev + dt * speed;
        if (next >= endTime) {
          setPlaying(false);
          return startTime; // loop back
        }
        return next;
      });

      rafRef.current = requestAnimationFrame(animate);
    };

    lastFrameRef.current = 0;
    rafRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(rafRef.current);
  }, [timeMode, playing, speed, startTime, endTime]);

  const play = useCallback(() => {
    if (timeMode === "replay") setPlaying(true);
  }, [timeMode]);
  const pause = useCallback(() => setPlaying(false), []);
  const toggle = useCallback(() => {
    if (timeMode === "replay") setPlaying((p) => !p);
  }, [timeMode]);

  const seek = useCallback(
    (time: number) => {
      if (timeMode === "replay") {
        setCurrentTime(Math.max(startTime, Math.min(endTime, time)));
      }
    },
    [timeMode, startTime, endTime],
  );

  const seekByProgress = useCallback(
    (p: number) => {
      seek(startTime + p * duration);
    },
    [seek, startTime, duration],
  );

  const handleSetTimeMode = useCallback((mode: TimeMode) => {
    setTimeMode(mode);
    if (mode === "replay") {
      setPlaying(false);
    }
  }, []);

  return {
    currentTime,
    playing,
    speed,
    progress,
    timeMode,
    play,
    pause,
    toggle,
    setSpeed,
    seek,
    seekByProgress,
    setTimeMode: handleSetTimeMode,
  };
}
