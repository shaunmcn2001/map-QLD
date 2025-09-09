import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ToastProvider } from "./components/Toast";

const root = createRoot(document.getElementById("root")!);
root.render(
  <ToastProvider>
    <App />
  </ToastProvider>
);
