import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../styles/tokens.css";
import "./designSystem.css";
import { DesignSystemPage } from "./DesignSystemPage";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element not found");

createRoot(rootEl).render(
  <StrictMode>
    <DesignSystemPage />
  </StrictMode>,
);
