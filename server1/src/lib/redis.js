// Redis wrapper with an automatic IN-MEMORY FALLBACK.
//
// Why: native Redis is not officially supported on Windows without Docker.
// To keep FastGram "just runs" on any machine, we try to connect to Redis;
// if that fails we transparently fall back to a tiny in-memory store that
// implements the handful of commands we actually use (get/set/del/expire,
// sadd/srem/smembers for presence). The rest of the app never knows the
// difference — same async API either way.
//
// To use REAL Redis: install Memurai (Windows) or set REDIS_URL to a cloud
// instance, then restart. You'll see "✅ Redis connected" in the logs.

const Redis = require("ioredis");

let client;
let usingFallback = false;

// ── In-memory fallback implementation ───────────────────────────────
class InMemoryRedis {
  constructor() {
    this.store = new Map(); // key -> value (string)
    this.sets = new Map(); // key -> Set
    this.timers = new Map();
  }
  async get(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  async set(key, value, ...args) {
    this.store.set(key, value);
    // support: set(key, value, "EX", seconds)
    const exIndex = args.findIndex((a) => String(a).toUpperCase() === "EX");
    if (exIndex !== -1) await this.expire(key, Number(args[exIndex + 1]));
    return "OK";
  }
  async del(...keys) {
    let n = 0;
    for (const key of keys.flat()) {
      if (this.store.delete(key)) n++;
      this.sets.delete(key);
    }
    return n;
  }
  async expire(key, seconds) {
    if (this.timers.has(key)) clearTimeout(this.timers.get(key));
    const t = setTimeout(() => {
      this.store.delete(key);
      this.sets.delete(key);
      this.timers.delete(key);
    }, seconds * 1000);
    if (t.unref) t.unref();
    this.timers.set(key, t);
    return 1;
  }
  async sadd(key, ...members) {
    if (!this.sets.has(key)) this.sets.set(key, new Set());
    const s = this.sets.get(key);
    members.flat().forEach((m) => s.add(String(m)));
    return members.length;
  }
  async srem(key, ...members) {
    const s = this.sets.get(key);
    if (!s) return 0;
    members.flat().forEach((m) => s.delete(String(m)));
    return members.length;
  }
  async smembers(key) {
    return this.sets.has(key) ? [...this.sets.get(key)] : [];
  }
  async sismember(key, member) {
    return this.sets.has(key) && this.sets.get(key).has(String(member)) ? 1 : 0;
  }
  async keys(pattern) {
    // very small glob: only supports trailing "*"
    const prefix = pattern.replace(/\*$/, "");
    return [...this.store.keys()].filter((k) => k.startsWith(prefix));
  }
  async ping() {
    return "PONG";
  }
}

function createRedis() {
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  const real = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null, // don't spam reconnects in dev
  });

  real
    .connect()
    .then(() => {
      console.log("✅ Redis connected:", url);
    })
    .catch(() => {
      console.warn(
        "⚠️  Redis not reachable — using in-memory fallback cache.\n" +
          "    (Install Memurai or set REDIS_URL for real Redis.)"
      );
      usingFallback = true;
      client = new InMemoryRedis();
    });

  // Swallow late connection errors so the process never crashes on Redis.
  real.on("error", () => {});
  return real;
}

client = createRedis();

// Proxy so callers always get the *current* client (real or fallback),
// even if the fallback is swapped in after a failed connection.
module.exports = new Proxy(
  {},
  {
    get(_t, prop) {
      if (prop === "isFallback") return () => usingFallback;
      const target = client;
      const value = target[prop];
      return typeof value === "function" ? value.bind(target) : value;
    },
  }
);
