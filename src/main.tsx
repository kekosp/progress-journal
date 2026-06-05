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

createRoot(document.getElementById("root")!).render(<App />);
