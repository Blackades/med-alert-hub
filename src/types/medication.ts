
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
  next_reminder_at?: string;
  last_taken_at?: string;
};

export type MedicationWithStatus = Medication & {
  nextDose: string;
  status: 'upcoming' | 'overdue' | 'taken' | 'missed';
  lastTaken?: string;
  next_reminder_at?: string;
};
