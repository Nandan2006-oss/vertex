import type { Dependency } from "./types";

/**
 * Dependency edges between vertex/control-plane services.
 * Risk is semantic: "high" edges get rust treatment in the UI.
 */
export const dependencies: Dependency[] = [
  {
    from: "api-gateway",
    to: "control-plane",
    risk: "moderate",
    reason: "Unpinned major version — gateway floats on control-plane v2 API",
  },
  {
    from: "api-gateway",
    to: "ingest",
    risk: "none",
  },
  {
    from: "api-gateway",
    to: "billing",
    risk: "high",
    reason: "Sync call in request path — billing outage blocks all traffic",
  },
  {
    from: "control-plane",
    to: "scheduler",
    risk: "moderate",
    reason: "Tight lease coupling — scheduler lock timeouts ripple into reconcile",
  },
  {
    from: "control-plane",
    to: "billing",
    risk: "high",
    reason: "Cyclic dependency: billing → worker → control-plane closes the loop",
  },
  {
    from: "ingest",
    to: "worker",
    risk: "none",
  },
  {
    from: "scheduler",
    to: "worker",
    risk: "none",
  },
  {
    from: "worker",
    to: "billing",
    risk: "high",
    reason: "Worker retry chain fans out to billing with no circuit breaker",
  },
  {
    from: "billing",
    to: "ingest",
    risk: "moderate",
    reason: "Billing consumes ingest topics directly instead of via control-plane",
  },
];
