
import { format, parseISO, addDays, addHours, addWeeks, addMonths, isBefore } from "date-fns";
import type { Medication, MedicationWithStatus, TimeSlot, MedicationType } from "@/types/medication";

export const MEDICATION_TYPES: MedicationType[] = [
  "pill", 
  "capsule", 
  "tablet", 
  "liquid", 
  "injection", 
  "topical", 
  "inhaler", 
  "drops", 
  "patch", 
  "powder",
  "spray",
  "other"
];

export const FREQUENCY_OPTIONS = {
  DAILY: 'daily',
  TWICE_DAILY: 'twice_daily',
  THRICE_DAILY: 'thrice_daily',
  EVERY_HOUR: 'every_hour',
  SPECIFIC_TIMES: 'specific_times',
  EVERY_X_HOURS: 'every_x_hours',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  CUSTOM: 'custom'
};

export const calculateNextDose = (currentTime: Date, scheduledTime: string): string => {
  const todayStr = format(currentTime, "yyyy-MM-dd");
  const nextDoseTime = parseISO(`${todayStr}T${scheduledTime}`);
  return nextDoseTime <= currentTime 
    ? addDays(nextDoseTime, 1).toISOString()
    : nextDoseTime.toISOString();
};

export const getFrequencyHours = (frequency: string): number => {
  switch (frequency) {
    case FREQUENCY_OPTIONS.DAILY:
      return 24;
    case FREQUENCY_OPTIONS.TWICE_DAILY:
      return 12;
    case FREQUENCY_OPTIONS.THRICE_DAILY:
      return 8;
    case FREQUENCY_OPTIONS.EVERY_HOUR:
      return 1;
    // For custom frequencies, we'll need additional parameters
    default:
      if (frequency.startsWith('every_')) {
        const hours = parseInt(frequency.split('_')[1]);
        if (!isNaN(hours)) {
          return hours;
        }
      }
      return 24; // Default to daily if unrecognized
  }
};

export const getFrequencyDoses = (frequency: string): number => {
  switch (frequency) {
    case FREQUENCY_OPTIONS.DAILY:
      return 1;
    case FREQUENCY_OPTIONS.TWICE_DAILY:
      return 2;
    case FREQUENCY_OPTIONS.THRICE_DAILY:
      return 3;
    case FREQUENCY_OPTIONS.EVERY_HOUR:
      return 24;
    case FREQUENCY_OPTIONS.WEEKLY:
      return 1;
    case FREQUENCY_OPTIONS.MONTHLY:
      return 1;
    default:
      if (frequency.startsWith('every_')) {
        const hours = parseInt(frequency.split('_')[1]);
        if (!isNaN(hours)) {
          return 24 / hours;
        }
      } else if (frequency === FREQUENCY_OPTIONS.SPECIFIC_TIMES || frequency === FREQUENCY_OPTIONS.CUSTOM) {
        // For specific times or custom, the number of doses depends on the schedule
        return -1; // Signal that schedule needs to be checked
      }
      return 1;
  }
};

export const calculateNextReminderTime = (
  frequency: string,
  lastTaken: Date | string | null,
  customHours?: number
): Date => {
  const baseTime = lastTaken ? (typeof lastTaken === 'string' ? new Date(lastTaken) : lastTaken) : new Date();
  
  switch (frequency) {
    case FREQUENCY_OPTIONS.DAILY:
      return addHours(baseTime, 24);
    case FREQUENCY_OPTIONS.TWICE_DAILY:
      return addHours(baseTime, 12);
    case FREQUENCY_OPTIONS.THRICE_DAILY:
      return addHours(baseTime, 8);
    case FREQUENCY_OPTIONS.EVERY_HOUR:
      return addHours(baseTime, 1);
    case FREQUENCY_OPTIONS.WEEKLY:
      return addWeeks(baseTime, 1);
    case FREQUENCY_OPTIONS.MONTHLY:
      return addMonths(baseTime, 1);
    case FREQUENCY_OPTIONS.EVERY_X_HOURS:
      if (customHours && customHours > 0) {
        return addHours(baseTime, customHours);
      }
      return addHours(baseTime, 24); // Default fallback
    default:
      if (frequency.startsWith('every_')) {
        const hours = parseInt(frequency.split('_')[1]);
        if (!isNaN(hours)) {
          return addHours(baseTime, hours);
        }
      }
      return addHours(baseTime, 24); // Default to daily if unrecognized
  }
};

export const getMedicationStatus = (medication: Medication): MedicationWithStatus => {
  const now = new Date();
  const todayStr = format(now, "yyyy-MM-dd");
  
  if (!medication.schedule || medication.schedule.length === 0) {
    return {
      ...medication,
      nextDose: now.toISOString(),
      status: 'upcoming',
      schedule: [] // Ensure schedule is never undefined
    };
  }

  // Sort schedule times chronologically
  const validScheduleTimes = medication.schedule
    .filter(slot => slot && slot.time)
    .map(slot => parseISO(`${todayStr}T${slot.time}`))
    .sort((a, b) => a.getTime() - b.getTime());

  if (validScheduleTimes.length === 0) {
    return {
      ...medication,
      nextDose: now.toISOString(),
      status: 'upcoming',
      schedule: medication.schedule
    };
  }

  // Find the next upcoming dose time
  const nextDoseTime = validScheduleTimes.find(time => time > now) || 
    addDays(validScheduleTimes[0], 1);

  // Find the most recent past dose time
  const recentPastTimes = validScheduleTimes.filter(time => time <= now);
  const mostRecentTime = recentPastTimes.length > 0 ? 
    recentPastTimes[recentPastTimes.length - 1] : null;

  // Check if the recent dose was taken
  const recentTimeTaken = mostRecentTime && medication.schedule.some(slot => {
    const slotTime = parseISO(`${todayStr}T${slot.time}`);
    return slotTime.getTime() === mostRecentTime.getTime() && slot.taken;
  });

  // Calculate overdue status (10 minutes grace period)
  const isOverdue = mostRecentTime && 
    !recentTimeTaken && 
    now > addMinutes(mostRecentTime, 10);

  // Calculate overall status
  let status: 'upcoming' | 'overdue' | 'taken' | 'missed' = 'upcoming';
  
  if (isOverdue) {
    status = 'overdue';
  } else if (medication.schedule.some(slot => slot.missed)) {
    status = 'missed';
  } else if (medication.schedule.some(slot => slot.taken)) {
    status = 'taken';
  }

  // Find the last time this medication was taken
  const lastTakenSlot = medication.schedule
    .filter(slot => slot.taken && slot.last_taken_at)
    .sort((a, b) => {
      const dateA = a.last_taken_at ? new Date(a.last_taken_at).getTime() : 0;
      const dateB = b.last_taken_at ? new Date(b.last_taken_at).getTime() : 0;
      return dateB - dateA; // Sort in descending order (most recent first)
    })[0];

  return {
    ...medication,
    nextDose: nextDoseTime.toISOString(),
    status,
    lastTaken: lastTakenSlot?.last_taken_at,
    next_reminder_at: medication.schedule[0]?.next_reminder_at,
    missed: status === 'missed'
  };
};

// Helper function to add minutes to a date
function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000);
}

// Format frequency for display
export const formatFrequency = (frequency: string): string => {
  switch (frequency) {
    case FREQUENCY_OPTIONS.DAILY:
      return 'Once daily';
    case FREQUENCY_OPTIONS.TWICE_DAILY:
      return 'Twice daily';
    case FREQUENCY_OPTIONS.THRICE_DAILY:
      return 'Three times daily';
    case FREQUENCY_OPTIONS.EVERY_HOUR:
      return 'Every hour';
    case FREQUENCY_OPTIONS.SPECIFIC_TIMES:
      return 'At specific times';
    case FREQUENCY_OPTIONS.WEEKLY:
      return 'Weekly';
    case FREQUENCY_OPTIONS.MONTHLY:
      return 'Monthly';
    default:
      if (frequency.startsWith('every_')) {
        const hours = parseInt(frequency.split('_')[1]);
        if (!isNaN(hours)) {
          return `Every ${hours} hour${hours > 1 ? 's' : ''}`;
        }
      }
      return 'Custom schedule';
  }
};

export const createDefaultSchedule = (frequency: string, startTime?: string): TimeSlot[] => {
  const defaultStartTime = startTime || '08:00';
  
  switch (frequency) {
    case FREQUENCY_OPTIONS.DAILY:
      return [{ id: crypto.randomUUID(), time: defaultStartTime, taken: false }];
      
    case FREQUENCY_OPTIONS.TWICE_DAILY: {
      const firstTime = defaultStartTime;
      const secondTime = addHoursToTimeString(firstTime, 12);
      return [
        { id: crypto.randomUUID(), time: firstTime, taken: false },
        { id: crypto.randomUUID(), time: secondTime, taken: false }
      ];
    }
    
    case FREQUENCY_OPTIONS.THRICE_DAILY: {
      const firstTime = defaultStartTime;
      const secondTime = addHoursToTimeString(firstTime, 8);
      const thirdTime = addHoursToTimeString(secondTime, 8);
      return [
        { id: crypto.randomUUID(), time: firstTime, taken: false },
        { id: crypto.randomUUID(), time: secondTime, taken: false },
        { id: crypto.randomUUID(), time: thirdTime, taken: false }
      ];
    }
    
    case FREQUENCY_OPTIONS.EVERY_HOUR: {
      const slots: TimeSlot[] = [];
      let currentHour = parseInt(defaultStartTime.split(':')[0]);
      const minutes = defaultStartTime.split(':')[1];
      
      for (let i = 0; i < 24; i++) {
        slots.push({
          id: crypto.randomUUID(),
          time: `${currentHour.toString().padStart(2, '0')}:${minutes}`,
          taken: false
        });
        currentHour = (currentHour + 1) % 24;
      }
      return slots;
    }
    
    default:
      // For custom schedules or unrecognized frequencies, return a single slot
      return [{ id: crypto.randomUUID(), time: defaultStartTime, taken: false }];
  }
};

// Helper function to add hours to a time string
function addHoursToTimeString(timeStr: string, hoursToAdd: number): string {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const totalHours = (hours + hoursToAdd) % 24;
  return `${totalHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

// Calculate medication inventory status
export const calculateInventoryStatus = (
  currentQuantity: number,
  dosesPerDay: number, 
  doseAmount: number
): { daysRemaining: number; status: 'low' | 'medium' | 'good' } => {
  const dosesRemaining = Math.floor(currentQuantity / doseAmount);
  const daysRemaining = Math.floor(dosesRemaining / dosesPerDay);
  
  let status: 'low' | 'medium' | 'good';
  if (daysRemaining <= 7) {
    status = 'low';
  } else if (daysRemaining <= 14) {
    status = 'medium';
  } else {
    status = 'good';
  }
  
  return { daysRemaining, status };
};

// Check if a medication is active based on start and end dates
export const isMedicationActive = (medication: Medication): boolean => {
  const now = new Date();
  
  // Check start date
  if (medication.startDate && isBefore(now, new Date(medication.startDate))) {
    return false;
  }
  
  // Check end date
  if (medication.endDate && isBefore(new Date(medication.endDate), now)) {
    return false;
  }
  
  return true;
};
