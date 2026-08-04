import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { EmbedApp } from "./EmbedApp";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element not found");

createRoot(rootEl).render(
  <StrictMode>
    <EmbedApp />
  </StrictMode>,
);
