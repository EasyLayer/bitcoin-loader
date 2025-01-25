import { performance } from 'node:perf_hooks';
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { AppLogger } from '@easylayer/components/logger';

@Injectable()
export class MetricsService implements OnModuleInit, OnModuleDestroy {
  private metrics: Map<string, number> = new Map();
  private startTimes: Map<string, number> = new Map();

  constructor(private readonly log: AppLogger) {}

  onModuleInit() {
    this.metrics.set('app_time', 0);
    this.startMetric('app_time');
  }

  onModuleDestroy() {
    this.endMetric('app_time');
    this.logMetrics();
  }

  startMetric(key: string): void {
    if (this.startTimes.has(key)) {
      return;
    }
    this.startTimes.set(key, performance.now());

    if (!this.metrics.has(key)) {
      this.metrics.set(key, 0);
    }
  }

  endMetric(key: string): void {
    const startTime = this.startTimes.get(key);
    if (!startTime) {
      return;
    }
    const elapsed = performance.now() - startTime;
    this.metrics.set(key, elapsed);
    this.startTimes.delete(key);
  }

  sumMetric(key: string): void {
    const startTime = this.startTimes.get(key);
    if (!startTime) {
      return;
    }
    const elapsed = performance.now() - startTime;
    const currentValue = this.metrics.get(key) || 0;
    this.metrics.set(key, currentValue + elapsed);
    this.startTimes.delete(key);
  }

  getMetric(key: string): number {
    return this.metrics.get(key) || 0;
  }

  getAllMetrics(): Record<string, number> {
    const allMetrics: Record<string, number> = {};
    for (const [key, value] of this.metrics.entries()) {
      allMetrics[key] = value;
    }
    return allMetrics;
  }

  logMetrics(): void {}
}
