interface RouteMetrics {
  requests: number;
  errors4xx: number;
  errors5xx: number;
  totalDurationMs: number;
}

class MetricsRegistry {
  private readonly startedAt = Date.now();
  private totalRequests = 0;
  private totalErrors = 0;
  private readonly durations: number[] = [];
  private readonly byRoute = new Map<string, RouteMetrics>();

  record(routeKey: string, statusCode: number, durationMs: number): void {
    this.totalRequests += 1;
    if (statusCode >= 400) {
      this.totalErrors += 1;
    }

    // Keep bounded sliding window of recent durations for p95
    if (this.durations.length >= 2000) {
      this.durations.shift();
    }
    this.durations.push(durationMs);

    const existing = this.byRoute.get(routeKey) ?? {
      requests: 0,
      errors4xx: 0,
      errors5xx: 0,
      totalDurationMs: 0,
    };
    existing.requests += 1;
    if (statusCode >= 400 && statusCode < 500) existing.errors4xx += 1;
    if (statusCode >= 500) existing.errors5xx += 1;
    existing.totalDurationMs += durationMs;
    this.byRoute.set(routeKey, existing);
  }

  snapshot() {
    const sorted = [...this.durations].sort((a, b) => a - b);
    const p95Index =
      sorted.length > 0 ? Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95)) : 0;
    const avgMs = sorted.length > 0 ? sorted.reduce((acc, v) => acc + v, 0) / sorted.length : 0;

    return {
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      totalRequests: this.totalRequests,
      totalErrors: this.totalErrors,
      latencyMs: {
        avg: Number(avgMs.toFixed(2)),
        p95: Number((sorted[p95Index] ?? 0).toFixed(2)),
      },
      routes: Object.fromEntries(this.byRoute.entries()),
    };
  }
}

export const metrics = new MetricsRegistry();
