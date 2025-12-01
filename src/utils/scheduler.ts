import type {
  AppState,
  PlanItem,
} from '../types';

interface LineSchedule {
  lineId: string;
  currentDate: Date;
  currentHour: number;
  lastReferenceId: string | null;
  dailyHoursUsed: Map<string, number>; // dateKey -> hours used
}

export function generateProductionPlan(state: AppState): {
  planItems: PlanItem[];
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const planItems: PlanItem[] = [];

  // Validate configuration
  if (state.lines.length === 0) {
    errors.push('No production lines configured');
    return { planItems, errors, warnings };
  }

  if (state.references.length === 0) {
    errors.push('No product references configured');
    return { planItems, errors, warnings };
  }

  if (state.throughputs.length === 0) {
    errors.push('No throughput rates configured');
    return { planItems, errors, warnings };
  }

  if (state.demands.length === 0) {
    errors.push('No demands to schedule');
    return { planItems, errors, warnings };
  }

  // Warn if no availabilities configured
  if (state.availabilities.length === 0) {
    errors.push('No line availability configured. Please configure which days lines are available.');
    return { planItems, errors, warnings };
  }

  // Info about setup times
  if (state.setupTimes.length === 0) {
    warnings.push('No setup times configured. All reference changes will be instantaneous (0 hours setup).');
  }

  // Sort demands: prioritize deadlines first, then largest quantity
  const sortedDemands = [...state.demands].sort((a, b) => {
    if (a.deadline && b.deadline) {
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    }
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return b.quantity - a.quantity;
  });

  // Initialize line schedules with week constraint
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 7); // One week limit

  const lineSchedules: Map<string, LineSchedule> = new Map();
  state.lines.forEach((line) => {
    lineSchedules.set(line.id, {
      lineId: line.id,
      currentDate: new Date(startDate),
      currentHour: 0,
      lastReferenceId: null,
      dailyHoursUsed: new Map(),
    });
  });

  // Schedule each demand
  for (const demand of sortedDemands) {
    let remainingQuantity = demand.quantity;
    const initialQuantity = demand.quantity;

    while (remainingQuantity > 0) {
      // Find best line for this demand that hasn't exceeded the week
      const bestLine = findBestLine(
        demand.referenceId,
        remainingQuantity,
        lineSchedules,
        state,
        endDate
      );

      if (!bestLine) {
        if (remainingQuantity === initialQuantity) {
          errors.push(
            `Cannot schedule demand for ${getReferenceName(demand.referenceId, state)}: No compatible line found or insufficient throughput configured`
          );
        } else {
          warnings.push(
            `Partial fulfillment for ${getReferenceName(demand.referenceId, state)}: ${(initialQuantity - remainingQuantity).toFixed(1)} tons scheduled, ${remainingQuantity.toFixed(1)} tons unmet (insufficient capacity within the week)`
          );
        }
        break;
      }

      const schedule = lineSchedules.get(bestLine.lineId)!;

      // Check if we're beyond the week limit
      if (schedule.currentDate >= endDate) {
        warnings.push(
          `Cannot fit remaining ${remainingQuantity.toFixed(1)} tons of ${getReferenceName(demand.referenceId, state)}: Week capacity exhausted`
        );
        break;
      }

      const throughput = state.throughputs.find(
        (t) => t.lineId === bestLine.lineId && t.referenceId === demand.referenceId
      )!;

      // Check if setup is needed (when switching references on the same line)
      if (schedule.lastReferenceId && schedule.lastReferenceId !== demand.referenceId) {
        const setupTime = getSetupTime(
          bestLine.lineId,
          schedule.lastReferenceId,
          demand.referenceId,
          state
        );

        // Always add setup when switching references, even if configured as 0
        // If no setup time configured, use 0 but still create the setup block for visibility
        const setupDuration = setupTime > 0 ? setupTime : 0;

        // Schedule setup time block
        const setupResult = scheduleTask(
          schedule,
          bestLine.lineId,
          demand.referenceId,
          0,
          setupDuration,
          true,
          state,
          endDate
        );

        if (setupResult) {
          planItems.push(setupResult);
        } else if (setupDuration > 0) {
          // Only warn if there was actual setup time that couldn't fit
          warnings.push(
            `Cannot fit setup time (${setupDuration.toFixed(1)}h) for ${getReferenceName(demand.referenceId, state)} on line ${state.lines.find(l => l.id === bestLine.lineId)?.name}: Insufficient time within the week`
          );
          break;
        }
      }

      // Calculate how much we can produce
      const availableHours = getAvailableHours(
        schedule,
        bestLine.lineId,
        state
      );

      if (availableHours <= 0) {
        // Move to next day
        schedule.currentDate.setDate(schedule.currentDate.getDate() + 1);
        schedule.currentHour = 0;

        // Check if we've exceeded the week
        if (schedule.currentDate >= endDate) {
          warnings.push(
            `Cannot fit remaining ${remainingQuantity.toFixed(1)} tons of ${getReferenceName(demand.referenceId, state)}: Week capacity exhausted`
          );
          break;
        }
        continue;
      }

      const hoursNeeded = remainingQuantity / throughput.rate;
      const hoursToUse = Math.min(hoursNeeded, availableHours);
      const quantityToSchedule = hoursToUse * throughput.rate;

      // Schedule production
      const productionResult = scheduleTask(
        schedule,
        bestLine.lineId,
        demand.referenceId,
        quantityToSchedule,
        hoursToUse,
        false,
        state,
        endDate
      );

      if (productionResult) {
        planItems.push(productionResult);
        remainingQuantity -= quantityToSchedule;
        schedule.lastReferenceId = demand.referenceId;
      } else {
        // Couldn't schedule within the week
        warnings.push(
          `Cannot fit remaining ${remainingQuantity.toFixed(1)} tons of ${getReferenceName(demand.referenceId, state)}: Week capacity exhausted`
        );
        break;
      }

      // If we couldn't schedule anything, move to next day
      if (quantityToSchedule === 0) {
        schedule.currentDate.setDate(schedule.currentDate.getDate() + 1);
        schedule.currentHour = 0;

        // Check if we've exceeded the week
        if (schedule.currentDate >= endDate) {
          warnings.push(
            `Cannot fit remaining ${remainingQuantity.toFixed(1)} tons of ${getReferenceName(demand.referenceId, state)}: Week capacity exhausted`
          );
          break;
        }
      }
    }
  }

  return { planItems, errors, warnings };
}

function findBestLine(
  referenceId: string,
  quantity: number,
  lineSchedules: Map<string, LineSchedule>,
  state: AppState,
  endDate: Date
): { lineId: string; cost: number } | null {
  let bestLine: { lineId: string; cost: number } | null = null;

  for (const [lineId, schedule] of lineSchedules) {
    // Skip lines that have exceeded the week
    if (schedule.currentDate >= endDate) continue;

    const throughput = state.throughputs.find(
      (t) => t.lineId === lineId && t.referenceId === referenceId
    );

    if (!throughput) continue; // Line cannot produce this reference

    const productionTime = quantity / throughput.rate;
    let setupTime = 0;

    // Check if this line would need setup time
    if (schedule.lastReferenceId && schedule.lastReferenceId !== referenceId) {
      setupTime = getSetupTime(lineId, schedule.lastReferenceId, referenceId, state);
    }

    // Calculate total cost including current utilization (for load balancing)
    const totalTimeUsed = Array.from(schedule.dailyHoursUsed.values()).reduce((sum, hours) => sum + hours, 0);
    const loadPenalty = totalTimeUsed * 0.1; // Small penalty for heavily used lines
    const cost = productionTime + setupTime + loadPenalty;

    if (!bestLine || cost < bestLine.cost) {
      bestLine = { lineId, cost };
    }
  }

  return bestLine;
}

function getSetupTime(
  lineId: string,
  fromRefId: string,
  toRefId: string,
  state: AppState
): number {
  const setupTime = state.setupTimes.find(
    (s) => s.lineId === lineId && s.fromReferenceId === fromRefId && s.toReferenceId === toRefId
  );
  return setupTime?.duration || 0;
}

function getAvailableHours(
  schedule: LineSchedule,
  lineId: string,
  state: AppState
): number {
  const dateKey = getDateKey(schedule.currentDate);
  // Convert JS day (0=Sunday) to EU day (0=Monday)
  const jsDayOfWeek = schedule.currentDate.getDay();
  const dayOfWeek = jsDayOfWeek === 0 ? 6 : jsDayOfWeek - 1;

  const availability = state.availabilities.find(
    (a) => a.lineId === lineId && a.dayOfWeek === dayOfWeek
  );

  if (!availability) return 0; // Line not available on this day

  const usedHours = schedule.dailyHoursUsed.get(dateKey) || 0;
  return Math.max(0, availability.hoursAvailable - usedHours);
}

function scheduleTask(
  schedule: LineSchedule,
  lineId: string,
  referenceId: string,
  quantity: number,
  duration: number,
  isSetup: boolean,
  state: AppState,
  endDate: Date
): PlanItem | null {
  // Check if we're already past the week limit
  if (schedule.currentDate >= endDate) {
    return null;
  }

  const availableHours = getAvailableHours(schedule, lineId, state);

  if (duration > availableHours) {
    // Task doesn't fit in remaining hours today, move to next day
    schedule.currentDate.setDate(schedule.currentDate.getDate() + 1);
    schedule.currentHour = 0;

    // Check if next day exceeds the week
    if (schedule.currentDate >= endDate) {
      return null;
    }

    return scheduleTask(schedule, lineId, referenceId, quantity, duration, isSetup, state, endDate);
  }

  const dateKey = getDateKey(schedule.currentDate);
  const startTime = new Date(schedule.currentDate);
  startTime.setHours(schedule.currentHour, 0, 0, 0);

  const endTime = new Date(startTime);
  endTime.setHours(startTime.getHours() + duration);

  const planItem: PlanItem = {
    date: dateKey,
    lineId,
    referenceId,
    quantity,
    duration,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    isSetup,
  };

  // Update schedule
  schedule.currentHour += duration;
  const usedHours = schedule.dailyHoursUsed.get(dateKey) || 0;
  schedule.dailyHoursUsed.set(dateKey, usedHours + duration);

  return planItem;
}

function getDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getReferenceName(referenceId: string, state: AppState): string {
  return state.references.find((r) => r.id === referenceId)?.name || referenceId;
}
