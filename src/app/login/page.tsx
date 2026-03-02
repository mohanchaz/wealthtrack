"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginContent() {
  const params = useSearchParams();
  const error = params.get("error");

  async function signInWithGoogle() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <main style={{
      minHeight: "100vh",
      background: "var(--bg)",
      display: "flex",
      flexDirection: "column",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Background grid */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: `linear-gradient(rgba(0,208,132,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,208,132,0.03) 1px, transparent 1px)`,
        backgroundSize: "60px 60px",
      }} />

      {/* Glow */}
      <div style={{
        position: "absolute", top: "-200px", left: "50%", transform: "translateX(-50%)",
        width: "800px", height: "600px", pointerEvents: "none",
        background: "radial-gradient(ellipse at center, rgba(0,208,132,0.08) 0%, transparent 70%)",
      }} />

      {/* Nav */}
      <nav style={{
        position: "relative", zIndex: 10,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "24px 48px",
        borderBottom: "1px solid var(--border)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "32px", height: "32px", background: "var(--accent)",
            borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ color: "#000", fontWeight: 700, fontSize: "14px" }}>₹</span>
          </div>
          <span style={{ fontWeight: 600, fontSize: "16px", letterSpacing: "-0.3px" }}>FinTrack</span>
        </div>
        <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>Personal · Private · Powerful</span>
      </nav>

      {/* Hero */}
      <div style={{
        position: "relative", zIndex: 10, flex: 1,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "60px 24px",
        textAlign: "center",
      }}>

        {/* Badge */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: "8px",
          background: "var(--accent-dim)", border: "1px solid rgba(0,208,132,0.2)",
          borderRadius: "100px", padding: "6px 14px", marginBottom: "32px",
        }}>
          <div style={{ width: "6px", height: "6px", background: "var(--accent)", borderRadius: "50%" }} />
          <span style={{ fontSize: "12px", color: "var(--accent)", fontWeight: 500, letterSpacing: "0.5px" }}>
            BUILT FOR INDIAN INVESTORS
          </span>
        </div>

        {/* Headline */}
        <h1 className="font-display" style={{
          fontSize: "clamp(40px, 7vw, 80px)",
          lineHeight: 1.05,
          letterSpacing: "-2px",
          marginBottom: "24px",
          maxWidth: "800px",
        }}>
          Know your <em style={{ color: "var(--accent)", fontStyle: "italic" }}>true wealth</em>
          <br />at a glance.
        </h1>

        <p style={{
          fontSize: "18px", color: "var(--text-muted)", maxWidth: "480px",
          lineHeight: 1.7, marginBottom: "48px", fontWeight: 300,
        }}>
          Track net worth, income, expenses and goals across 20+ asset classes.
          No broker credentials. 100% private.
        </p>

        {/* Sign in card */}
        <div style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "20px",
          padding: "32px",
          width: "100%", maxWidth: "360px",
          marginBottom: "48px",
        }}>
          {error === "unauthorized" && (
            <div style={{
              background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: "10px", padding: "12px 16px", marginBottom: "20px",
              fontSize: "13px", color: "#f87171",
            }}>
              This Google account is not authorized.
            </div>
          )}

          <p style={{ fontSize: "14px", color: "var(--text-muted)", marginBottom: "20px" }}>
            Sign in to access your dashboard
          </p>

          <button
            onClick={signInWithGoogle}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
              gap: "12px", background: "#fff", color: "#111",
              border: "none", borderRadius: "12px",
              padding: "14px 20px", fontSize: "15px", fontWeight: 600,
              cursor: "pointer", transition: "all 0.15s",
              fontFamily: "inherit",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "#f0f0f0")}
            onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>
        </div>

        {/* Stats strip */}
        <div style={{
          display: "flex", gap: "40px", flexWrap: "wrap", justifyContent: "center",
        }}>
          {[
            { value: "20+", label: "Asset Classes" },
            { value: "170+", label: "Currencies" },
            { value: "100%", label: "Private" },
          ].map(s => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div className="font-display" style={{ fontSize: "28px", color: "var(--accent)", letterSpacing: "-1px" }}>{s.value}</div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer style={{
        position: "relative", zIndex: 10,
        textAlign: "center", padding: "20px",
        borderTop: "1px solid var(--border)",
        fontSize: "12px", color: "var(--text-muted)",
      }}>
        Your data stays yours — no broker access, no data selling, ever.
      </footer>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "var(--text-muted)", fontSize: "14px" }}>Loading...</div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
