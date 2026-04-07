"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Building2,
  CalendarCheck2,
  CheckCircle2,
  CircleDot,
  LineChart,
  Lock,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#solutions", label: "Solutions" },
  { href: "#resources", label: "Resources" },
  { href: "#pricing", label: "Pricing" },
];

const channels = ["MakeMyTrip", "Agoda", "Goibibo", "Airbnb", "Booking.com", "Expedia", "Cleartrip"];

const features = [
  {
    icon: Workflow,
    title: "Multi-Channel Dispatch",
    description: "Push inventory, rate, and booking state changes across seven channels in seconds.",
  },
  {
    icon: Lock,
    title: "Conflict-Safe Allocation",
    description: "First booking wins with transactional date-range locking and deterministic rejection events.",
  },
  {
    icon: Activity,
    title: "Live Operational Trace",
    description: "SSE timelines show every mutation from booking intake to per-channel sync outcome.",
  },
  {
    icon: ShieldCheck,
    title: "Approval & KYC Guardrails",
    description: "OTP verification, onboarding review queues, and role-based controls for safe activation.",
  },
  {
    icon: LineChart,
    title: "Reliability Console",
    description: "DLQ replay, reconciliation runs, and SLA metrics for enterprise-grade confidence.",
  },
  {
    icon: CalendarCheck2,
    title: "Inventory Calendar Core",
    description: "Room-type x date intelligence with rules, blocks, and updates from one source of truth.",
  },
];

function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

export function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden pb-20">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-10rem] top-[-10rem] h-[24rem] w-[24rem] rounded-full bg-[radial-gradient(circle,rgba(153,69,255,0.22),transparent_70%)] blur-2xl" />
        <div className="absolute right-[-10rem] top-[-6rem] h-[24rem] w-[24rem] rounded-full bg-[radial-gradient(circle,rgba(128,236,255,0.15),transparent_72%)] blur-2xl" />
      </div>

      <div className="pointer-events-none absolute inset-0 grid-overlay opacity-18" />

      <div className="relative mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <FadeIn>
          <header className="rounded-2xl border border-[var(--border)]/80 bg-[rgba(10,14,33,0.7)] px-4 py-3 backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[rgba(28,36,74,0.85)] text-[var(--accent)]">
                  <Building2 className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-serif text-2xl leading-none text-[var(--text-primary)]">SyncStay</p>
                  <p className="text-xs text-[var(--text-muted)]">Real-Time Hotel Distribution Control</p>
                </div>
              </div>

              <nav className="hidden items-center gap-8 lg:flex">
                {navLinks.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    className="text-sm text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
                  >
                    {link.label}
                  </a>
                ))}
              </nav>

              <div className="flex items-center gap-2">
                <Button asChild variant="ghost" size="sm">
                  <Link href="/auth/sign-in">Log In</Link>
                </Button>
                <Button asChild size="sm" className="hidden sm:inline-flex">
                  <Link href="/auth/sign-up">Join Now</Link>
                </Button>
              </div>
            </div>
          </header>
        </FadeIn>

        <section className="relative mt-10 grid items-center gap-12 lg:grid-cols-[1.06fr_0.94fr]">
          <div>
            <FadeIn delay={0.06}>
              <Badge variant="accent" className="px-3 py-1 text-[11px] tracking-wide uppercase">
                <Sparkles className="mr-1 h-3.5 w-3.5" />
                India OTA Stack Focus
              </Badge>
            </FadeIn>

            <FadeIn delay={0.12}>
              <h1 className="mt-4 font-serif text-5xl leading-[1.04] text-[var(--text-primary)] sm:text-6xl lg:text-7xl xl:text-8xl">
                Control every channel
                <span className="mt-1 block bg-[linear-gradient(92deg,#9945ff_8%,#6f7aff_46%,#80ecff_92%)] bg-clip-text text-transparent">
                  in real time
                </span>
              </h1>
            </FadeIn>

            <FadeIn delay={0.18}>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-[var(--text-secondary)] sm:text-lg">
                SyncStay gives hotels one operational command center for inventory, bookings, and OTA sync.
                Prevent overbooking, trace every update, and run with reliability-first guardrails.
              </p>
            </FadeIn>

            <FadeIn delay={0.24}>
              <div className="mt-8 flex flex-wrap items-center gap-3 lg:mt-12">
                <Button asChild size="lg" className="gap-2">
                  <Link href="/auth/sign-up">
                    Start for free
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/auth/sign-in">Open Dashboard</Link>
                </Button>
              </div>
            </FadeIn>

            <FadeIn delay={0.28}>
              <p className="mt-4 text-xs text-[var(--text-muted)] sm:text-sm">
                Already joined? <Link href="/auth/sign-in" className="text-[var(--text-primary)] hover:underline">Sign in</Link>
              </p>
            </FadeIn>
          </div>

          <FadeIn delay={0.2}>
            <div className="relative">
              <div className="pointer-events-none absolute -inset-8 rounded-[2rem] bg-[radial-gradient(circle,rgba(153,69,255,0.3),transparent_62%)] blur-2xl" />

              <Card className="relative space-y-5 border-[var(--accent)]/35 bg-[linear-gradient(165deg,rgba(28,36,74,0.85),rgba(10,14,33,0.9))] p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">Live Sync Pulse</p>
                    <CardTitle className="mt-1 font-serif text-2xl">Control Center</CardTitle>
                  </div>
                  <Badge variant="accent" className="gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Stable
                  </Badge>
                </div>

                <div className="space-y-2">
                  {[
                    "booking.created • Booking.com • CONFIRMED",
                    "inventory.locked • Deluxe King • 3 nights",
                    "sync.dispatch • 7 channels • QUEUED",
                    "sync.job.status • 6 SUCCESS • 1 PROCESSING",
                  ].map((item) => (
                    <div
                      key={item}
                      className="flex items-center gap-2 rounded-xl border border-[var(--border)]/80 bg-[rgba(24,31,63,0.72)] px-3 py-2"
                    >
                      <CircleDot className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                      <p className="text-xs text-[var(--text-secondary)]">{item}</p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-xl border border-[var(--border)] bg-[rgba(21,28,56,0.72)] px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">p95 latency</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">740ms</p>
                  </div>
                  <div className="rounded-xl border border-[var(--border)] bg-[rgba(21,28,56,0.72)] px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]">retry rate</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">1.3%</p>
                  </div>
                </div>
              </Card>
            </div>
          </FadeIn>
        </section>

        <section id="solutions" className="mt-8">
          <div className="flex flex-wrap gap-2">
            {channels.map((channel) => (
              <span
                key={channel}
                className="rounded-full border border-[var(--border)] bg-[rgba(18,24,49,0.82)] px-3 py-1.5 text-xs text-[var(--text-secondary)]"
              >
                {channel}
              </span>
            ))}
          </div>
        </section>

        <section id="features" className="mt-14 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <FadeIn key={feature.title} delay={0.08 + index * 0.03}>
                <Card className="h-full space-y-3 border-[var(--border)] transition hover:-translate-y-0.5 hover:border-[var(--accent)]/45">
                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[rgba(27,34,69,0.75)] text-[var(--accent)]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                  <CardDescription className="leading-relaxed">{feature.description}</CardDescription>
                </Card>
              </FadeIn>
            );
          })}
        </section>

        <section id="resources" className="mt-14 rounded-2xl border border-[var(--border)] bg-[linear-gradient(135deg,rgba(153,69,255,0.16),rgba(8,12,28,0.88)_58%,rgba(128,236,255,0.12))] p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl space-y-2">
              <h2 className="font-serif text-4xl text-[var(--text-primary)]">Reduce Overbooking Across OTAs</h2>
              <p className="text-sm text-[var(--text-secondary)] md:text-base">
                Queue-backed sync, reliability workflows, and a premium operations UI built for real hotel teams.
              </p>
            </div>
            <div className="flex gap-3" id="pricing">
              <Button asChild>
                <Link href="/auth/sign-up">Create Workspace</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/auth/sign-in">Log In</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
