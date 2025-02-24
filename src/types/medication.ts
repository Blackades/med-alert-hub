
export type Medication = {
  id: string;
  name: string;
  dosage: string;
  instructions?: string;
  schedule: TimeSlot[];
  color?: string;
  frequency: {
    timesPerDay: number;
    intervalHours: number;
  };
};

export type TimeSlot = {
  id: string;
  time: string;
  taken: boolean;
  missed?: boolean;
  skipped?: boolean;
};

export type MedicationWithStatus = Medication & {
  nextDose: string;
  status: 'upcoming' | 'overdue' | 'taken';
  missed?: boolean;
};
