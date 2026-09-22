import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LayerScreeningApp } from "./LayerScreeningApp";
import "./screening.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");
createRoot(root).render(<StrictMode><LayerScreeningApp /></StrictMode>);
