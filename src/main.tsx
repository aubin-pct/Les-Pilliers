import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { startUpdates } from "@/lib/update";
import { App } from "./App";
import "./styles/app.css";

// Mises à jour : vérifiées à l'ouverture, au retour sur l'appli et toutes les 30 minutes.
startUpdates();
if (navigator.storage?.persist) void navigator.storage.persist().catch(() => undefined);

createRoot(document.getElementById("root")!).render(
  <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <App />
  </HashRouter>,
);
