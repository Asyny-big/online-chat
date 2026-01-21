class HttpRateLimiter {
  constructor({ windowMs, maxRequests }) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.buckets = new Map(); // key -> { count, resetAt }
    this.sweepEvery = 500;
    this.calls = 0;
  }

  take(key) {
    const now = Date.now();
    this.calls += 1;

    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      this._maybeSweep(now);
      return true;
    }

    if (bucket.count >= this.maxRequests) {
      this._maybeSweep(now);
      return false;
    }

    bucket.count += 1;
    this._maybeSweep(now);
    return true;
  }

  _maybeSweep(now) {
    if (this.calls % this.sweepEvery !== 0) return;
    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}

module.exports = HttpRateLimiter;

