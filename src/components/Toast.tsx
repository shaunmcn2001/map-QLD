import React, { createContext, useContext, useMemo, useState } from "react";

type Toast = { id: string; message: string; type?: "info" | "success" | "error"; };
type Ctx = { push: (msg: string, type?: Toast["type"]) => void };

const ToastCtx = createContext<Ctx>({ push: () => {} });

export function useToast() { return useContext(ToastCtx); }

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const api = useMemo<Ctx>(() => ({
    push: (message, type = "info") => {
      const id = Math.random().toString(36).slice(2);
      setItems(prev => [...prev, { id, message, type }]);
      setTimeout(() => setItems(prev => prev.filter(t => t.id !== id)), 4000);
    }
  }), []);

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {items.map(t => (
          <div key={t.id}
               className={"rounded-lg px-4 py-3 shadow text-white " + (
                 t.type === "error" ? "bg-red-600" :
                 t.type === "success" ? "bg-emerald-600" :
                 "bg-slate-800"
               )}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
