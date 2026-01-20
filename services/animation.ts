
type Callback = (time: number) => void;

class AnimationService {
  private callbacks: Set<Callback> = new Set();
  private rafId: number | null = null;

  subscribe(cb: Callback) {
    this.callbacks.add(cb);
    if (this.callbacks.size === 1 && !this.rafId) {
        this.start();
    }
    return () => this.unsubscribe(cb);
  }

  unsubscribe(cb: Callback) {
    this.callbacks.delete(cb);
    if (this.callbacks.size === 0) {
        this.stop();
    }
  }

  private start() {
    const loop = (time: number) => {
      this.callbacks.forEach(cb => cb(time));
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private stop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}

export const animation = new AnimationService();
