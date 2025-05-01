
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Pill, AlertCircle, Package, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MedicationRefillDialog } from "./MedicationRefillDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/AuthProvider";

interface MedicationInventoryItem {
  id: string;
  medication_id: string;
  medication_name: string;
  current_quantity: number;
  max_quantity: number;
  refill_threshold: number;
  last_refill_date: string;
  days_supply?: number;
}

export function MedicationInventory() {
  const [inventory, setInventory] = useState<MedicationInventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchInventory = async () => {
      if (!user) return;
      
      try {
        setIsLoading(true);
        
        // Fetch inventory with medication names
        const { data, error } = await supabase
          .from('medication_inventory')
          .select(`
            id, 
            current_quantity, 
            max_quantity, 
            refill_threshold, 
            last_refill_date,
            medication_id,
            medications:medication_id (name)
          `)
          .order('current_quantity', { ascending: true });
          
        if (error) throw error;
        
        if (data && Array.isArray(data)) {
          const formattedData = data.map(item => ({
            id: item.id,
            medication_id: item.medication_id,
            medication_name: item.medications?.name || 'Unknown Medication',
            current_quantity: item.current_quantity,
            max_quantity: item.max_quantity || 100,
            refill_threshold: item.refill_threshold || 10,
            last_refill_date: item.last_refill_date,
            days_supply: Math.floor(item.current_quantity / 1) // Assuming 1 dose per day
          }));
          
          setInventory(formattedData);
        }
      } catch (error) {
        console.error('Error fetching inventory:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchInventory();
  }, [user]);
  
  const getStatusColor = (current: number, threshold: number) => {
    if (current <= 0) return "bg-destructive text-destructive-foreground";
    if (current <= threshold) return "bg-amber-500 text-white";
    return "bg-primary text-primary-foreground";
  };
  
  const getProgressColor = (current: number, max: number, threshold: number) => {
    const percentage = (current / max) * 100;
    if (current <= 0) return "bg-destructive";
    if (current <= threshold) return "bg-amber-500";
    if (percentage < 25) return "bg-amber-500";
    if (percentage < 50) return "bg-amber-300";
    return "bg-primary";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Medication Inventory
        </CardTitle>
        <CardDescription>
          Track your medication supply and refill status
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>
        ) : inventory.length === 0 ? (
          <div className="text-center py-6">
            <Pill className="h-12 w-12 mx-auto text-muted-foreground opacity-20" />
            <h3 className="mt-4 text-lg font-medium">No inventory data</h3>
            <p className="text-muted-foreground mt-1">
              Your medication inventory will appear here once you start tracking refills
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {inventory.map((item) => (
              <div key={item.id} className="space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium">{item.medication_name}</h3>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <span>{item.current_quantity} units remaining</span>
                      {item.days_supply && (
                        <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">
                          ~{item.days_supply} days supply
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <MedicationRefillDialog 
                    medicationId={item.medication_id}
                    medicationName={item.medication_name}
                  >
                    <Button 
                      variant="outline" 
                      size="sm"
                      className={`${
                        item.current_quantity <= item.refill_threshold 
                          ? "border-amber-500 text-amber-500 hover:bg-amber-500/10" 
                          : ""
                      }`}
                    >
                      {item.current_quantity <= item.refill_threshold ? (
                        <>
                          <AlertCircle className="h-3.5 w-3.5 mr-1" />
                          Refill Now
                        </>
                      ) : (
                        "Add Refill"
                      )}
                    </Button>
                  </MedicationRefillDialog>
                </div>
                
                <Progress 
                  value={(item.current_quantity / item.max_quantity) * 100} 
                  className="h-2"
                  indicatorClassName={getProgressColor(
                    item.current_quantity, 
                    item.max_quantity, 
                    item.refill_threshold
                  )}
                />
                
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span className={item.current_quantity <= item.refill_threshold ? "text-amber-500" : ""}>
                    {item.current_quantity <= item.refill_threshold ? "Refill needed" : "Sufficient supply"}
                  </span>
                  <span>Max: {item.max_quantity}</span>
                </div>
              </div>
            ))}
            
            <div className="pt-4 border-t">
              <h4 className="text-sm font-medium flex items-center gap-1 mb-3">
                <BarChart3 className="h-4 w-4" />
                Refill Statistics
              </h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-primary/5 p-3 rounded-lg">
                  <div className="text-2xl font-bold">
                    {inventory.reduce((sum, item) => sum + item.current_quantity, 0)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Total units in inventory
                  </div>
                </div>
                
                <div className="bg-primary/5 p-3 rounded-lg">
                  <div className="text-2xl font-bold">
                    {inventory.filter(item => item.current_quantity <= item.refill_threshold).length}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Medications needing refill
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
