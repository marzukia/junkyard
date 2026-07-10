import React from "react";
import ReactDOM from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { App } from "./App";
import { fleetTheme } from "@junkyardsh/kit";
import "@junkyardsh/kit/styles.css";
import "./splice.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<MantineProvider theme={fleetTheme} defaultColorScheme="auto">
			<App />
		</MantineProvider>
	</React.StrictMode>,
);
