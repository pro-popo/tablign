"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fn =
      mode === "signin"
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password });
    const { error } = await fn;
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  async function handleGoogle() {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
  }

  return (
    <main style={{ maxWidth: 360, margin: "80px auto", fontFamily: "sans-serif" }}>
      <h1>tablign 로그인</h1>
      <form onSubmit={handleEmail} style={{ display: "grid", gap: 8 }}>
        <input
          type="email"
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" disabled={loading}>
          {mode === "signin" ? "로그인" : "가입"}
        </button>
      </form>
      <button onClick={handleGoogle} style={{ marginTop: 8, width: "100%" }}>
        Google로 계속
      </button>
      <button
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        style={{ marginTop: 8, background: "none", border: "none", color: "#06c", cursor: "pointer" }}
      >
        {mode === "signin" ? "계정 만들기" : "로그인으로"}
      </button>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </main>
  );
}
