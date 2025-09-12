/**
 * Performance Monitoring and Optimization
 * Real-time performance tracking and optimization utilities for ごきぶりポーカー
 */

import { Platform } from 'react-native';

// Performance metrics interface
export interface PerformanceMetrics {
  frameRate: number;
  memoryUsage: number;
  jsHeapSize?: number;
  renderTime: number;
  navigationTime: number;
  animationFrameDrops: number;
  timestamp: number;
}

// Performance thresholds
const PERFORMANCE_THRESHOLDS = {
  MIN_FPS: 55, // Target 60fps, warn below 55
  MAX_MEMORY_MB: 50, // Warn if memory usage exceeds 50MB
  MAX_RENDER_TIME_MS: 16.67, // 60fps = 16.67ms per frame
  MAX_NAVIGATION_TIME_MS: 300, // Navigation should complete within 300ms
  MAX_ANIMATION_DROPS: 5, // Maximum acceptable frame drops per animation
} as const;

// Performance event types
export type PerformanceEvent = 
  | 'app_start'
  | 'screen_load'
  | 'card_animation'
  | 'game_action'
  | 'realtime_sync'
  | 'memory_warning'
  | 'frame_drop';

// Performance monitor class
class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private isMonitoring = false;
  private frameDropCounter = 0;
  private lastFrameTime = 0;
  private renderStartTimes = new Map<string, number>();
  private animationStartTimes = new Map<string, number>();

  constructor() {
    this.setupMemoryWarningListener();
  }

  /**
   * Start performance monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.startFrameRateMonitoring();
    this.logEvent('app_start', { action: 'monitoring_started' });
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    this.isMonitoring = false;
    this.logEvent('app_start', { action: 'monitoring_stopped' });
  }

  /**
   * Log a performance event with timing
   */
  logEvent(event: PerformanceEvent, data: Record<string, any> = {}): void {
    const timestamp = Date.now();
    
    if (__DEV__) {
      console.log(`[Performance] ${event}:`, {
        timestamp,
        platform: Platform.OS,
        ...data,
      });
    }

    // Store event for analysis
    this.storeMetric({
      event,
      timestamp,
      data,
    });
  }

  /**
   * Mark the start of a render operation
   */
  markRenderStart(componentName: string): void {
    this.renderStartTimes.set(componentName, performance.now());
  }

  /**
   * Mark the end of a render operation and log performance
   */
  markRenderEnd(componentName: string): number {
    const startTime = this.renderStartTimes.get(componentName);
    if (!startTime) return 0;

    const renderTime = performance.now() - startTime;
    this.renderStartTimes.delete(componentName);

    if (renderTime > PERFORMANCE_THRESHOLDS.MAX_RENDER_TIME_MS) {
      this.logEvent('screen_load', {
        component: componentName,
        renderTime,
        threshold: PERFORMANCE_THRESHOLDS.MAX_RENDER_TIME_MS,
        warning: 'Slow render detected',
      });
    }

    return renderTime;
  }

  /**
   * Mark the start of an animation
   */
  markAnimationStart(animationName: string): void {
    this.animationStartTimes.set(animationName, performance.now());
    this.frameDropCounter = 0;
  }

  /**
   * Mark the end of an animation and analyze performance
   */
  markAnimationEnd(animationName: string): void {
    const startTime = this.animationStartTimes.get(animationName);
    if (!startTime) return;

    const animationTime = performance.now() - startTime;
    this.animationStartTimes.delete(animationName);

    this.logEvent('card_animation', {
      animation: animationName,
      duration: animationTime,
      frameDrops: this.frameDropCounter,
      avgFps: this.calculateAverageFPS(),
    });

    if (this.frameDropCounter > PERFORMANCE_THRESHOLDS.MAX_ANIMATION_DROPS) {
      this.logEvent('frame_drop', {
        animation: animationName,
        droppedFrames: this.frameDropCounter,
        threshold: PERFORMANCE_THRESHOLDS.MAX_ANIMATION_DROPS,
        warning: 'Animation performance degraded',
      });
    }
  }

  /**
   * Mark navigation timing
   */
  markNavigationStart(): number {
    return performance.now();
  }

  /**
   * Mark navigation end and log performance
   */
  markNavigationEnd(startTime: number, screenName: string): void {
    const navigationTime = performance.now() - startTime;

    this.logEvent('screen_load', {
      screen: screenName,
      navigationTime,
      threshold: PERFORMANCE_THRESHOLDS.MAX_NAVIGATION_TIME_MS,
      warning: navigationTime > PERFORMANCE_THRESHOLDS.MAX_NAVIGATION_TIME_MS 
        ? 'Slow navigation detected' 
        : undefined,
    });
  }

  /**
   * Get current memory usage (platform-specific)
   */
  getMemoryUsage(): number {
    if (Platform.OS === 'web' && 'memory' in performance) {
      // Web platform
      const memory = (performance as any).memory;
      return memory ? memory.usedJSHeapSize / (1024 * 1024) : 0;
    }
    
    // For React Native, we'd need a native module or estimate
    // For now, return 0 as placeholder
    return 0;
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    averageFPS: number;
    memoryUsage: number;
    slowRenders: number;
    frameDrops: number;
    totalEvents: number;
  } {
    const recentMetrics = this.getRecentMetrics(60000); // Last minute

    return {
      averageFPS: this.calculateAverageFPS(),
      memoryUsage: this.getMemoryUsage(),
      slowRenders: recentMetrics.filter(m => 
        m.event === 'screen_load' && m.data.warning
      ).length,
      frameDrops: recentMetrics.filter(m => 
        m.event === 'frame_drop'
      ).length,
      totalEvents: recentMetrics.length,
    };
  }

  /**
   * Optimize performance based on current metrics
   */
  optimizePerformance(): void {
    const summary = this.getPerformanceSummary();

    // Memory optimization
    if (summary.memoryUsage > PERFORMANCE_THRESHOLDS.MAX_MEMORY_MB) {
      this.triggerMemoryOptimization();
    }

    // FPS optimization
    if (summary.averageFPS < PERFORMANCE_THRESHOLDS.MIN_FPS) {
      this.triggerFPSOptimization();
    }

    this.logEvent('app_start', {
      action: 'performance_optimization',
      summary,
    });
  }

  /**
   * Clear old metrics to prevent memory leaks
   */
  clearOldMetrics(): void {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    this.metrics = this.metrics.filter(metric => metric.timestamp > oneHourAgo);
  }

  // Private methods

  private startFrameRateMonitoring(): void {
    const monitorFrame = () => {
      if (!this.isMonitoring) return;

      const currentTime = performance.now();
      
      if (this.lastFrameTime > 0) {
        const frameDelta = currentTime - this.lastFrameTime;
        const fps = 1000 / frameDelta;
        
        if (fps < PERFORMANCE_THRESHOLDS.MIN_FPS) {
          this.frameDropCounter++;
        }

        // Store FPS measurement
        this.storeMetric({
          event: 'frame_drop',
          timestamp: Date.now(),
          data: { fps, frameDelta },
        });
      }

      this.lastFrameTime = currentTime;
      requestAnimationFrame(monitorFrame);
    };

    requestAnimationFrame(monitorFrame);
  }

  private setupMemoryWarningListener(): void {
    // Note: In a real React Native app, you'd listen to native memory warnings
    // For now, we'll simulate with periodic checks
    if (__DEV__) {
      setInterval(() => {
        const memoryUsage = this.getMemoryUsage();
        if (memoryUsage > PERFORMANCE_THRESHOLDS.MAX_MEMORY_MB) {
          this.logEvent('memory_warning', {
            currentUsage: memoryUsage,
            threshold: PERFORMANCE_THRESHOLDS.MAX_MEMORY_MB,
          });
        }
      }, 30000); // Check every 30 seconds
    }
  }

  private calculateAverageFPS(): number {
    const recentFrameMetrics = this.getRecentMetrics(5000) // Last 5 seconds
      .filter(m => m.event === 'frame_drop' && m.data.fps);
    
    if (recentFrameMetrics.length === 0) return 60; // Assume 60fps if no data
    
    const totalFPS = recentFrameMetrics.reduce((sum, m) => sum + m.data.fps, 0);
    return totalFPS / recentFrameMetrics.length;
  }

  private getRecentMetrics(timeWindowMs: number): any[] {
    const cutoff = Date.now() - timeWindowMs;
    return this.metrics.filter(m => m.timestamp > cutoff);
  }

  private storeMetric(metric: any): void {
    this.metrics.push(metric);
    
    // Prevent memory buildup
    if (this.metrics.length > 1000) {
      this.clearOldMetrics();
    }
  }

  private triggerMemoryOptimization(): void {
    // Clear old metrics
    this.clearOldMetrics();
    
    // Clear caches (would be implemented based on app architecture)
    this.logEvent('memory_warning', {
      action: 'memory_optimization_triggered',
    });
  }

  private triggerFPSOptimization(): void {
    // Reduce animation complexity or frame rate
    this.logEvent('frame_drop', {
      action: 'fps_optimization_triggered',
    });
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

// React hook for performance monitoring
export const usePerformanceMonitoring = () => {
  const startMonitoring = () => performanceMonitor.startMonitoring();
  const stopMonitoring = () => performanceMonitor.stopMonitoring();
  const logEvent = (event: PerformanceEvent, data?: Record<string, any>) => 
    performanceMonitor.logEvent(event, data);
  const getPerformanceSummary = () => performanceMonitor.getPerformanceSummary();
  const optimizePerformance = () => performanceMonitor.optimizePerformance();

  return {
    startMonitoring,
    stopMonitoring,
    logEvent,
    getPerformanceSummary,
    optimizePerformance,
    markRenderStart: performanceMonitor.markRenderStart.bind(performanceMonitor),
    markRenderEnd: performanceMonitor.markRenderEnd.bind(performanceMonitor),
    markAnimationStart: performanceMonitor.markAnimationStart.bind(performanceMonitor),
    markAnimationEnd: performanceMonitor.markAnimationEnd.bind(performanceMonitor),
    markNavigationStart: performanceMonitor.markNavigationStart.bind(performanceMonitor),
    markNavigationEnd: performanceMonitor.markNavigationEnd.bind(performanceMonitor),
  };
};

// Utility functions for specific optimizations

/**
 * Debounce function for performance-critical operations
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

/**
 * Throttle function for limiting function calls
 */
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

/**
 * Memoization for expensive calculations
 */
export const memoize = <T extends (...args: any[]) => any>(
  func: T,
  maxCacheSize = 100
): T => {
  const cache = new Map();
  
  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    const result = func(...args);
    
    // Prevent cache from growing too large
    if (cache.size >= maxCacheSize) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    
    cache.set(key, result);
    return result;
  }) as T;
};

// Performance optimization constants
export const OPTIMIZATION_CONFIG = {
  // Animation settings
  REDUCED_MOTION: {
    duration: 150, // Reduced from default 300ms
    useNativeDriver: true,
  },
  
  // Image optimization
  IMAGE_QUALITY: {
    card: { width: 80, height: 120, quality: 0.8 },
    avatar: { width: 40, height: 40, quality: 0.7 },
  },
  
  // Debounce/throttle timings
  USER_INPUT_DEBOUNCE: 150,
  SCROLL_THROTTLE: 16, // ~60fps
  NETWORK_REQUEST_DEBOUNCE: 300,
  
  // Memory management
  MAX_CACHED_SCREENS: 3,
  MAX_GAME_HISTORY: 50,
  METRIC_CLEANUP_INTERVAL: 300000, // 5 minutes
} as const;

export default performanceMonitor;