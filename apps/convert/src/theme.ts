import { createTheme } from "@mantine/core";

export const fleetTheme = createTheme({
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
  },
});
