import { fleetTheme } from "@junkyardsh/kit";
import { MantineProvider } from "@mantine/core";
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "@junkyardsh/kit/styles.css";
import "./splice.css";

ReactDOM.createRoot(document.getElementById("root") ?? document.body).render(
	<React.StrictMode>
		<MantineProvider theme={fleetTheme} defaultColorScheme="auto">
			<App />
		</MantineProvider>
	</React.StrictMode>,
);
