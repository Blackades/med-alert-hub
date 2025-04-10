
import { MedicationStreaks } from "@/components/streaks/MedicationStreaks";
import { MedicationStats } from "@/components/MedicationStats";
import { HealthTip } from "@/components/dashboard/HealthTip";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserSettingsDialog } from "@/components/UserSettingsDialog";
import { useUserSettings } from "@/components/dashboard/UserSettings";
import { DemoModePanel } from "@/components/DemoModePanel";

export const DashboardOverview = () => {
  const { saveSettings } = useUserSettings();

  return (
    <section className="grid gap-4 grid-cols-1 md:grid-cols-3">
      <div className="md:col-span-2 space-y-4">
        <DemoModePanel />
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-lg">Activity Overview</CardTitle>
              <CardDescription>Your recent medication activity</CardDescription>
            </div>
            <UserSettingsDialog onSave={saveSettings} />
          </CardHeader>
          <CardContent>
            <MedicationStats />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Health Tips</CardTitle>
            <CardDescription>Helpful tips for your health</CardDescription>
          </CardHeader>
          <CardContent>
            <HealthTip />
          </CardContent>
        </Card>
      </div>
      <div>
        <MedicationStreaks />
      </div>
    </section>
  );
};
