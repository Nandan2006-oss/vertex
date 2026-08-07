import type { Service } from "./types";

/**
 * Fictional microservices codebase: vertex/control-plane.
 * Hand-crafted to look plausible — coherent services, realistic LOC counts.
 */
export const services: Service[] = [
  {
    id: "api-gateway",
    name: "api-gateway",
    description: "Edge routing, authn/authz, and rate limiting for external traffic.",
    state: "healthy",
    loc: 12480,
    commits30d: 46,
    files: ["api-gateway/main.ts", "api-gateway/auth.ts", "api-gateway/routes.ts", "api-gateway/middleware.ts"],
  },
  {
    id: "control-plane",
    name: "control-plane",
    description: "Core orchestration — reconciles service state, owns the desired-state store.",
    state: "evolving",
    loc: 31540,
    commits30d: 62,
    files: ["control-plane/orchestrator.ts", "control-plane/store.ts", "control-plane/reconciler.ts", "control-plane/api.ts"],
  },
  {
    id: "ingest",
    name: "ingest",
    description: "High-throughput event ingestion, buffering, and partition assignment.",
    state: "healthy",
    loc: 8230,
    commits30d: 31,
    files: ["ingest/consumer.ts", "ingest/buffer.ts", "ingest/partitioner.ts"],
  },
  {
    id: "scheduler",
    name: "scheduler",
    description: "Lease-based job scheduling with distributed lock management.",
    state: "evolving",
    loc: 14120,
    commits30d: 38,
    files: ["scheduler/lease.ts", "scheduler/jobs.ts", "scheduler/lock.ts", "scheduler/dispatcher.ts"],
  },
  {
    id: "billing",
    name: "billing",
    description: "Metering, invoicing, and payment processing pipeline.",
    state: "at-risk",
    loc: 22760,
    commits30d: 19,
    files: ["billing/metering.ts", "billing/invoicing.ts", "billing/payments.ts", "billing/pipeline.ts", "billing/retry.ts"],
  },
  {
    id: "worker",
    name: "worker",
    description: "Generic task executor; runs scheduled jobs and retry chains.",
    state: "healthy",
    loc: 9870,
    commits30d: 27,
    files: ["worker/executor.ts", "worker/retry.ts", "worker/tasks.ts"],
  },
];
