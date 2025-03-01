
import { Button } from "@/components/ui/button";
import { Moon, Sun, Menu } from "lucide-react";
import { useTheme } from "next-themes";
import { UserSettingsDialog } from "@/components/UserSettingsDialog";

interface HeaderProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  onSaveSettings: (settings: { email: string; phoneNumber: string }) => Promise<void>;
}

export const Header = ({ sidebarOpen, setSidebarOpen, onSaveSettings }: HeaderProps) => {
  const { theme, setTheme } = useTheme();

  return (
    <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <h2 className="text-2xl font-bold text-primary">MedAlert</h2>
        </div>
        <nav className="flex-1 ml-8">
          <ul className="flex space-x-4">
            <li><a href="#" className="text-muted-foreground hover:text-foreground">Dashboard</a></li>
            <li><a href="#" className="text-muted-foreground hover:text-foreground">Calendar</a></li>
            <li><a href="#" className="text-muted-foreground hover:text-foreground">Reports</a></li>
          </ul>
        </nav>
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="w-10 h-10 rounded-full"
          >
            {theme === "dark" ? (
              <Sun className="h-5 w-5 text-yellow-500" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>
          <UserSettingsDialog onSave={onSaveSettings} />
        </div>
      </div>
    </header>
  );
};
