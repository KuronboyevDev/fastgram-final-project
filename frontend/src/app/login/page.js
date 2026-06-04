"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/store/auth";

export default function LoginPage() {
  const router = useRouter();
  const { login, user, init } = useAuth();
  const [username, setUsername] = useState("alice");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    init();
  }, [init]);
  useEffect(() => {
    if (user) router.replace("/");
  }, [user, router]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(username, password);
      router.replace("/");
    } catch (err) {
      setError(err.response?.data?.error || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Brand panel */}
      <div className="hidden flex-1 flex-col justify-center bg-brand-gradient p-12 text-white lg:flex">
        <h1 className="text-5xl font-extrabold">FastGram</h1>
        <p className="mt-4 max-w-md text-lg text-white/90">
          Share moments. Stream video. Discover people. Powered by a real
          two-server microservice architecture.
        </p>
        <ul className="mt-8 space-y-2 text-white/80">
          <li>📸 Photos & video posts</li>
          <li>💬 Real-time DMs & notifications</li>
          <li>🧭 GraphQL-powered Explore</li>
        </ul>
      </div>

      {/* Form */}
      <div className="flex flex-1 items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm">
          <h2 className="brand-text mb-1 text-3xl lg:hidden">FastGram</h2>
          <h3 className="mb-6 text-xl font-bold">Welcome back</h3>

          {error && (
            <div className="mb-4 rounded-xl bg-rose-50 px-4 py-2 text-sm text-rose-600">
              {error}
            </div>
          )}

          <label className="mb-1 block text-sm font-medium">Username or email</label>
          <input className="input mb-4" value={username} onChange={(e) => setUsername(e.target.value)} />

          <label className="mb-1 block text-sm font-medium">Password</label>
          <input
            type="password"
            className="input mb-6"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button className="btn-brand w-full" disabled={busy}>
            {busy ? "Signing in…" : "Log in"}
          </button>

          <p className="mt-4 text-center text-sm text-ink-soft">
            No account?{" "}
            <Link href="/register" className="font-semibold text-brand-600">
              Sign up
            </Link>
          </p>

          <div className="mt-6 rounded-xl bg-slate-100 p-3 text-center text-xs text-ink-soft">
            Demo: <b>alice</b> / <b>password123</b> (also bob, charlie, diana)
          </div>
        </form>
      </div>
    </div>
  );
}
