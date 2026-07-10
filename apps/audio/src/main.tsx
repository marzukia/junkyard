import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import "@fontsource/roboto-mono/400.css";
import "@junkyardsh/kit/styles.css";

const rootEl = document.getElementById("root");
if (!rootEl) {
	throw new Error("Missing #root element - cannot initialize React app");
}
ReactDOM.createRoot(rootEl).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>,
);
