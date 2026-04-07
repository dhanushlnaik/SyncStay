"use client";

import { useEffect, useRef, useState } from "react";

import type { ToastPayload } from "@/lib/toast";
import { TOAST_EVENT } from "@/lib/toast";

type ActiveToast = ToastPayload & {
  createdAt: number;
};

function variantClasses(variant: ToastPayload["variant"]) {
  if (variant === "success") {
    return "border-[var(--success)]/35 bg-[var(--success-soft)] text-[var(--success)]";
  }
  if (variant === "error") {
    return "border-[var(--error)]/35 bg-[var(--error-soft)] text-[var(--error)]";
  }
  return "border-[var(--accent)]/35 bg-[var(--accent-soft)] text-[var(--accent)]";
}

export function Toaster() {
  const [toasts, setToasts] = useState<ActiveToast[]>([]);
  const timeoutsRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const timeouts = timeoutsRef.current;

    function closeToast(id: string) {
      const timeout = timeouts.get(id);
      if (timeout) {
        window.clearTimeout(timeout);
        timeouts.delete(id);
      }
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }

    function onToast(event: Event) {
      const payload = (event as CustomEvent<ToastPayload>).detail;
      if (!payload) return;

      setToasts((prev) =>
        [
          ...prev,
          {
            ...payload,
            createdAt: Date.now(),
          },
        ].slice(-5),
      );

      const timeout = window.setTimeout(() => closeToast(payload.id), payload.durationMs ?? 3200);
      timeouts.set(payload.id, timeout);
    }

    window.addEventListener(TOAST_EVENT, onToast as EventListener);
    return () => {
      window.removeEventListener(TOAST_EVENT, onToast as EventListener);
      timeouts.forEach((timeout) => window.clearTimeout(timeout));
      timeouts.clear();
    };
  }, []);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[120] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto rounded-xl border px-3 py-2 shadow-sm backdrop-blur ${variantClasses(toast.variant)}`}
        >
          <p className="text-sm font-semibold">{toast.title}</p>
          {toast.description ? <p className="mt-0.5 text-xs opacity-90">{toast.description}</p> : null}
        </div>
      ))}
    </div>
  );
}
