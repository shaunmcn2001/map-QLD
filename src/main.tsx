import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ToastProvider } from "./components/Toast";

// --- debug env & connectivity ---
console.log("[map-QLD] VITE_API_BASE =", import.meta.env.VITE_API_BASE);
(window as any).__APP_ENV = { API_BASE: import.meta.env.VITE_API_BASE };

// quick connection test (doesn't block UI)
try {
  const base = import.meta.env.VITE_API_BASE || "http://localhost:8000";
  fetch(base + "/healthz", { method: "GET" })
    .then(r => {
      console.log("[map-QLD] /healthz status:", r.status);
      return r.text().then(t => console.log("[map-QLD] /healthz body:", t));
    })
    .catch(e => console.warn("[map-QLD] /healthz failed:", e));
} catch (e) {
  console.warn("[map-QLD] connection test error:", e);
}
// --- end debug ---
const root = createRoot(document.getElementById("root")!);
root.render(
  <ToastProvider>
    <App />
  </ToastProvider>
);
