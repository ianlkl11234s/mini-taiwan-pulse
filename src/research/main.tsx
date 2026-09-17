import "../embed/mercatorEngineMaplibre";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ResearchApp } from "./ResearchApp";

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");
createRoot(root).render(<StrictMode><ResearchApp /></StrictMode>);
