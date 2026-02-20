import { useCallback, useEffect, useRef, useState } from "react";

interface UseTimelineOptions {
  startTime: number;
  endTime: number;
}

interface UseTimelineReturn {
  currentTime: number;
  playing: boolean;
  speed: number;
  progress: number;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  setSpeed: (s: number) => void;
  seek: (time: number) => void;
  seekByProgress: (p: number) => void;
}

export function useTimeline({
  startTime,
  endTime,
}: UseTimelineOptions): UseTimelineReturn {
  const [currentTime, setCurrentTime] = useState(startTime);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(60); // 60x real-time
  const rafRef = useRef<number>(0);
  const lastFrameRef = useRef<number>(0);

  const duration = endTime - startTime;
  const progress = duration > 0 ? (currentTime - startTime) / duration : 0;

  useEffect(() => {
    setCurrentTime(startTime);
  }, [startTime]);

  useEffect(() => {
    if (!playing) return;

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
  }, [playing, speed, startTime, endTime]);

  const play = useCallback(() => setPlaying(true), []);
  const pause = useCallback(() => setPlaying(false), []);
  const toggle = useCallback(() => setPlaying((p) => !p), []);

  const seek = useCallback(
    (time: number) => {
      setCurrentTime(Math.max(startTime, Math.min(endTime, time)));
    },
    [startTime, endTime],
  );

  const seekByProgress = useCallback(
    (p: number) => {
      seek(startTime + p * duration);
    },
    [seek, startTime, duration],
  );

  return {
    currentTime,
    playing,
    speed,
    progress,
    play,
    pause,
    toggle,
    setSpeed,
    seek,
    seekByProgress,
  };
}
