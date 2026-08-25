import { useEffect, useState } from "react";

type NoticeListener = (message: string) => void;
const listeners = new Set<NoticeListener>();

/** 發佈不會阻斷地圖操作的短暫通知。 */
export function showTransientNotice(message: string): void {
  for (const listener of listeners) listener(message);
}

export function TransientNotice() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const listener: NoticeListener = (next) => {
      if (timer) clearTimeout(timer);
      setMessage(next);
      timer = setTimeout(() => setMessage(null), 3600);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (!message) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: 28,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 3000,
        padding: "9px 16px",
        background: "rgba(0,0,0,0.82)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        border: "1px solid rgba(255,255,255,0.14)",
        borderRadius: 10,
        color: "#E5E7EB",
        fontSize: 13,
        fontFamily: "Inter, system-ui, sans-serif",
        whiteSpace: "nowrap",
        pointerEvents: "none",
        boxShadow: "0 6px 24px rgba(0,0,0,0.35)",
      }}
    >
      {message}
    </div>
  );
}
