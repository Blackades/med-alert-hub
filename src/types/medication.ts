
export type Medication = {
  id: string;
  name: string;
  dosage: string;
  instructions?: string;
  schedule: TimeSlot[];
  color?: string;
};

export type TimeSlot = {
  id: string;
  time: string;
  taken: boolean;
};

export type MedicationWithStatus = Medication & {
  nextDose: string;
  status: 'upcoming' | 'overdue' | 'taken';
};
