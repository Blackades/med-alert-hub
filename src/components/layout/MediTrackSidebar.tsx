
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, Pill, Calendar, BarChart3, Smartphone, Settings, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MediTrackSidebar = ({ isOpen, onClose }: SidebarProps) => {
  const location = useLocation();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  
  const sidebarItems = [
    { name: "Dashboard", path: "/", icon: <Home size={20} /> },
    { name: "Medications", path: "/medications", icon: <Pill size={20} /> },
    { name: "Schedule", path: "/schedule", icon: <Calendar size={20} /> },
    { name: "Analytics", path: "/analytics", icon: <BarChart3 size={20} /> },
    { name: "Devices", path: "/devices", icon: <Smartphone size={20} /> },
    { name: "Settings", path: "/settings", icon: <Settings size={20} /> },
  ];

  return (
    <div 
      className={cn(
        "fixed top-0 left-0 h-full w-72 bg-card dark:bg-gray-900 shadow-lg z-50 transition-all duration-500 ease-out flex flex-col backdrop-blur-md",
        isOpen ? "translate-x-0" : "-translate-x-full",
        "md:translate-x-0 md:static md:shadow-none"
      )}
    >
      <div className="p-4 border-b border-border/50">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="bg-gradient-to-r from-primary to-secondary rounded-full h-10 w-10 flex items-center justify-center shadow-md shadow-primary/20 
                        transition-all duration-300 group-hover:shadow-lg group-hover:shadow-primary/30 group-hover:scale-105">
            <img 
              src="/lovable-uploads/4f96b88e-1330-4560-82b9-0931a50d0791.png" 
              alt="MedAlertHub Logo" 
              className="h-8 w-8 transition-transform duration-500 animate-float"
            />
          </div>
        </Link>
      </div>
      
      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto scrollbar-none">
        <div className="space-y-1.5 staggered-children">
          {sidebarItems.map((item) => (
            <Link
              key={item.name}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300",
                "hover:bg-accent/80 dark:hover:bg-accent/20 hover:-translate-y-0.5 hover:shadow-sm",
                location.pathname === item.path 
                  ? "bg-primary text-white font-medium shadow-md shadow-primary/20 animate-pulse-soft" 
                  : "text-foreground/80",
                hoveredItem === item.name && location.pathname !== item.path 
                  ? "bg-accent/80 dark:bg-accent/20 -translate-y-0.5 shadow-sm" 
                  : ""
              )}
              onClick={() => onClose()}
              onMouseEnter={() => setHoveredItem(item.name)}
              onMouseLeave={() => setHoveredItem(null)}
            >
              <div className={cn(
                "flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300",
                location.pathname === item.path 
                  ? "bg-white/20" 
                  : hoveredItem === item.name ? "bg-primary/10" : "bg-transparent"
              )}>
                {item.icon}
              </div>
              <span className={cn(
                "font-medium transition-all duration-300",
                hoveredItem === item.name && location.pathname !== item.path ? "translate-x-1" : ""
              )}>
                {item.name}
              </span>
            </Link>
          ))}
        </div>
      </nav>

      <div className="p-4 mt-auto">
        <div className="p-3 rounded-lg bg-accent/50 dark:bg-accent/20 hover:shadow-md transform hover:-translate-y-0.5 transition-all duration-300
                      animate-fade-in">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center animate-pulse-soft">
              <Pill size={16} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Need Help?</p>
              <p className="text-xs text-muted-foreground">Contact support</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
