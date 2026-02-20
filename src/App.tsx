import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import 'leaflet/dist/leaflet.css';
import { useAdminAuth } from "@/hooks/useAdminAuth";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import TripWizard from "./pages/TripWizard";

import Timeline from "./pages/Timeline";
import Settings from "./pages/Settings";
import TripSettings from "./pages/TripSettings";
import Invite from "./pages/Invite";

import Live from "./pages/Live";
import Planner from "./pages/Planner";
import GlobalPlanner from "./pages/GlobalPlanner";
import GlobalExplore from "./pages/GlobalExplore";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const TripRedirect = () => {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const { session, loading } = useAdminAuth();

  useEffect(() => {
    if (loading) return;
    if (session) {
      navigate(`/trip/${tripId}/timeline`, { replace: true });
    } else {
      navigate('/auth', { replace: true });
    }
  }, [loading, session, tripId, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
};

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<Dashboard />} />
            <Route path="/trip/new" element={<TripWizard />} />
            <Route path="/trip/:tripId" element={<TripRedirect />} />
            <Route path="/trip/:tripId/timeline" element={<Timeline />} />
            <Route path="/trip/:tripId/live" element={<Live />} />
            <Route path="/trip/:tripId/settings" element={<TripSettings />} />
            <Route path="/invite/:code" element={<Invite />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/planner" element={<GlobalPlanner />} />
            <Route path="/explore" element={<GlobalExplore />} />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
