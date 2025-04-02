
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter as Router } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/components/AuthProvider";
import AppRoutes from "@/routes/AppRoutes";
import "./App.css";

const queryClient = new QueryClient();

function App() {
  return (
    <Router>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <div className="min-h-screen flex flex-col">
              <AppRoutes />
              <Toaster />
            </div>
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;
