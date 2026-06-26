import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import "@fontsource/roboto-mono/400.css";
import "@fontsource/roboto-mono/500.css";
import "@mantine/core/styles.css";
import { MantineProvider } from "@mantine/core";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./shell.css";
import "@junkyardsh/ui/styles.css";
import "./styles.css";
import { fleetTheme } from "@junkyardsh/ui";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element not found");

createRoot(rootEl).render(
  <StrictMode>
    <MantineProvider theme={fleetTheme} defaultColorScheme="auto">
      <App />
    </MantineProvider>
  </StrictMode>
);
