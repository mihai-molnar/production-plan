import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  AppState,
  Line,
  Reference,
  Throughput,
  Availability,
  SetupTime,
  Demand,
  PlanItem,
} from '../types';

const STORAGE_KEY = 'production-plan-data';

const initialState: AppState = {
  lines: [],
  references: [],
  throughputs: [],
  availabilities: [],
  setupTimes: [],
  demands: [],
  planItems: [],
};

interface AppContextType {
  state: AppState;
  addLine: (line: Line) => void;
  updateLine: (id: string, line: Partial<Line>) => void;
  deleteLine: (id: string) => void;
  addReference: (reference: Reference) => void;
  updateReference: (id: string, reference: Partial<Reference>) => void;
  deleteReference: (id: string) => void;
  addThroughput: (throughput: Throughput) => void;
  updateThroughput: (lineId: string, referenceId: string, throughput: Partial<Throughput>) => void;
  deleteThroughput: (lineId: string, referenceId: string) => void;
  addAvailability: (availability: Availability) => void;
  updateAvailability: (lineId: string, dayOfWeek: number, availability: Partial<Availability>) => void;
  deleteAvailability: (lineId: string, dayOfWeek: number) => void;
  addSetupTime: (setupTime: SetupTime) => void;
  updateSetupTime: (lineId: string, fromRefId: string, toRefId: string, setupTime: Partial<SetupTime>) => void;
  deleteSetupTime: (lineId: string, fromRefId: string, toRefId: string) => void;
  addDemand: (demand: Demand) => void;
  deleteDemand: (index: number) => void;
  setPlanItems: (planItems: PlanItem[]) => void;
  setPlanWeek: (week: number) => void;
  setPlanErrors: (errors: string[]) => void;
  setPlanWarnings: (warnings: string[]) => void;
  setWeekInput: (weekInput: string) => void;
  clearAll: () => void;
  exportData: () => string;
  importData: (jsonData: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AppState>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error('Error loading stored data:', e);
        return initialState;
      }
    }
    return initialState;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const addLine = (line: Line) => {
    setState((prev) => ({ ...prev, lines: [...prev.lines, line] }));
  };

  const updateLine = (id: string, line: Partial<Line>) => {
    setState((prev) => ({
      ...prev,
      lines: prev.lines.map((l) => (l.id === id ? { ...l, ...line } : l)),
    }));
  };

  const deleteLine = (id: string) => {
    setState((prev) => ({
      ...prev,
      lines: prev.lines.filter((l) => l.id !== id),
      throughputs: prev.throughputs.filter((t) => t.lineId !== id),
      availabilities: prev.availabilities.filter((a) => a.lineId !== id),
      setupTimes: prev.setupTimes.filter((s) => s.lineId !== id),
    }));
  };

  const addReference = (reference: Reference) => {
    setState((prev) => ({ ...prev, references: [...prev.references, reference] }));
  };

  const updateReference = (id: string, reference: Partial<Reference>) => {
    setState((prev) => ({
      ...prev,
      references: prev.references.map((r) => (r.id === id ? { ...r, ...reference } : r)),
    }));
  };

  const deleteReference = (id: string) => {
    setState((prev) => ({
      ...prev,
      references: prev.references.filter((r) => r.id !== id),
      throughputs: prev.throughputs.filter((t) => t.referenceId !== id),
      setupTimes: prev.setupTimes.filter((s) => s.fromReferenceId !== id && s.toReferenceId !== id),
    }));
  };

  const addThroughput = (throughput: Throughput) => {
    setState((prev) => ({ ...prev, throughputs: [...prev.throughputs, throughput] }));
  };

  const updateThroughput = (lineId: string, referenceId: string, throughput: Partial<Throughput>) => {
    setState((prev) => ({
      ...prev,
      throughputs: prev.throughputs.map((t) =>
        t.lineId === lineId && t.referenceId === referenceId ? { ...t, ...throughput } : t
      ),
    }));
  };

  const deleteThroughput = (lineId: string, referenceId: string) => {
    setState((prev) => ({
      ...prev,
      throughputs: prev.throughputs.filter((t) => !(t.lineId === lineId && t.referenceId === referenceId)),
    }));
  };

  const addAvailability = (availability: Availability) => {
    setState((prev) => ({ ...prev, availabilities: [...prev.availabilities, availability] }));
  };

  const updateAvailability = (lineId: string, dayOfWeek: number, availability: Partial<Availability>) => {
    setState((prev) => ({
      ...prev,
      availabilities: prev.availabilities.map((a) =>
        a.lineId === lineId && a.dayOfWeek === dayOfWeek ? { ...a, ...availability } : a
      ),
    }));
  };

  const deleteAvailability = (lineId: string, dayOfWeek: number) => {
    setState((prev) => ({
      ...prev,
      availabilities: prev.availabilities.filter((a) => !(a.lineId === lineId && a.dayOfWeek === dayOfWeek)),
    }));
  };

  const addSetupTime = (setupTime: SetupTime) => {
    setState((prev) => ({ ...prev, setupTimes: [...prev.setupTimes, setupTime] }));
  };

  const updateSetupTime = (lineId: string, fromRefId: string, toRefId: string, setupTime: Partial<SetupTime>) => {
    setState((prev) => ({
      ...prev,
      setupTimes: prev.setupTimes.map((s) =>
        s.lineId === lineId && s.fromReferenceId === fromRefId && s.toReferenceId === toRefId
          ? { ...s, ...setupTime }
          : s
      ),
    }));
  };

  const deleteSetupTime = (lineId: string, fromRefId: string, toRefId: string) => {
    setState((prev) => ({
      ...prev,
      setupTimes: prev.setupTimes.filter(
        (s) => !(s.lineId === lineId && s.fromReferenceId === fromRefId && s.toReferenceId === toRefId)
      ),
    }));
  };

  const addDemand = (demand: Demand) => {
    setState((prev) => ({ ...prev, demands: [...prev.demands, demand] }));
  };

  const deleteDemand = (index: number) => {
    setState((prev) => ({
      ...prev,
      demands: prev.demands.filter((_, i) => i !== index),
    }));
  };

  const setPlanItems = (planItems: PlanItem[]) => {
    setState((prev) => ({ ...prev, planItems }));
  };

  const setPlanWeek = (week: number) => {
    setState((prev) => ({ ...prev, planWeek: week }));
  };

  const setPlanErrors = (errors: string[]) => {
    setState((prev) => ({ ...prev, planErrors: errors }));
  };

  const setPlanWarnings = (warnings: string[]) => {
    setState((prev) => ({ ...prev, planWarnings: warnings }));
  };

  const setWeekInput = (weekInput: string) => {
    setState((prev) => ({ ...prev, weekInput }));
  };

  const clearAll = () => {
    setState(initialState);
  };

  const exportData = () => {
    return JSON.stringify(state, null, 2);
  };

  const importData = (jsonData: string) => {
    try {
      const data = JSON.parse(jsonData);
      setState(data);
    } catch (e) {
      throw new Error('Invalid JSON data');
    }
  };

  return (
    <AppContext.Provider
      value={{
        state,
        addLine,
        updateLine,
        deleteLine,
        addReference,
        updateReference,
        deleteReference,
        addThroughput,
        updateThroughput,
        deleteThroughput,
        addAvailability,
        updateAvailability,
        deleteAvailability,
        addSetupTime,
        updateSetupTime,
        deleteSetupTime,
        addDemand,
        deleteDemand,
        setPlanItems,
        setPlanWeek,
        setPlanErrors,
        setPlanWarnings,
        setWeekInput,
        clearAll,
        exportData,
        importData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
