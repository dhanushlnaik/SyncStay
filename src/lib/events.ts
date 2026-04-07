import { EventEmitter } from "node:events";

export type StreamEventType =
  | "booking.created"
  | "inventory.updated"
  | "sync.log.created"
  | "sync.job.status";

export type StreamEvent = {
  type: StreamEventType;
  payload: Record<string, unknown>;
  timestamp: string;
};

const bus = new EventEmitter();

export function publishEvent(event: StreamEvent) {
  bus.emit("event", event);
}

export function subscribeEvents(handler: (event: StreamEvent) => void) {
  bus.on("event", handler);

  return () => {
    bus.off("event", handler);
  };
}
