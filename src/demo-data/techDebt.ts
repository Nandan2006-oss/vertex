import type { TechDebtItem } from "./types";

/**
 * Ranked technical-debt registry for vertex/control-plane.
 * Sorted by riskScore descending in the UI.
 */
export const techDebt: TechDebtItem[] = [
  {
    id: "billing-retry-loop",
    hotspot: "Billing Retry Loop",
    riskScore: 87,
    agingDebt: "47 days",
    filePath: "src/services/billing/payment/handler.ts",
    detail: "Unbounded retries with no jitter — cascading failure on provider outages.",
  },
  {
    id: "scheduler-lease-manager",
    hotspot: "Scheduler Lease Manager",
    riskScore: 64,
    agingDebt: "23 days",
    filePath: "src/services/scheduler/lease/manager.ts",
    detail: "Lease renewal ignores context cancellation; slow drains during deploys.",
  },
  {
    id: "gateway-rate-limit",
    hotspot: "Gateway Rate Limit",
    riskScore: 52,
    agingDebt: "18 days",
    filePath: "src/services/gateway/middleware/rate_limit.go",
    detail: "In-memory limiter resets on every replica restart — inconsistent quotas.",
  },
  {
    id: "ingest-buffer-pool",
    hotspot: "Ingest Buffer Pool",
    riskScore: 38,
    agingDebt: "12 days",
    filePath: "src/services/ingest/buffer/pool.go",
    detail: "Fixed-size pool under-allocated for peak partitions; backpressure stalls.",
  },
  {
    id: "worker-reconnect",
    hotspot: "Worker Reconnect",
    riskScore: 29,
    agingDebt: "8 days",
    filePath: "src/services/worker/connection/retry.go",
    detail: "Exponential backoff caps too low — reconnects thundering herd on blips.",
  },
];
