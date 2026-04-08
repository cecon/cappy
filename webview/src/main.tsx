import React from "react";
import ReactDOM from "react-dom/client";

import "./styles/tokens.css";
import "./styles/reset.css";
import App from "./App";

/**
 * Bootstraps the React webview application.
 */
function bootstrap(): void {
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error("Root element '#root' not found.");
  }
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

bootstrap();
