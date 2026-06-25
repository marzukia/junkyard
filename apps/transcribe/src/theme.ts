import { createTheme } from "@mantine/core";

/**
 * Shared Mantine theme for the marzukia free-tools fleet.
 * Every tool imports this and passes it to <MantineProvider theme={fleetTheme}>.
 * Do not modify per-tool — extend via MantineProvider's `theme` merge if needed.
 */
export const fleetTheme = createTheme({
  fontFamily: "'Roboto', system-ui, sans-serif",
  fontFamilyMonospace: "'Roboto Mono', 'Courier New', monospace",
  headings: {
    fontFamily: "'Roboto', system-ui, sans-serif",
    fontWeight: "700",
  },
  primaryColor: "teal",
  defaultRadius: "md",
  colors: {
    // Calibrated teal accent — used sparingly for active/focus states.
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
    Slider: {
      styles: {
        bar: { backgroundColor: "var(--accent)" },
        thumb: {
          borderColor: "var(--accent)",
          backgroundColor: "var(--surface)",
          width: "16px",
          height: "16px",
        },
        mark: { display: "none" },
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
