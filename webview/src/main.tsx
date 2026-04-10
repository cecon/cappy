import React from "react";
import ReactDOM from "react-dom/client";

import "@mantine/core/styles.css";
import { MantineProvider } from "@mantine/core";

import "./styles/tokens.css";
import "./styles/mantine-bridge.css";
import "./styles/reset.css";
import { cappyCssVariablesResolver, cappyMantineTheme } from "./theme";
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
      <MantineProvider
        theme={cappyMantineTheme}
        cssVariablesResolver={cappyCssVariablesResolver}
        defaultColorScheme="dark"
      >
        <App />
      </MantineProvider>
    </React.StrictMode>,
  );
}

bootstrap();
