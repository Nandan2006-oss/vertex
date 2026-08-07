import type { Metrics } from "./types";

/**
 * Trailing-14-day operational metrics for vertex/control-plane.
 * Every number on the Overview screen derives from here.
 */
export const metrics: Metrics = {
  deployCadence: [
    { date: "2025-02-01", value: 3 },
    { date: "2025-02-02", value: 5 },
    { date: "2025-02-03", value: 2 },
    { date: "2025-02-04", value: 4 },
    { date: "2025-02-05", value: 6 },
    { date: "2025-02-06", value: 3 },
    { date: "2025-02-07", value: 5 },
    { date: "2025-02-08", value: 7 },
    { date: "2025-02-09", value: 4 },
    { date: "2025-02-10", value: 6 },
    { date: "2025-02-11", value: 3 },
    { date: "2025-02-12", value: 5 },
    { date: "2025-02-13", value: 4 },
    { date: "2025-02-14", value: 2 },
  ],
  debtTrend: [
    { date: "2025-02-01", value: 320 },
    { date: "2025-02-02", value: 318 },
    { date: "2025-02-03", value: 322 },
    { date: "2025-02-04", value: 327 },
    { date: "2025-02-05", value: 331 },
    { date: "2025-02-06", value: 329 },
    { date: "2025-02-07", value: 334 },
    { date: "2025-02-08", value: 340 },
    { date: "2025-02-09", value: 338 },
    { date: "2025-02-10", value: 342 },
    { date: "2025-02-11", value: 345 },
    { date: "2025-02-12", value: 348 },
    { date: "2025-02-13", value: 351 },
    { date: "2025-02-14", value: 349 },
  ],
};
