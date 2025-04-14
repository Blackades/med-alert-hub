
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
  
  const sidebarItems = [
    { name: "Dashboard", path: "/", icon: <Home size={22} /> },
    { name: "Medications", path: "/medications", icon: <Pill size={22} /> },
    { name: "Schedule", path: "/schedule", icon: <Calendar size={22} /> },
    { name: "Analytics", path: "/analytics", icon: <BarChart3 size={22} /> },
    { name: "Devices", path: "/devices", icon: <Smartphone size={22} /> },
    { name: "Settings", path: "/settings", icon: <Settings size={22} /> },
  ];

  return (
    <div 
      className={cn(
        "fixed top-0 left-0 h-full w-72 bg-white dark:bg-gray-900 shadow-lg z-50 transition-transform duration-300 ease-in-out",
        isOpen ? "translate-x-0" : "-translate-x-full",
        "md:translate-x-0 md:static md:shadow-none"
      )}
    >
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-r from-primary to-secondary rounded-full h-10 w-10 flex items-center justify-center">
            <img 
              src="/lovable-uploads/4f96b88e-1330-4560-82b9-0931a50d0791.png" 
              alt="MedAlertHub Logo" 
              className="h-8 w-8"
            />
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            MedAlertHub
          </h1>
        </div>
        <button 
          onClick={onClose} 
          className="md:hidden p-2 rounded-full hover:bg-muted transition-colors"
        >
          <X size={20} />
        </button>
      </div>
      
      <nav className="p-3 space-y-1">
        {sidebarItems.map((item) => (
          <Link
            key={item.name}
            to={item.path}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
              "hover:bg-accent/50 dark:hover:bg-accent/20",
              location.pathname === item.path 
                ? "bg-accent text-primary font-medium" 
                : "text-foreground/70"
            )}
            onClick={() => onClose()}
          >
            {item.icon}
            <span>{item.name}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
};
