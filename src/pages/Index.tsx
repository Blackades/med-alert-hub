
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { MedicationProvider } from "@/contexts/MedicationContext";

const Index = () => {
  const { session } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!session) {
      navigate("/auth");
    }
  }, [session, navigate]);

  if (!session) return null;

  return (
    <MedicationProvider>
      <Dashboard />
    </MedicationProvider>
  );
};

export default Index;
