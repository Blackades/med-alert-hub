
import { useState } from 'react';
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MediTrackSidebar } from "@/components/layout/MediTrackSidebar";
import { Footer } from "@/components/layout/Footer";
import { BarChart3, LineChart as LineChartIcon, PieChart as PieChartIcon, Calendar, Download, Menu, Pill } from "lucide-react";
import { MedicationProvider, useMedications } from "@/contexts/MedicationContext";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, Legend, PieChart as RPieChart, Pie, Cell, LineChart } from 'recharts';

const Analytics = () => {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  if (!session) {
    navigate("/auth");
    return null;
  }
  
  return (
    <MedicationProvider>
      <AnalyticsContent sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
    </MedicationProvider>
  );
};

const AnalyticsContent = ({ sidebarOpen, setSidebarOpen }: { sidebarOpen: boolean, setSidebarOpen: (open: boolean) => void }) => {
  const { sortedMedications } = useMedications();
  
  // Generate sample data for charts
  const adherenceData = [
    { name: 'Mon', adherence: 100 },
    { name: 'Tue', adherence: 80 },
    { name: 'Wed', adherence: 90 },
    { name: 'Thu', adherence: 100 },
    { name: 'Fri', adherence: 70 },
    { name: 'Sat', adherence: 85 },
    { name: 'Sun', adherence: 95 },
  ];
  
  const medicationStatusData = [
    { name: 'Taken', value: sortedMedications.filter(med => med.status === 'taken').length || 2 },
    { name: 'Missed', value: sortedMedications.filter(med => med.status === 'overdue').length || 1 },
    { name: 'Upcoming', value: sortedMedications.filter(med => med.status === 'upcoming').length || 3 },
  ];
  
  const COLORS = ['#8B5CF6', '#FF6B6B', '#38BDF8'];

  return (
    <div className="min-h-screen bg-background">
      <div className="flex h-16 items-center justify-between px-4 border-b border-border/40 bg-background/95 backdrop-blur">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="hidden md:flex items-center gap-2">
            <div className="bg-gradient-to-r from-primary to-secondary rounded-full h-9 w-9 flex items-center justify-center">
              <Pill className="text-white" size={20} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex">
        <MediTrackSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        
        <main className="flex-1 p-4 md:p-6">
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div>
                <h1 className="text-3xl font-bold">Analytics</h1>
                <p className="text-muted-foreground mt-1">
                  Track your medication adherence and patterns.
                </p>
              </div>
              
              <Button variant="outline" className="w-full sm:w-auto">
                <Download className="mr-2 h-4 w-4" />
                Export Report
              </Button>
            </div>
            
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <LineChartIcon className="h-5 w-5" />
                    Weekly Adherence
                  </CardTitle>
                  <CardDescription>
                    Your medication adherence over the past week
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={adherenceData}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis domain={[0, 100]} />
                        <Tooltip 
                          formatter={(value) => [`${value}%`, 'Adherence']}
                        />
                        <Bar 
                          dataKey="adherence" 
                          fill="#8B5CF6" 
                          radius={[4, 4, 0, 0]} 
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChartIcon className="h-5 w-5" />
                    Medication Status
                  </CardTitle>
                  <CardDescription>
                    Overview of your current medication statuses
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <RPieChart>
                        <Pie
                          data={medicationStatusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={70}
                          outerRadius={90}
                          fill="#8884d8"
                          paddingAngle={5}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {medicationStatusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Legend />
                        <Tooltip />
                      </RPieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Monthly Summary
                </CardTitle>
                <CardDescription>
                  Your medication adherence trends over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={[
                        { date: 'Week 1', adherence: 80 },
                        { date: 'Week 2', adherence: 65 },
                        { date: 'Week 3', adherence: 90 },
                        { date: 'Week 4', adherence: 85 },
                      ]}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip 
                        formatter={(value) => [`${value}%`, 'Adherence']}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="adherence" 
                        stroke="#8B5CF6" 
                        strokeWidth={2} 
                        dot={{ r: 6 }}
                        activeDot={{ r: 8 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      <Footer />
    </div>
  );
};

export default Analytics;
