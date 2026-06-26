import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import "@fontsource/roboto-mono/400.css";
import "@fontsource/roboto-mono/500.css";
import "@mantine/core/styles.css";
import { MantineProvider, createTheme } from "@mantine/core";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "@junkyardsh/ui/styles.css";

const theme = createTheme({
  fontFamily: "'Roboto', system-ui, sans-serif",
  fontFamilyMonospace: "'Roboto Mono', 'Courier New', monospace",
  headings: {
    fontFamily: "'Roboto', system-ui, sans-serif",
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
          fontFamily: "'Roboto Mono', monospace",
          fontSize: "13px",
          border: "1px solid var(--rule)",
          background: "var(--surface)",
          color: "var(--ink)",
        },
      },
    },
    Popover: {
      styles: {
        dropdown: {
          border: "1px solid var(--rule)",
          boxShadow: "var(--shadow-pop)",
          background: "var(--surface)",
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
