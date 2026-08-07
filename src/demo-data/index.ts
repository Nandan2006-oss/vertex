/**
 * Single export point for the Vertex data layer.
 *
 * Screens import from THIS module only. Replacing demo data with real
 * repository data later = reimplementing these exports behind the same
 * types from `./types`.
 */
export { services } from "./services";
export { dependencies } from "./dependencies";
export { techDebt } from "./techDebt";
export { commits } from "./commits";
export { metrics } from "./metrics";

export type {
  Service,
  ServiceState,
  Dependency,
  DependencyRisk,
  TechDebtItem,
  Commit,
  MetricPoint,
  Metrics,
} from "./types";
