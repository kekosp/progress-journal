import { useState, useEffect, lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { App as CapApp } from '@capacitor/app';
import { LockScreen } from "./components/LockScreen";
import { isAuthEnabled } from "./lib/auth";
import {
  requestNotificationPermission,
  createNotificationChannel,
  scheduleMaintenceNotifications,
} from "./lib/notifications";
import { migrateMaintenanceStorage } from "./lib/maintenance-storage";

// Run once on module load — merges legacy 'maintenance-full-schedule' into
// the unified 'maintenance-schedule' key and removes the old key.
migrateMaintenanceStorage();

const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

function AppShell() {
  const [locked, setLocked] = useState<boolean>(isAuthEnabled());

  // Request notification permission & schedule on first load
  useEffect(() => {
    (async () => {
      const granted = await requestNotificationPermission();
      if (granted) {
        await createNotificationChannel();
        await scheduleMaintenceNotifications();
      }
    })();
  }, []);

  // Re-lock when the app comes back to the foreground; also re-schedule notifications
  useEffect(() => {
    const listener = CapApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) return;
      scheduleMaintenceNotifications();
    });
    return () => { listener.then(h => h.remove()); };
  }, []);

  if (locked) {
    return <LockScreen onUnlocked={() => setLocked(false)} />;
  }

  return (
    <BrowserRouter>
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-background"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>}>
        <Routes>
          <Route path="/" element={<Index onLock={() => setLocked(isAuthEnabled())} />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
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
