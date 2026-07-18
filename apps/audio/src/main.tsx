import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import "@fontsource/roboto-mono/400.css";
import "@mantine/core/styles.css";
import { fleetTheme } from "@junkyardsh/kit";
import { MantineProvider } from "@mantine/core";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "@junkyardsh/kit/styles.css";

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
