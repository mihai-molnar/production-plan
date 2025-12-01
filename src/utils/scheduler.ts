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
  // Start from Monday of the current week (EU week system)
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);

  // Get the current day (0=Sunday, 1=Monday, ..., 6=Saturday)
  const currentDay = startDate.getDay();
  // Calculate days to subtract to get to Monday
  const daysToMonday = currentDay === 0 ? 6 : currentDay - 1; // If Sunday, go back 6 days; else go back (day - 1)
  startDate.setDate(startDate.getDate() - daysToMonday);

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6); // 6 days from Monday = Sunday
  endDate.setHours(23, 59, 59, 999); // Include the full Sunday

  console.log(`[SCHEDULER] Planning week: ${startDate.toDateString()} to ${endDate.toDateString()}`);

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
    const deadlineDate = demand.deadline ? new Date(demand.deadline) : endDate;

    // Ensure deadline is within the planning week
    const effectiveDeadline = deadlineDate < endDate ? deadlineDate : endDate;

    while (remainingQuantity > 0) {
      // DEBUG: Log iteration start
      console.log(`[SCHEDULER] Scheduling ${getReferenceName(demand.referenceId, state)}: ${remainingQuantity.toFixed(1)} tons remaining`);

      // Find best line for this demand that hasn't exceeded the deadline
      const bestLine = findBestLine(
        demand.referenceId,
        remainingQuantity,
        lineSchedules,
        state,
        effectiveDeadline,
        planItems
      );

      if (bestLine) {
        const selectedSchedule = lineSchedules.get(bestLine.lineId)!;
        const selectedLineName = state.lines.find(l => l.id === bestLine.lineId)?.name || bestLine.lineId;
        console.log(`[SCHEDULER] Selected ${selectedLineName}, currentDate=${selectedSchedule.currentDate.toDateString()}, cost=${bestLine.cost.toFixed(1)}`);
      }

      if (!bestLine) {
        // DEBUG: Log why we couldn't find a line
        console.log(`[SCHEDULER DEBUG] No line found for ${getReferenceName(demand.referenceId, state)}, remaining: ${remainingQuantity.toFixed(1)} tons`);
        console.log('[SCHEDULER DEBUG] Line schedules:');
        for (const [lineId, schedule] of lineSchedules) {
          const lineName = state.lines.find(l => l.id === lineId)?.name || lineId;
          const canProduce = state.throughputs.find(t => t.lineId === lineId && t.referenceId === demand.referenceId);
          const availableHours = getAvailableHours(schedule, lineId, state);
          console.log(`  ${lineName}: currentDate=${schedule.currentDate.toDateString()}, endDate=${effectiveDeadline.toDateString()}, pastDeadline=${schedule.currentDate >= effectiveDeadline}, canProduce=${!!canProduce}, availableToday=${availableHours.toFixed(1)}h`);
        }

        if (remainingQuantity === initialQuantity) {
          if (demand.deadline) {
            errors.push(
              `Cannot schedule demand for ${getReferenceName(demand.referenceId, state)}: No compatible line found or cannot meet deadline of ${new Date(demand.deadline).toLocaleDateString()}`
            );
          } else {
            errors.push(
              `Cannot schedule demand for ${getReferenceName(demand.referenceId, state)}: No compatible line found or insufficient throughput configured`
            );
          }
        } else {
          if (demand.deadline) {
            warnings.push(
              `Partial fulfillment for ${getReferenceName(demand.referenceId, state)}: ${(initialQuantity - remainingQuantity).toFixed(1)} tons scheduled, ${remainingQuantity.toFixed(1)} tons unmet (cannot meet deadline of ${new Date(demand.deadline).toLocaleDateString()})`
            );
          } else {
            warnings.push(
              `Partial fulfillment for ${getReferenceName(demand.referenceId, state)}: ${(initialQuantity - remainingQuantity).toFixed(1)} tons scheduled, ${remainingQuantity.toFixed(1)} tons unmet (insufficient capacity within the week)`
            );
          }
        }
        break;
      }

      const schedule = lineSchedules.get(bestLine.lineId)!;
      const lineName = state.lines.find(l => l.id === bestLine.lineId)?.name || bestLine.lineId;

      // Check if we're beyond the deadline/week limit
      if (schedule.currentDate >= effectiveDeadline) {
        console.log(`[SCHEDULER] STOPPING: ${lineName} currentDate (${schedule.currentDate.toDateString()}) >= deadline (${effectiveDeadline.toDateString()})`);
        if (demand.deadline) {
          warnings.push(
            `Cannot fit remaining ${remainingQuantity.toFixed(1)} tons of ${getReferenceName(demand.referenceId, state)}: Deadline of ${new Date(demand.deadline).toLocaleDateString()} cannot be met`
          );
        } else {
          warnings.push(
            `Cannot fit remaining ${remainingQuantity.toFixed(1)} tons of ${getReferenceName(demand.referenceId, state)}: Week capacity exhausted`
          );
        }
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
          effectiveDeadline
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
        // No capacity left on this line today - advance to next day
        schedule.currentDate.setDate(schedule.currentDate.getDate() + 1);
        schedule.currentHour = 0;

        // Check if we've exceeded the deadline/week
        if (schedule.currentDate > effectiveDeadline) {
          // This line is exhausted, but don't give up yet - try to find another line
          console.log(`[SCHEDULER] ${lineName} exhausted, trying other lines for remaining ${remainingQuantity.toFixed(1)} tons`);
          // Break from this line's attempt and findBestLine will try other lines
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
        effectiveDeadline
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

        // Check if we've exceeded the deadline/week
        if (schedule.currentDate > effectiveDeadline) {
          // This line is exhausted, try another line
          console.log(`[SCHEDULER] ${lineName} exhausted (no quantity scheduled), trying other lines`);
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
  effectiveDeadline: Date,
  planItems: PlanItem[]
): { lineId: string; cost: number } | null {
  let bestLine: { lineId: string; cost: number } | null = null;

  // Check if this reference has already been scheduled on a line
  const existingLine = planItems
    .filter((p) => p.referenceId === referenceId && !p.isSetup)
    .map((p) => p.lineId)[0];

  // Check if existing line still has substantial capacity available
  let existingLineHasCapacity = false;
  if (existingLine) {
    const existingSchedule = lineSchedules.get(existingLine);
    if (existingSchedule && existingSchedule.currentDate <= effectiveDeadline) {
      // Calculate TOTAL remaining capacity on existing line (not just today)
      const totalCapacityLeft = Array.from(
        { length: 7 },
        (_, dayIndex) => {
          const checkDate = new Date(existingSchedule.currentDate);
          checkDate.setDate(checkDate.getDate() + dayIndex);
          if (checkDate > effectiveDeadline) return 0;

          const jsDayOfWeek = checkDate.getDay();
          const dayOfWeek = jsDayOfWeek === 0 ? 6 : jsDayOfWeek - 1;
          const availability = state.availabilities.find(
            (a) => a.lineId === existingLine && a.dayOfWeek === dayOfWeek
          );
          if (!availability) return 0;

          const dateKey = getDateKey(checkDate);
          const usedHours = existingSchedule.dailyHoursUsed.get(dateKey) || 0;
          return Math.max(0, availability.hoursAvailable - usedHours);
        }
      ).reduce((sum, hours) => sum + hours, 0);

      existingLineHasCapacity = totalCapacityLeft > 24; // Substantial capacity = more than 1 day
    }
  }

  for (const [lineId, schedule] of lineSchedules) {
    const throughput = state.throughputs.find(
      (t) => t.lineId === lineId && t.referenceId === referenceId
    );

    if (!throughput) continue; // Line cannot produce this reference

    // Calculate total remaining capacity across all remaining days until the effective deadline
    let totalRemainingCapacity = 0;
    const tempDate = new Date(schedule.currentDate);

    // Check capacity until the effective deadline for this demand
    while (tempDate <= effectiveDeadline) {
      const jsDayOfWeek = tempDate.getDay();
      const dayOfWeek = jsDayOfWeek === 0 ? 6 : jsDayOfWeek - 1;
      const availability = state.availabilities.find(
        (a) => a.lineId === lineId && a.dayOfWeek === dayOfWeek
      );

      if (availability) {
        const dateKey = getDateKey(tempDate);
        const usedHours = schedule.dailyHoursUsed.get(dateKey) || 0;
        totalRemainingCapacity += Math.max(0, availability.hoursAvailable - usedHours);
      }

      tempDate.setDate(tempDate.getDate() + 1);
    }

    // Skip lines with NO remaining capacity before the deadline
    if (totalRemainingCapacity <= 0) {
      console.log(`[SCHEDULER] Skipping ${state.lines.find(l => l.id === lineId)?.name}: No remaining capacity before deadline`);
      continue;
    }

    const productionTime = quantity / throughput.rate;
    let setupTime = 0;
    let setupPenalty = 0;

    // Priority system (lower cost = better):
    // 1. Highest throughput (most important - we want fastest line)
    // 2. Minimize setup changes (continue on same line if possible)
    // 3. Avoid splitting references across lines if existing line has capacity

    // Throughput is PRIMARY factor - strongly prefer faster lines
    // Negative because we want to MINIMIZE cost (higher throughput = lower cost)
    const throughputScore = -throughput.rate * 1000;

    // Setup penalty: prefer lines already running this reference
    if (existingLine === lineId) {
      // Calculate how much capacity is left on this line before the deadline
      const totalCapacityLeft = Array.from(
        { length: 7 },
        (_, dayIndex) => {
          const checkDate = new Date(schedule.currentDate);
          checkDate.setDate(checkDate.getDate() + dayIndex);
          if (checkDate > effectiveDeadline) return 0;

          const jsDayOfWeek = checkDate.getDay();
          const dayOfWeek = jsDayOfWeek === 0 ? 6 : jsDayOfWeek - 1;
          const availability = state.availabilities.find(
            (a) => a.lineId === lineId && a.dayOfWeek === dayOfWeek
          );
          if (!availability) return 0;

          const checkDateKey = getDateKey(checkDate);
          const usedHours = schedule.dailyHoursUsed.get(checkDateKey) || 0;
          return Math.max(0, availability.hoursAvailable - usedHours);
        }
      ).reduce((sum, hours) => sum + hours, 0);

      // Moderate bonus for continuing on same line (if it has capacity)
      if (totalCapacityLeft > 1) {
        setupPenalty = -100; // Bonus for continuing on existing line
      } else {
        setupPenalty = 0; // No bonus if line is exhausted
      }
    } else if (existingLine && existingLine !== lineId && existingLineHasCapacity) {
      // Small penalty for splitting across lines
      setupPenalty = 50;
    }

    // Check if this line would need setup time (switching from different reference)
    if (schedule.lastReferenceId && schedule.lastReferenceId !== referenceId) {
      setupTime = getSetupTime(lineId, schedule.lastReferenceId, referenceId, state);
      setupPenalty += setupTime * 10; // Penalize setup time
    }

    // Cost calculation: throughput is PRIMARY, then setup considerations
    const cost = throughputScore + setupTime + setupPenalty;

    // DEBUG: Log all candidate lines
    const lineName = state.lines.find(l => l.id === lineId)?.name || lineId;
    console.log(`  [CANDIDATE] ${lineName}: cost=${cost.toFixed(1)}, prodTime=${productionTime.toFixed(1)}, setup=${setupTime.toFixed(1)}, penalty=${setupPenalty.toFixed(1)}, throughputScore=${throughputScore.toFixed(1)}`);

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

  const usedHours = schedule.dailyHoursUsed.get(dateKey) || 0;
  const availableHrs = availability ? Math.max(0, availability.hoursAvailable - usedHours) : 0;

  // Uncomment for debugging:
  // const lineName = state.lines.find(l => l.id === lineId)?.name || lineId;
  // const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  // console.log(`[AVAILABILITY] ${lineName} on ${dayNames[dayOfWeek]} (${dateKey}): jsDay=${jsDayOfWeek}, euDay=${dayOfWeek}, configured=${availability?.hoursAvailable || 0}h, used=${usedHours.toFixed(1)}h, available=${availableHrs.toFixed(1)}h`);

  if (!availability) return 0; // Line not available on this day

  return availableHrs;
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
  if (schedule.currentDate > endDate) {
    return null;
  }

  const availableHours = getAvailableHours(schedule, lineId, state);

  // If line has no availability today OR task doesn't fit, move to next day
  if (availableHours === 0 || duration > availableHours) {
    // Move to next day and try again
    schedule.currentDate.setDate(schedule.currentDate.getDate() + 1);
    schedule.currentHour = 0;

    // Check if next day exceeds the week
    if (schedule.currentDate > endDate) {
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
  // Use local timezone to avoid UTC conversion issues
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getReferenceName(referenceId: string, state: AppState): string {
  return state.references.find((r) => r.id === referenceId)?.name || referenceId;
}
