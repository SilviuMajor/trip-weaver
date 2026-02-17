import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import 'leaflet/dist/leaflet.css';
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import TripWizard from "./pages/TripWizard";
import UserSelect from "./pages/UserSelect";
import Timeline from "./pages/Timeline";
import Settings from "./pages/Settings";
import TripSettings from "./pages/TripSettings";

import Live from "./pages/Live";
import Planner from "./pages/Planner";
import GlobalPlanner from "./pages/GlobalPlanner";
import GlobalExplore from "./pages/GlobalExplore";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

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
            <Route path="/trip/:tripId" element={<UserSelect />} />
            <Route path="/trip/:tripId/timeline" element={<Timeline />} />
            <Route path="/trip/:tripId/live" element={<Live />} />
            <Route path="/trip/:tripId/settings" element={<TripSettings />} />
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
