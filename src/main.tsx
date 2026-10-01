import { StrictMode } from "react"; import { createRoot } from "react-dom/client"; import "katex/dist/katex.min.css"; import "./styles.css"; import "./mobile.css"; import "./preferences.css"; import App from "./App";
import "./code.css";
import "./tables.css";
import "./print.css";
import "@fontsource/ubuntu-mono/400.css";
import "@fontsource/ubuntu-mono/400-italic.css";
import "@fontsource/ubuntu-mono/700.css";
import "@fontsource/ubuntu-mono/700-italic.css";
createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
