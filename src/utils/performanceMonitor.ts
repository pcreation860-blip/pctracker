/**
 * Performance monitoring utilities for tracking app performance
 */

interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: string;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private maxMetrics = 50;
  private timers = new Map<string, number>();

  /**
   * Start timing an operation
   */
  start(name: string) {
    this.timers.set(name, performance.now());
  }

  /**
   * End timing an operation and record the metric
   */
  end(name: string): number {
    const startTime = this.timers.get(name);
    if (!startTime) {
      console.warn(`⚠️ Performance timer "${name}" was not started`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.timers.delete(name);

    const metric: PerformanceMetric = {
      name,
      duration: Math.round(duration * 100) / 100, // Round to 2 decimal places
      timestamp: new Date().toISOString()
    };

    this.metrics.push(metric);
    
    // Keep only last N metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }

    // Log if operation took longer than threshold
    if (duration > 1000) {
      console.warn(`⚠️ Slow operation: ${name} took ${duration.toFixed(2)}ms`);
    } else {
      console.log(`⏱️ ${name}: ${duration.toFixed(2)}ms`);
    }

    return duration;
  }

  /**
   * Measure a function execution time
   */
  async measure<T>(name: string, fn: () => Promise<T>): Promise<T> {
    this.start(name);
    try {
      const result = await fn();
      this.end(name);
      return result;
    } catch (error) {
      this.end(name);
      throw error;
    }
  }

  /**
   * Measure synchronous function execution time
   */
  measureSync<T>(name: string, fn: () => T): T {
    this.start(name);
    try {
      const result = fn();
      this.end(name);
      return result;
    } catch (error) {
      this.end(name);
      throw error;
    }
  }

  /**
   * Get all recorded metrics
   */
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  /**
   * Get average duration for a specific operation
   */
  getAverage(name: string): number {
    const filtered = this.metrics.filter(m => m.name === name);
    if (filtered.length === 0) return 0;

    const sum = filtered.reduce((acc, m) => acc + m.duration, 0);
    return Math.round((sum / filtered.length) * 100) / 100;
  }

  /**
   * Get statistics for a specific operation
   */
  getStats(name: string) {
    const filtered = this.metrics.filter(m => m.name === name);
    if (filtered.length === 0) {
      return null;
    }

    const durations = filtered.map(m => m.duration);
    const sorted = [...durations].sort((a, b) => a - b);

    return {
      count: filtered.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
      avg: this.getAverage(name),
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)]
    };
  }

  /**
   * Clear all metrics
   */
  clear() {
    this.metrics = [];
    this.timers.clear();
  }

  /**
   * Export metrics as JSON
   */
  export(): string {
    return JSON.stringify(this.metrics, null, 2);
  }

  /**
   * Get summary of all operations
   */
  getSummary() {
    const operations = new Set(this.metrics.map(m => m.name));
    const summary: Record<string, any> = {};

    operations.forEach(op => {
      summary[op] = this.getStats(op);
    });

    return summary;
  }
}

// Export singleton instance
export const perfMonitor = new PerformanceMonitor();

// Helper function for quick measurements
export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  return perfMonitor.measure(name, fn);
}

export function measureSync<T>(
  name: string,
  fn: () => T
): T {
  return perfMonitor.measureSync(name, fn);
}
