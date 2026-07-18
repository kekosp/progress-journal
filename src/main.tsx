import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Bundled fonts — no CDN required, works fully offline on Android
// Urbanist (display/headings) + Epilogue (body) — Noir & Gold design system
import "@fontsource/urbanist/300.css";
import "@fontsource/urbanist/500.css";
import "@fontsource/urbanist/600.css";
import "@fontsource/urbanist/700.css";
import "@fontsource/urbanist/800.css";
import "@fontsource/epilogue/300.css";
import "@fontsource/epilogue/400.css";
import "@fontsource/epilogue/500.css";
import "@fontsource/epilogue/600.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";

// Apply saved theme before first paint so the LockScreen/AdminGate render in the correct palette
(() => {
  try {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = saved ? saved === 'dark' : prefersDark;
    document.documentElement.classList.toggle('dark', isDark);
  } catch { /* ignore */ }
})();

createRoot(document.getElementById("root")!).render(<App />);
