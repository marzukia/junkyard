import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/800.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@mantine/core/styles.css";
import { MantineProvider, createTheme } from "@mantine/core";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

const theme = createTheme({
  fontFamily: "'Inter', system-ui, sans-serif",
  fontFamilyMonospace: "'JetBrains Mono', 'Courier New', monospace",
  headings: {
    fontFamily: "'Inter', system-ui, sans-serif",
    fontWeight: "800",
  },
  primaryColor: "teal",
  defaultRadius: "md",
  colors: {
    teal: [
      "#eef7f5",
      "#dcefeb",
      "#b6ddd6",
      "#8ecabf",
      "#6abaac",
      "#52afa0",
      "#43ac9c",
      "#339586",
      "#2c8073",
      "#1f6358",
    ],
  },
  components: {
    TextInput: {
      styles: {
        input: {
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "13px",
          border: "1px solid var(--rule)",
          background: "var(--surface)",
          color: "var(--ink)",
        },
      },
    },
  },
});

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element not found");

createRoot(rootEl).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <App />
    </MantineProvider>
  </StrictMode>
);
