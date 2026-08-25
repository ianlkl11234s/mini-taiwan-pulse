import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BboxSelectorApp } from "./BboxSelectorApp";

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
  <StrictMode>
    <BboxSelectorApp />
  </StrictMode>,
);
