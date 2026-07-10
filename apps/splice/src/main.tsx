import { fleetTheme } from "@junkyardsh/kit";
import { MantineProvider } from "@mantine/core";
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "@junkyardsh/kit/styles.css";
import "./splice.css";

const rootEl = document.getElementById("root");
if (!rootEl) {
	throw new Error("Missing #root element - cannot initialize React app");
}
ReactDOM.createRoot(rootEl).render(
	<React.StrictMode>
		<MantineProvider theme={fleetTheme} defaultColorScheme="auto">
			<App />
		</MantineProvider>
	</React.StrictMode>,
);
