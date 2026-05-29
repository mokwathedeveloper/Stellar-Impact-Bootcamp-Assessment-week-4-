import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

// Buffer polyfill required for Stellar SDK in browser (Vite bundles Node modules differently)
import { Buffer } from "buffer";
window.Buffer = Buffer;

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
