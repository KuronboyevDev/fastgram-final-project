"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/store/auth";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [form, setForm] = useState({
    fullName: "",
    username: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await register(form);
      router.replace("/");
    } catch (err) {
      setError(err.response?.data?.error || "Registration failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-gradient p-6">
      <form onSubmit={submit} className="card w-full max-w-sm p-8">
        <h2 className="brand-text mb-1 text-3xl">FastGram</h2>
        <h3 className="mb-6 text-lg font-bold">Create your account</h3>

        {error && (
          <div className="mb-4 rounded-xl bg-rose-50 px-4 py-2 text-sm text-rose-600">
            {error}
          </div>
        )}

        <input className="input mb-3" placeholder="Full name" value={form.fullName} onChange={set("fullName")} />
        <input className="input mb-3" placeholder="Username" value={form.username} onChange={set("username")} required />
        <input className="input mb-3" type="email" placeholder="Email" value={form.email} onChange={set("email")} required />
        <input className="input mb-6" type="password" placeholder="Password" value={form.password} onChange={set("password")} required />

        <button className="btn-brand w-full" disabled={busy}>
          {busy ? "Creating…" : "Sign up"}
        </button>

        <p className="mt-4 text-center text-sm text-ink-soft">
          Have an account?{" "}
          <Link href="/login" className="font-semibold text-brand-600">
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}
