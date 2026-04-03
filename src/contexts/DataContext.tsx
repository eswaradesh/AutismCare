import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { format } from 'date-fns';
import { useAuth } from './AuthContext';
import {
  getParentData,
  addParentRoutineEntry,
  addParentBehaviorEntry,
  addParentMedication,
  updateParentMedication,
  deleteParentMedication,
  shareBehaviorAlert,
  getLinkedTherapists,
} from '@/lib/therapistApi';

export interface RoutineEntry {
  id: string;
  child_id?: string | null;
  date: string;
  type: 'sleep' | 'food' | 'activity' | 'therapy';
  startTime?: string;
  endTime?: string;
  notes: string;
  voiceNote?: string;
  createdAt: string;
}

export interface BehaviorEntry {
  id: string;
  child_id?: string | null;
  date: string;
  emotion: string;
  intensity: 'low' | 'moderate' | 'high';
  trigger?: string;
  notes: string;
  isSudden: boolean;
  createdAt: string;
}

export interface Medication {
  id: string;
  name: string;
  time: string;
  frequency: 'daily' | 'twice-daily' | 'as-needed';
  notes?: string;
  enabled: boolean;
}

export interface DailySummary {
  id: string;
  date: string;
  sleepQuality: string;
  moodOverview: string;
  highlights: string[];
  positiveNotes: string;
  generatedAt: string;
}

interface DataContextType {
  routineEntries: RoutineEntry[];
  behaviorEntries: BehaviorEntry[];
  medications: Medication[];
  dailySummaries: DailySummary[];
  isLoading: boolean;
  addRoutineEntry: (entry: Omit<RoutineEntry, 'id' | 'createdAt'>) => Promise<void>;
  addBehaviorEntry: (entry: Omit<BehaviorEntry, 'id' | 'createdAt'>) => Promise<void>;
  addMedication: (medication: Omit<Medication, 'id'>) => Promise<void>;
  updateMedication: (id: string, medication: Partial<Medication>) => Promise<void>;
  deleteMedication: (id: string) => Promise<void>;
  getEntriesForDate: (date: string) => { routines: RoutineEntry[]; behaviors: BehaviorEntry[] };
  getSummaryForDate: (date: string) => DailySummary | undefined;
  refreshData: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const { user, childProfile, userRole } = useAuth();
  const [routineEntries, setRoutineEntries] = useState<RoutineEntry[]>([]);
  const [behaviorEntries, setBehaviorEntries] = useState<BehaviorEntry[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [dailySummaries, setDailySummaries] = useState<DailySummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    if (!user || userRole !== 'parent') {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const data = await getParentData();

      setRoutineEntries((data.routine_entries || []).map((r: any) => ({
        id: r.id,
        child_id: r.child_id,
        date: r.date,
        type: r.type,
        startTime: r.start_time || undefined,
        endTime: r.end_time || undefined,
        notes: r.notes || '',
        voiceNote: r.voice_note_url || undefined,
        createdAt: r.created_at,
      })));

      setBehaviorEntries((data.behavior_entries || []).map((b: any) => ({
        id: b.id,
        child_id: b.child_id,
        date: b.date,
        emotion: b.emotion,
        intensity: (b.intensity as 'low' | 'moderate' | 'high') || 'moderate',
        trigger: b.trigger || undefined,
        notes: b.notes || '',
        isSudden: b.is_sudden || false,
        createdAt: b.created_at,
      })));

      setMedications((data.medications || []).map((m: any) => ({
        id: m.id,
        name: m.name,
        time: m.time || '',
        frequency: (m.frequency as Medication['frequency']) || 'daily',
        notes: m.notes || undefined,
        enabled: m.enabled ?? true,
      })));

      setDailySummaries((data.daily_summaries || []).map((s: any) => ({
        id: s.id,
        date: s.date,
        sleepQuality: s.sleep_quality || '',
        moodOverview: s.mood_overview || '',
        highlights: Array.isArray(s.highlights) ? s.highlights : [],
        positiveNotes: s.positive_notes || '',
        generatedAt: s.generated_at || s.created_at,
      })));
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.id, userRole]);

  const addRoutineEntry = async (entry: Omit<RoutineEntry, 'id' | 'createdAt'>) => {
    if (!user) return;
    const data = await addParentRoutineEntry({
      child_id: childProfile?.id || null,
      date: entry.date,
      type: entry.type,
      start_time: entry.startTime || null,
      end_time: entry.endTime || null,
      notes: entry.notes || null,
      voice_note_url: entry.voiceNote || null,
    });
    const newEntry: RoutineEntry = {
      id: data.id,
      child_id: data.child_id,
      date: data.date,
      type: data.type,
      startTime: data.start_time || undefined,
      endTime: data.end_time || undefined,
      notes: data.notes || '',
      voiceNote: data.voice_note_url || undefined,
      createdAt: data.created_at,
    };
    setRoutineEntries(prev => [newEntry, ...prev]);
  };

  const addBehaviorEntry = async (entry: Omit<BehaviorEntry, 'id' | 'createdAt'>) => {
    if (!user) return;
    const data = await addParentBehaviorEntry({
      child_id: childProfile?.id || null,
      date: entry.date,
      emotion: entry.emotion,
      intensity: entry.intensity,
      trigger: entry.trigger || null,
      notes: entry.notes || null,
      is_sudden: entry.isSudden || false,
    });
    const newEntry: BehaviorEntry = {
      id: data.id,
      child_id: data.child_id,
      date: data.date,
      emotion: data.emotion,
      intensity: (data.intensity as 'low' | 'moderate' | 'high') || 'moderate',
      trigger: data.trigger || undefined,
      notes: data.notes || '',
      isSudden: data.is_sudden || false,
      createdAt: data.created_at,
    };
    setBehaviorEntries(prev => [newEntry, ...prev]);

    // Auto-alert for consecutive high intensity — backend handles the DB side
    // Just dispatch the custom event if needed
    if (entry.intensity === 'high' && childProfile?.id) {
      window.dispatchEvent(new CustomEvent('therapist-auto-alert', { detail: { count: 1 } }));
    }
  };

  const addMedication = async (medication: Omit<Medication, 'id'>) => {
    if (!user) return;
    const data = await addParentMedication({
      child_id: childProfile?.id || null,
      name: medication.name,
      time: medication.time || null,
      frequency: medication.frequency === 'as-needed' ? 'as needed' : medication.frequency,
      notes: medication.notes || null,
      enabled: medication.enabled ?? true,
    });
    const newMed: Medication = {
      id: data.id,
      name: data.name,
      time: data.time || '',
      frequency: (data.frequency === 'as needed' ? 'as-needed' : data.frequency) as Medication['frequency'],
      notes: data.notes || undefined,
      enabled: data.enabled ?? true,
    };
    setMedications(prev => [newMed, ...prev]);
  };

  const updateMedication = async (id: string, medication: Partial<Medication>) => {
    if (!user) return;
    const update: any = {};
    if (medication.name !== undefined) update.name = medication.name;
    if (medication.time !== undefined) update.time = medication.time || null;
    if (medication.frequency !== undefined) update.frequency = medication.frequency === 'as-needed' ? 'as needed' : medication.frequency;
    if (medication.notes !== undefined) update.notes = medication.notes || null;
    if (medication.enabled !== undefined) update.enabled = medication.enabled;

    const data = await updateParentMedication(id, update);
    const updatedMed: Medication = {
      id: data.id,
      name: data.name,
      time: data.time || '',
      frequency: (data.frequency === 'as needed' ? 'as-needed' : data.frequency) as Medication['frequency'],
      notes: data.notes || undefined,
      enabled: data.enabled ?? true,
    };
    setMedications(prev => prev.map(m => m.id === id ? updatedMed : m));
  };

  const deleteMedication = async (id: string) => {
    if (!user) return;
    await deleteParentMedication(id);
    setMedications(prev => prev.filter(m => m.id !== id));
  };

  const getEntriesForDate = (date: string) => ({
    routines: routineEntries.filter(e => e.date === date),
    behaviors: behaviorEntries.filter(e => e.date === date),
  });

  const getSummaryForDate = (date: string) => dailySummaries.find(s => s.date === date);

  const refreshData = async () => { await loadData(); };

  return (
    <DataContext.Provider
      value={{
        routineEntries,
        behaviorEntries,
        medications,
        dailySummaries,
        isLoading,
        addRoutineEntry,
        addBehaviorEntry,
        addMedication,
        updateMedication,
        deleteMedication,
        getEntriesForDate,
        getSummaryForDate,
        refreshData,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
