
import { Routes, Route } from "react-router-dom";
import Index from "@/pages/Index";
import Auth from "@/pages/Auth";
import NotFound from "@/pages/NotFound";
import Devices from "@/pages/Devices";
import Analytics from "@/pages/Analytics";
import Schedule from "@/pages/Schedule";
import Medications from "@/pages/Medications";
import Settings from "@/pages/Settings";
import ResetPassword from "@/pages/ResetPassword";

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/devices" element={<Devices />} />
      <Route path="/analytics" element={<Analytics />} />
      <Route path="/schedule" element={<Schedule />} />
      <Route path="/medications" element={<Medications />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default AppRoutes;
