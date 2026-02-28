import { useState, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { App as CapApp } from '@capacitor/app';
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { LockScreen } from "./components/LockScreen";
import { isAuthEnabled } from "./lib/auth";

const queryClient = new QueryClient();

function AppShell() {
  const [locked, setLocked] = useState<boolean>(isAuthEnabled());

  // Re-lock when the app comes back to the foreground
  useEffect(() => {
    const listener = CapApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) return; // going to background — don't lock yet (user may glance away)
      // On resume we don't auto-lock (user chose "on launch" only).
      // If you want background locking, set locked(true) here on !isActive.
    });
    return () => { listener.then(h => h.remove()); };
  }, []);

  if (locked) {
    return <LockScreen onUnlocked={() => setLocked(false)} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index onLock={() => setLocked(isAuthEnabled())} />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AppShell />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
