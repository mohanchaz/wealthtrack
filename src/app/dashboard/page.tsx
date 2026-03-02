import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = user.user_metadata?.full_name?.split(" ")[0] || "there";

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "'DM Sans', sans-serif" }}>

      {/* Top nav */}
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 32px", height: "60px",
        background: "var(--surface)", borderBottom: "1px solid var(--border)",
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "28px", height: "28px", background: "var(--accent)",
            borderRadius: "7px", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ color: "#000", fontWeight: 700, fontSize: "13px" }}>₹</span>
          </div>
          <span style={{ fontWeight: 600, fontSize: "15px" }}>FinTrack</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {user.user_metadata?.avatar_url && (
            <img
              src={user.user_metadata.avatar_url}
              alt={name}
              style={{ width: "30px", height: "30px", borderRadius: "50%", border: "1px solid var(--border)" }}
            />
          )}
          <span style={{ fontSize: "14px", color: "var(--text-muted)" }}>Hi, {name}</span>
        </div>
      </nav>

      {/* Sidebar + content */}
      <div style={{ display: "flex", minHeight: "calc(100vh - 60px)" }}>

        {/* Sidebar */}
        <aside style={{
          width: "220px", flexShrink: 0,
          background: "var(--surface)", borderRight: "1px solid var(--border)",
          padding: "24px 16px",
          display: "flex", flexDirection: "column", gap: "4px",
        }}>
          {[
            { icon: "⬡", label: "Dashboard", active: true },
            { icon: "◈", label: "Assets", active: false },
            { icon: "◉", label: "Liabilities", active: false },
            { icon: "⇅", label: "Transactions", active: false },
            { icon: "◎", label: "Goals", active: false },
            { icon: "⊡", label: "Snapshots", active: false },
          ].map(item => (
            <div key={item.label} style={{
              display: "flex", alignItems: "center", gap: "10px",
              padding: "10px 12px", borderRadius: "10px", cursor: "pointer",
              background: item.active ? "var(--accent-dim)" : "transparent",
              color: item.active ? "var(--accent)" : "var(--text-muted)",
              fontSize: "14px", fontWeight: item.active ? 500 : 400,
              transition: "all 0.15s",
              border: item.active ? "1px solid rgba(0,208,132,0.15)" : "1px solid transparent",
            }}>
              <span style={{ fontSize: "16px" }}>{item.icon}</span>
              {item.label}
            </div>
          ))}
        </aside>

        {/* Main content */}
        <main style={{ flex: 1, padding: "32px", overflowY: "auto" }}>

          {/* Page header */}
          <div style={{ marginBottom: "32px" }}>
            <h1 style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: "28px", letterSpacing: "-0.5px", marginBottom: "4px",
            }}>
              Dashboard
            </h1>
            <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>
              Your financial overview at a glance
            </p>
          </div>

          {/* Summary cards */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "16px", marginBottom: "32px",
          }}>
            {[
              { label: "Net Worth", value: "₹0", change: null, color: "var(--accent)" },
              { label: "Total Assets", value: "₹0", sub: "0 assets", color: "#3b82f6" },
              { label: "Total Liabilities", value: "₹0", sub: "0 loans", color: "#f59e0b" },
              { label: "Savings Rate", value: "0%", sub: "this month", color: "#8b5cf6" },
            ].map(card => (
              <div key={card.label} style={{
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: "16px", padding: "20px",
              }}>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "8px", fontWeight: 500, letterSpacing: "0.3px", textTransform: "uppercase" }}>
                  {card.label}
                </p>
                <p style={{ fontSize: "26px", fontWeight: 600, color: card.color, letterSpacing: "-0.5px" }}>
                  {card.value}
                </p>
                {card.sub && (
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>{card.sub}</p>
                )}
              </div>
            ))}
          </div>

          {/* Empty state */}
          <div style={{
            background: "var(--surface)", border: "1px dashed var(--border)",
            borderRadius: "20px", padding: "60px 40px",
            textAlign: "center",
          }}>
            <div style={{
              width: "64px", height: "64px", background: "var(--accent-dim)",
              border: "1px solid rgba(0,208,132,0.2)", borderRadius: "16px",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 20px",
              fontSize: "28px",
            }}>
              ₹
            </div>
            <h2 style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: "22px", marginBottom: "10px",
            }}>
              Your wealth journey starts here
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: "14px", maxWidth: "360px", margin: "0 auto 28px", lineHeight: 1.7 }}>
              Add your first asset to see your net worth, allocation charts, and financial health come to life.
            </p>
            <button style={{
              background: "var(--accent)", color: "#000",
              border: "none", borderRadius: "10px",
              padding: "12px 24px", fontSize: "14px", fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
            }}>
              + Add First Asset
            </button>
          </div>

        </main>
      </div>
    </div>
  );
}
