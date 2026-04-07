"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type RoomTypeOption = {
  id: string;
  name: string;
};

type StreamMessage = {
  id: string;
  event: string;
  at: string;
  details: string;
};

export function SimulationPanel({
  hotelId,
  roomTypes,
}: {
  hotelId: string;
  roomTypes: RoomTypeOption[];
}) {
  const today = useMemo(() => new Date(), []);
  const defaultCheckIn = today.toISOString().slice(0, 10);
  const defaultCheckOut = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [roomTypeId, setRoomTypeId] = useState(roomTypes[0]?.id ?? "");
  const [guestName, setGuestName] = useState("Demo Guest");
  const [checkInDate, setCheckInDate] = useState(defaultCheckIn);
  const [checkOutDate, setCheckOutDate] = useState(defaultCheckOut);
  const [bookingSource, setBookingSource] = useState("BOOKING_COM");
  const [running, setRunning] = useState(false);
  const [messages, setMessages] = useState<StreamMessage[]>([]);
  const [result, setResult] = useState<string>("Waiting for simulation...");

  const startStream = () => {
    const source = new EventSource(`/api/stream/events?hotelId=${hotelId}`);

    const capture = (eventName: string, data: string) => {
      setMessages((prev) => [
        {
          id: `${Date.now()}-${Math.random()}`,
          event: eventName,
          at: new Date().toLocaleTimeString(),
          details: data,
        },
        ...prev,
      ].slice(0, 20));
    };

    source.addEventListener("connected", (event) => {
      capture("connected", (event as MessageEvent).data);
    });

    source.addEventListener("sync.log.created", (event) => {
      capture("sync.log.created", (event as MessageEvent).data);
    });

    source.addEventListener("sync.job.status", (event) => {
      capture("sync.job.status", (event as MessageEvent).data);
    });

    source.addEventListener("heartbeat", () => {
      // Ignore heartbeat in timeline to reduce noise.
    });

    source.onerror = () => {
      capture("stream.error", "Connection interrupted");
      source.close();
    };

    return source;
  };

  const runSimulation = async () => {
    setRunning(true);
    setMessages([]);
    setResult("Submitting simulation booking...");

    const stream = startStream();

    try {
      const response = await fetch("/api/simulate/booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          hotelId,
          roomTypeId,
          guestName,
          checkInDate,
          checkOutDate,
          bookingSource,
          roomsBooked: 1,
          adults: 2,
          children: 0,
          autoSync: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setResult(data?.error?.message ?? "Simulation failed");
      } else {
        setResult(
          data.accepted
            ? `Booking confirmed (${data.booking.id.slice(0, 8)}), sync queued.`
            : `Booking rejected: ${data.reason ?? "overbooking"}`,
        );
      }
    } catch (error) {
      setResult(error instanceof Error ? error.message : "Unexpected simulation error");
    } finally {
      setTimeout(() => {
        stream.close();
      }, 10_000);
      setRunning(false);
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
      <Card className="space-y-4">
        <div>
          <CardTitle>Simulate Incoming Booking</CardTitle>
          <CardDescription>Trigger booking, inventory lock, and multi-channel sync flow.</CardDescription>
        </div>

        <label className="space-y-1 text-sm">
          <span className="text-[var(--text-secondary)]">Room Type</span>
          <select
            className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)]/75 px-3 text-sm text-[var(--text-primary)]"
            value={roomTypeId}
            onChange={(event) => setRoomTypeId(event.target.value)}
          >
            {roomTypes.map((roomType) => (
              <option key={roomType.id} value={roomType.id}>
                {roomType.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-[var(--text-secondary)]">Channel</span>
          <select
            className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)]/75 px-3 text-sm text-[var(--text-primary)]"
            value={bookingSource}
            onChange={(event) => setBookingSource(event.target.value)}
          >
            <option value="BOOKING_COM">Booking.com</option>
            <option value="AIRBNB">Airbnb</option>
            <option value="AGODA">Agoda</option>
            <option value="MAKEMYTRIP">MakeMyTrip</option>
            <option value="GOIBIBO">Goibibo</option>
            <option value="EXPEDIA">Expedia</option>
            <option value="CLEARTRIP">Cleartrip</option>
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-[var(--text-secondary)]">Guest Name</span>
          <Input value={guestName} onChange={(event) => setGuestName(event.target.value)} />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-sm">
            <span className="text-[var(--text-secondary)]">Check-in</span>
            <Input type="date" value={checkInDate} onChange={(event) => setCheckInDate(event.target.value)} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-[var(--text-secondary)]">Check-out</span>
            <Input type="date" value={checkOutDate} onChange={(event) => setCheckOutDate(event.target.value)} />
          </label>
        </div>

        <Button onClick={runSimulation} disabled={running || !roomTypeId}>
          {running ? "Simulating..." : "Run Simulation"}
        </Button>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardTitle>Simulation Result</CardTitle>
          <CardDescription className="mt-2 text-sm">{result}</CardDescription>
        </Card>

        <Card>
          <CardTitle>Live Event Flow</CardTitle>
          <CardDescription className="mb-3">Incoming booking to inventory update to channel sync logs</CardDescription>
          <div className="space-y-2">
            {messages.map((message, index) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.02 }}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3"
              >
                <p className="text-xs font-medium text-[var(--text-primary)]">
                  {message.event} <span className="text-[var(--text-muted)]">{message.at}</span>
                </p>
                <p className="mt-1 line-clamp-2 text-xs text-[var(--text-secondary)]">{message.details}</p>
              </motion.div>
            ))}

            {messages.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">Run a simulation to stream live sync events.</p>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
