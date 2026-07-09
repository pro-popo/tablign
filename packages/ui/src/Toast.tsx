import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { theme } from "./theme";

interface ToastItem { id: number; message: string }
interface ToastCtx { show: (message: string) => void }

const Ctx = createContext<ToastCtx | null>(null);

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const show = useCallback((message: string) => {
    const id = nextId++;
    setItems((prev) => [...prev, { id, message }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 2600);
  }, []);

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      {/* 하단 중앙 + 다이얼로그(zIndex 1100)보다 위 — 다이얼로그가 떠 있어도 그 아래쪽에 보인다 */}
      <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, zIndex: 1300 }}>
        {items.map((t) => (
          <div key={t.id} role="status" style={{ background: theme.text, color: "#fff", borderRadius: 8, padding: "9px 13px", fontSize: 13, boxShadow: "0 4px 14px rgba(0,0,0,.18)" }}>
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
