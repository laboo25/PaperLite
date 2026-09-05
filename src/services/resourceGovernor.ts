import { ResourceGovernorMetrics, ResourcePressureLevel } from '../types';

type GovernorListener = (metrics: ResourceGovernorMetrics) => void;

class ResourceGovernorService {
  private listeners: Set<GovernorListener> = new Set();
  private activeCanvases: Map<string, { width: number; height: number; pageNumber: number }> = new Map();
  private renderDurations: number[] = [];
  private hardwareCores: number = 4;
  private deviceMemoryGB: number | null = null;
  private isLowEndDevice: boolean = false;
  private intervalTimer: any = null;
  private onEmergencyPurgeCallback?: () => void;

  constructor() {
    this.detectHardware();
    this.startMonitoring();
  }

  private detectHardware() {
    if (typeof navigator !== 'undefined') {
      this.hardwareCores = navigator.hardwareConcurrency || 4;
      if ('deviceMemory' in navigator) {
        this.deviceMemoryGB = (navigator as any).deviceMemory || null;
      }
    }

    // A low-end device is defined by <= 4 logical CPU cores or <= 4 GB RAM
    this.isLowEndDevice =
      this.hardwareCores <= 4 ||
      (this.deviceMemoryGB !== null && this.deviceMemoryGB <= 4);
  }

  public registerEmergencyPurgeHandler(handler: () => void) {
    this.onEmergencyPurgeCallback = handler;
  }

  /**
   * Tracks an active rendered canvas and its pixel allocation
   */
  public registerCanvas(id: string, width: number, height: number, pageNumber: number) {
    this.activeCanvases.set(id, { width, height, pageNumber });
    this.checkMemoryBoundaries();
  }

  /**
   * Removes an unmounted canvas from the active allocation tracker
   */
  public unregisterCanvas(id: string) {
    this.activeCanvases.delete(id);
  }

  /**
   * Records execution time of a page render to detect CPU throttling / frame drops
   */
  public recordRenderDuration(durationMs: number) {
    if (durationMs <= 0) return;
    this.renderDurations.push(durationMs);
    if (this.renderDurations.length > 8) {
      this.renderDurations.shift();
    }
    this.notifyListeners();
  }

  /**
   * Calculates rolling average render latency
   */
  public getAverageRenderLatency(): number {
    if (this.renderDurations.length === 0) return 0;
    const sum = this.renderDurations.reduce((acc, v) => acc + v, 0);
    return Math.round(sum / this.renderDurations.length);
  }

  /**
   * Computes current CPU load pressure
   */
  public getCpuPressure(): ResourcePressureLevel {
    const avgLatency = this.getAverageRenderLatency();
    if (avgLatency >= 500) return 'critical';
    if (avgLatency >= 280) return 'high';
    if (avgLatency >= 140) return 'moderate';
    return 'optimal';
  }

  /**
   * Computes current RAM / Heap memory load pressure
   */
  public getMemoryPressure(): ResourcePressureLevel {
    const perfMemory = (typeof performance !== 'undefined' && (performance as any).memory) || null;
    if (perfMemory && perfMemory.usedJSHeapSize) {
      const usedMB = perfMemory.usedJSHeapSize / (1024 * 1024);
      const limitMB = (perfMemory.jsHeapSizeLimit || 1) / (1024 * 1024);
      const ratio = usedMB / limitMB;

      if (usedMB > 350 || ratio > 0.75) return 'critical';
      if (usedMB > 180 || ratio > 0.55) return 'high';
      if (usedMB > 100) return 'moderate';
      return 'optimal';
    }

    // Fallback: estimate based on active canvas megapixels
    const megaPixels = this.getTotalActiveMegaPixels();
    if (megaPixels > 16) return 'critical';
    if (megaPixels > 11) return 'high';
    if (megaPixels > 6) return 'moderate';
    return 'optimal';
  }

  /**
   * Calculates total active pixel footprint across all mounted canvases
   */
  public getTotalActiveMegaPixels(): number {
    let totalPixels = 0;
    for (const c of this.activeCanvases.values()) {
      totalPixels += c.width * c.height;
    }
    return Math.round((totalPixels / 1000000) * 10) / 10;
  }

  /**
   * Returns whether active resource boundary protection is throttling renders
   */
  public isThrottlingActive(lowPowerMode?: boolean, boundaryEnabled: boolean = true): boolean {
    if (!boundaryEnabled) return false;
    if (lowPowerMode || this.isLowEndDevice) return true;
    const cpu = this.getCpuPressure();
    const mem = this.getMemoryPressure();
    return cpu === 'high' || cpu === 'critical' || mem === 'high' || mem === 'critical';
  }

  /**
   * Returns current snapshot of resource governor metrics
   */
  public getMetrics(lowPowerMode?: boolean, boundaryEnabled: boolean = true): ResourceGovernorMetrics {
    const perfMemory = (typeof performance !== 'undefined' && (performance as any).memory) || null;
    const usedHeapMB = perfMemory ? Math.round(perfMemory.usedJSHeapSize / (1024 * 1024)) : null;
    const heapLimitMB = perfMemory ? Math.round((perfMemory.jsHeapSizeLimit || 0) / (1024 * 1024)) : null;

    return {
      usedHeapMB,
      heapLimitMB,
      memoryPressure: this.getMemoryPressure(),
      cpuPressure: this.getCpuPressure(),
      avgRenderLatencyMs: this.getAverageRenderLatency(),
      activeCanvasCount: this.activeCanvases.size,
      totalActiveMegaPixels: this.getTotalActiveMegaPixels(),
      isThrottlingActive: this.isThrottlingActive(lowPowerMode, boundaryEnabled),
      hardwareCores: this.hardwareCores,
      deviceMemoryGB: this.deviceMemoryGB
    };
  }

  /**
   * Boundary rule: Max concurrent page render operations
   * Restricts concurrent renders to 1 under high CPU or RAM pressure so CPU remains free for smooth 60fps UI.
   */
  public getMaxConcurrency(lowPowerMode?: boolean, boundaryEnabled: boolean = true): number {
    if (!boundaryEnabled) return 2;
    if (this.isThrottlingActive(lowPowerMode, boundaryEnabled)) {
      return 1;
    }
    return 2;
  }

  /**
   * Boundary rule: Effective canvas device pixel ratio
   * Reduces pixelRatio to 1.0 under high load to save >50% RAM and GPU memory.
   */
  public getEffectivePixelRatio(
    requestedQuality: 'normal' | 'high',
    lowPowerMode?: boolean,
    boundaryEnabled: boolean = true
  ): number {
    if (requestedQuality === 'normal') return 1.0;
    if (!boundaryEnabled) {
      return Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 1.5);
    }
    // If under pressure or on low-end hardware, clamp to 1.0
    if (this.isThrottlingActive(lowPowerMode, boundaryEnabled)) {
      return 1.0;
    }
    return Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 1.5);
  }

  /**
   * Boundary rule: Virtualization window buffer
   * Reduces the number of pages kept active before and after current page.
   */
  public getWindowBuffer(
    totalPages: number,
    lowPowerMode?: boolean,
    boundaryEnabled: boolean = true
  ): number {
    if (!boundaryEnabled) {
      return totalPages > 100 ? 1 : 2;
    }
    if (this.isThrottlingActive(lowPowerMode, boundaryEnabled) || totalPages > 60) {
      return 1;
    }
    return 2;
  }

  /**
   * Inspects boundaries and triggers emergency garbage cleanup if necessary
   */
  private checkMemoryBoundaries() {
    const memPressure = this.getMemoryPressure();
    if (memPressure === 'critical') {
      if (this.onEmergencyPurgeCallback) {
        this.onEmergencyPurgeCallback();
      }
    }
  }

  private startMonitoring() {
    if (typeof window === 'undefined') return;
    this.intervalTimer = setInterval(() => {
      this.notifyListeners();
      this.checkMemoryBoundaries();
    }, 2500);
  }

  public subscribe(listener: GovernorListener): () => void {
    this.listeners.add(listener);
    listener(this.getMetrics());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    const metrics = this.getMetrics();
    for (const listener of this.listeners) {
      try {
        listener(metrics);
      } catch (err) {
        console.warn('Governor listener notice:', err);
      }
    }
  }

  public destroy() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    this.listeners.clear();
    this.activeCanvases.clear();
  }
}

export const resourceGovernor = new ResourceGovernorService();
