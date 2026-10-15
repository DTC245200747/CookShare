import type { RequestHandler } from "express";
import {
  Registry,
  collectDefaultMetrics,
  Counter,
  Histogram,
} from "prom-client";
export const registry = new Registry();
collectDefaultMetrics({ register: registry, prefix: "cookshare_" });
const requests = new Counter({
  name: "cookshare_http_requests_total",
  help: "HTTP requests",
  labelNames: ["method", "route", "status"],
  registers: [registry],
});
const duration = new Histogram({
  name: "cookshare_http_request_duration_seconds",
  help: "HTTP latency",
  labelNames: ["method", "route"],
  buckets: [0.005, 0.025, 0.1, 0.5, 1, 3, 10],
  registers: [registry],
});
export const observe: RequestHandler = (req, res, next) => {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const route = String(req.route?.path ?? "unmatched");
    const seconds = Number(process.hrtime.bigint() - start) / 1e9;
    requests.inc({ method: req.method, route, status: res.statusCode });
    duration.observe({ method: req.method, route }, seconds);
    if (!req.path.startsWith("/health") && req.path !== "/metrics")
      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: res.statusCode >= 500 ? "error" : "info",
          method: req.method,
          route,
          status: res.statusCode,
          duration_ms: Math.round(seconds * 1000),
        }),
      );
  });
  next();
};
