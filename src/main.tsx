import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";
import { App } from "./App";
import "./styles/app.css";

// Mises à jour : le nouveau service worker prend la main dès qu'il est prêt.
registerSW({ immediate: true });
if (navigator.storage?.persist) void navigator.storage.persist().catch(() => undefined);

createRoot(document.getElementById("root")!).render(
  <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <App />
  </HashRouter>,
);
