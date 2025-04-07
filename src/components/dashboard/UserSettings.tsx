
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";

export const useUserSettings = () => {
  const { toast } = useToast();
  const { user } = useAuth();

  const saveSettings = async (settings: { email: string; phoneNumber: string }) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          email: settings.email,
          phone_number: settings.phoneNumber 
        })
        .eq('id', user?.id);

      if (error) throw error;

      toast({
        title: "Settings saved",
        description: `Notifications will be sent to ${settings.email} and ${settings.phoneNumber}`,
      });
      
      return true;
    } catch (error: any) {
      toast({
        title: "Error saving settings",
        description: error.message,
        variant: "destructive",
      });
      
      return false;
    }
  };

  return { saveSettings };
};
