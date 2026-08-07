import type { Commit } from "./types";

/**
 * Recent commit history for vertex/control-plane.
 * Hand-crafted to read like a real engineering log — mix of features,
 * fixes, refactors, chores; some deployed, some not.
 */
export const commits: Commit[] = [
  {
    hash: "3f1a9c2",
    message: "feat: add payment retry with exponential backoff and jitter",
    author: "mira.k",
    date: "2025-02-14T09:41:00Z",
    files: [
      "src/services/billing/payment/retry.ts",
      "src/services/billing/payment/handler.ts",
    ],
    deployed: true,
  },
  {
    hash: "8d2e7b1",
    message: "fix: honor context cancellation in scheduler lease renewal",
    author: "devon.c",
    date: "2025-02-13T16:22:00Z",
    files: ["src/services/scheduler/lease/manager.ts"],
    deployed: false,
  },
  {
    hash: "a04c5f9",
    message: "refactor: extract billing validation into dedicated module",
    author: "mira.k",
    date: "2025-02-13T11:05:00Z",
    files: [
      "src/services/billing/validation/schema.ts",
      "src/services/billing/payment/handler.ts",
    ],
    deployed: true,
  },
  {
    hash: "77b3e40",
    message: "chore: raise gateway rate-limit defaults for burst traffic",
    author: "sana.r",
    date: "2025-02-12T14:48:00Z",
    files: ["src/services/gateway/middleware/rate_limit.go"],
    deployed: false,
  },
  {
    hash: "e19a6d3",
    message: "fix: ingest buffer overflow on high-throughput partitions",
    author: "devon.c",
    date: "2025-02-12T08:33:00Z",
    files: [
      "src/services/ingest/buffer/pool.go",
      "src/services/ingest/partition/assigner.go",
    ],
    deployed: true,
  },
  {
    hash: "5c8f21a",
    message: "feat: add circuit breaker to worker connection pool",
    author: "sana.r",
    date: "2025-02-11T18:12:00Z",
    files: ["src/services/worker/connection/retry.go"],
    deployed: false,
  },
  {
    hash: "b2d9047",
    message: "test: integration coverage for billing payment pipeline",
    author: "mira.k",
    date: "2025-02-11T10:56:00Z",
    files: ["tests/billing/pipeline.integration.test.ts"],
    deployed: true,
  },
  {
    hash: "9f7c1e8",
    message: "chore: update control-plane deployment manifests for v2.4",
    author: "devon.c",
    date: "2025-02-10T15:30:00Z",
    files: [
      "deploy/control-plane/values.yaml",
      "deploy/control-plane/Chart.yaml",
    ],
    deployed: false,
  },
];
