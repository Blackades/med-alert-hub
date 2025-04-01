
export type MedicationType = 
  | "pill"
  | "capsule"
  | "tablet"
  | "liquid"
  | "injection"
  | "topical"
  | "inhaler"
  | "drops"
  | "patch"
  | "powder"
  | "spray"
  | "other";

export type FrequencyType =
  | "daily"
  | "twice_daily"
  | "thrice_daily"
  | "every_hour"
  | "specific_times"
  | "every_x_hours"
  | "weekly"
  | "monthly"
  | "custom";

export type Medication = {
  id: string;
  name: string;
  dosage: string;
  instructions?: string;
  schedule: TimeSlot[];
  color?: string;
  frequency: string;
  medicationType?: MedicationType;
  refillInfo?: {
    quantity: number;
    refillDate?: string;
    pharmacy?: string;
    prescriber?: string;
    prescription?: string;
  };
  inventory?: {
    currentQuantity: number;
    dosesPerDay: number;
    doseAmount: number;
    refillThreshold?: number;
  };
  startDate?: string;
  endDate?: string;
  image?: string;
  withFood?: boolean;
  sideEffects?: string[];
};

export type TimeSlot = {
  id: string;
  time: string;
  taken: boolean;
  missed?: boolean;
  skipped?: boolean;
  next_reminder_at?: string;
  last_taken_at?: string;
  reason?: string; // Reason for skipping or missing
};

export type MedicationWithStatus = Medication & {
  nextDose: string;
  status: 'upcoming' | 'overdue' | 'taken' | 'missed';
  lastTaken?: string;
  next_reminder_at?: string;
  missed?: boolean;
};

export type AdherenceRecord = {
  date: string;
  status: 'taken' | 'missed' | 'skipped';
  scheduledTime: string;
  takenTime?: string;
  delay?: number; // In minutes
};

export type MedicationLog = {
  id: string;
  medicationId: string;
  scheduledTime: string;
  takenTime?: string;
  status: 'taken' | 'missed' | 'skipped';
  reason?: string;
};

export type ReminderChannel = 'email' | 'push' | 'sms' | 'desktop' | 'device';

export type ReminderPreferences = {
  channels: ReminderChannel[];
  advanceNotice: number; // Minutes before scheduled time
  repeatInterval?: number; // Minutes between reminder repetitions
  quietHoursStart?: string; // Time in 24h format, e.g. "22:00"
  quietHoursEnd?: string; // Time in 24h format, e.g. "07:00"
  enableDeviceReminders?: boolean;
};
