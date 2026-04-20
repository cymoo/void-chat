import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { applyTheme, getInitialTheme } from "./lib/themeBootstrap";
import { App } from "./App";
import "./index.css";

// Bootstrap theme before first render to prevent flash of wrong theme
applyTheme(getInitialTheme());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
