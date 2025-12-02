export interface Line {
  id: string;
  name: string;
}

export interface Reference {
  id: string;
  name: string;
}

export interface Throughput {
  lineId: string;
  referenceId: string;
  rate: number; // Tons/Hour
}

export interface Availability {
  lineId: string;
  dayOfWeek: number; // 0-6 (Monday to Sunday, EU week format)
  hoursAvailable: number; // e.g., 24, 16
}

export interface SetupTime {
  lineId: string;
  fromReferenceId: string;
  toReferenceId: string;
  duration: number; // Hours
}

export interface Demand {
  referenceId: string;
  quantity: number; // Tons
  deadline?: Date;
}

export interface PlanItem {
  date: string; // YYYY-MM-DD
  lineId: string;
  referenceId: string;
  quantity: number;
  duration: number; // hours
  startTime: string; // ISO
  endTime: string; // ISO
  isSetup: boolean;
}

export interface AppState {
  lines: Line[];
  references: Reference[];
  throughputs: Throughput[];
  availabilities: Availability[];
  setupTimes: SetupTime[];
  demands: Demand[];
  planItems: PlanItem[];
  planWeek?: number; // Week number for the current plan
  planErrors?: string[]; // Planning errors
  planWarnings?: string[]; // Planning warnings
  weekInput?: string; // Week number input value
}
