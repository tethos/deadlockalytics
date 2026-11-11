import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./styles-catalog.css";
import "./styles-heroes.css";
import "./styles-guide.css";
import "./styles-map.css";
import "./styles-stats.css";
import "./styles-settings.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
