import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(<App />);
} else {
  document.body.innerHTML = '<div style="padding:40px;text-align:center;font-family:sans-serif"><h2>Loading PCTracker...</h2><p>Please refresh the page</p><button onclick="location.reload()" style="padding:10px 20px;background:#f59e0b;border:none;border-radius:8px;color:white;font-size:16px;cursor:pointer">Refresh</button></div>';
}
