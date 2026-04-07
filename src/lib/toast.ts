"use client";

export type ToastVariant = "success" | "error" | "info";

export type ToastPayload = {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  durationMs?: number;
};

const TOAST_EVENT = "syncstay:toast";

function makeToastId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function emitToast(input: Omit<ToastPayload, "id">) {
  if (typeof window === "undefined") return;

  const payload: ToastPayload = {
    id: makeToastId(),
    durationMs: 3200,
    ...input,
  };

  window.dispatchEvent(
    new CustomEvent<ToastPayload>(TOAST_EVENT, {
      detail: payload,
    }),
  );
}

export const toast = {
  success(title: string, description?: string) {
    emitToast({ title, description, variant: "success" });
  },
  error(title: string, description?: string) {
    emitToast({ title, description, variant: "error" });
  },
  info(title: string, description?: string) {
    emitToast({ title, description, variant: "info" });
  },
};

export { TOAST_EVENT };
