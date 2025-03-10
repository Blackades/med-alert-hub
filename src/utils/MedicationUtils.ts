
import { format, parseISO, addDays } from "date-fns";
import type { Medication, MedicationWithStatus } from "@/types/medication";

export const calculateNextDose = (currentTime: Date, scheduledTime: string): string => {
  const todayStr = format(currentTime, "yyyy-MM-dd");
  const nextDoseTime = parseISO(`${todayStr}T${scheduledTime}`);
  return nextDoseTime <= currentTime 
    ? addDays(nextDoseTime, 1).toISOString()
    : nextDoseTime.toISOString();
};

export const getFrequencyHours = (frequency: string): number => {
  switch (frequency) {
    case 'daily':
      return 24;
    case 'twice_daily':
      return 12;
    case 'thrice_daily':
      return 8;
    case 'every_hour':
      return 1;
    default:
      return 24;
  }
};

export const getFrequencyDoses = (frequency: string): number => {
  switch (frequency) {
    case 'daily':
      return 1;
    case 'twice_daily':
      return 2;
    case 'thrice_daily':
      return 3;
    case 'every_hour':
      return 24;
    default:
      return 1;
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

  const validScheduleTimes = medication.schedule
    .filter(slot => slot && slot.time)
    .map(slot => parseISO(`${todayStr}T${slot.time}`));

  if (validScheduleTimes.length === 0) {
    return {
      ...medication,
      nextDose: now.toISOString(),
      status: 'upcoming',
      schedule: medication.schedule
    };
  }

  const nextDoseTime = validScheduleTimes.find(time => time > now) || 
    addDays(parseISO(`${todayStr}T${medication.schedule[0].time}`), 1);

  const status = medication.schedule.some(slot => slot.taken)
    ? 'taken'
    : nextDoseTime < now
    ? 'overdue'
    : 'upcoming';

  return {
    ...medication,
    nextDose: nextDoseTime.toISOString(),
    status,
  };
};
