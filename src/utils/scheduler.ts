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

interface LineCompatibility {
  lineId: string;
  referenceId: string;
  throughputRate: number;
  totalCapacity: number;
}

interface PreferredLineMap {
  [referenceId: string]: string; // referenceId -> preferred lineId
}

// Phase 1: Pre-Analysis - Build reference-line compatibility matrix
function buildCompatibilityMatrix(
  state: AppState,
  startDate: Date,
  endDate: Date
): LineCompatibility[] {
  const compatibilities: LineCompatibility[] = [];

  for (const reference of state.references) {
    for (const line of state.lines) {
      const throughput = state.throughputs.find(
        (t) => t.lineId === line.id && t.referenceId === reference.id
      );

      if (throughput) {
        // Calculate total available hours for this line
        let totalHours = 0;
        const tempDate = new Date(startDate);

        while (tempDate <= endDate) {
          const jsDayOfWeek = tempDate.getDay();
          const dayOfWeek = jsDayOfWeek === 0 ? 6 : jsDayOfWeek - 1;
          const availability = state.availabilities.find(
            (a) => a.lineId === line.id && a.dayOfWeek === dayOfWeek
          );

          if (availability) {
            totalHours += availability.hoursAvailable;
          }

          tempDate.setDate(tempDate.getDate() + 1);
        }

        compatibilities.push({
          lineId: line.id,
          referenceId: reference.id,
          throughputRate: throughput.rate,
          totalCapacity: totalHours * throughput.rate,
        });
      }
    }
  }

  return compatibilities;
}

// Phase 1: Identify optimal (preferred) line for each reference
function identifyPreferredLines(compatibilities: LineCompatibility[]): PreferredLineMap {
  const preferredLines: PreferredLineMap = {};

  // Group by reference
  const byReference = new Map<string, LineCompatibility[]>();
  for (const comp of compatibilities) {
    if (!byReference.has(comp.referenceId)) {
      byReference.set(comp.referenceId, []);
    }
    byReference.get(comp.referenceId)!.push(comp);
  }

  // For each reference, find the line with highest throughput
  for (const [referenceId, lines] of byReference) {
    lines.sort((a, b) => {
      // Sort by throughput rate (descending), then by total capacity (descending)
      if (b.throughputRate !== a.throughputRate) {
        return b.throughputRate - a.throughputRate;
      }
      return b.totalCapacity - a.totalCapacity;
    });

    if (lines.length > 0) {
      preferredLines[referenceId] = lines[0].lineId;
    }
  }

  return preferredLines;
}

export function generateProductionPlan(state: AppState, weekNumber: number = 1): {
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
  // Calculate start date for the specified week number (ISO week system)
  const now = new Date();
  const currentYear = now.getFullYear();

  // Get January 4th of the current year (always in week 1 by ISO definition)
  const jan4 = new Date(currentYear, 0, 4);

  // Find Monday of week 1
  const jan4Day = jan4.getDay();
  const daysToMonday = jan4Day === 0 ? 6 : jan4Day - 1;
  const week1Monday = new Date(jan4);
  week1Monday.setDate(jan4.getDate() - daysToMonday);

  // Calculate start date for the requested week
  const startDate = new Date(week1Monday);
  startDate.setDate(week1Monday.getDate() + (weekNumber - 1) * 7);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6); // 6 days from Monday = Sunday
  endDate.setHours(23, 59, 59, 999); // Include the full Sunday

  console.log(`[SCHEDULER] Planning Week ${weekNumber} (${currentYear}): ${startDate.toDateString()} to ${endDate.toDateString()}`);

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

  // Phase 1: Pre-Analysis
  console.log('[SCHEDULER] Phase 1: Building compatibility matrix and identifying preferred lines');
  const compatibilities = buildCompatibilityMatrix(state, startDate, endDate);
  const preferredLines = identifyPreferredLines(compatibilities);

  for (const [refId, lineId] of Object.entries(preferredLines)) {
    const refName = getReferenceName(refId, state);
    const lineName = state.lines.find(l => l.id === lineId)?.name || lineId;
    console.log(`[SCHEDULER] Preferred line for ${refName}: ${lineName}`);
  }

  // Phase 4: Schedule each demand with improved loop logic
  for (const demand of sortedDemands) {
    let remainingQuantity = demand.quantity;
    const initialQuantity = demand.quantity;
    const deadlineDate = demand.deadline ? new Date(demand.deadline) : endDate;

    // Ensure deadline is within the planning week
    const effectiveDeadline = deadlineDate < endDate ? deadlineDate : endDate;

    let selectedLineId: string | null = null;
    const attemptedLines = new Set<string>();

    while (remainingQuantity > 0) {
      console.log(`[SCHEDULER] Scheduling ${getReferenceName(demand.referenceId, state)}: ${remainingQuantity.toFixed(1)} tons remaining`);

      // Only select a new line if:
      // 1. We don't have a selected line yet, OR
      // 2. The current line is completely exhausted
      if (!selectedLineId) {
        selectedLineId = selectLineForDemand(
          demand.referenceId,
          remainingQuantity,
          lineSchedules,
          state,
          effectiveDeadline,
          planItems,
          preferredLines
        );

        if (!selectedLineId) {
          // No lines available at all
          if (remainingQuantity === initialQuantity) {
            if (demand.deadline) {
              errors.push(
                `Cannot schedule demand for ${getReferenceName(demand.referenceId, state)}: No compatible line found or cannot meet deadline of ${new Date(demand.deadline).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.')}`
              );
            } else {
              errors.push(
                `Cannot schedule demand for ${getReferenceName(demand.referenceId, state)}: No compatible line found or insufficient throughput configured`
              );
            }
          } else {
            if (demand.deadline) {
              warnings.push(
                `Partial fulfillment for ${getReferenceName(demand.referenceId, state)}: ${(initialQuantity - remainingQuantity).toFixed(1)} tons scheduled, ${remainingQuantity.toFixed(1)} tons unmet (cannot meet deadline of ${new Date(demand.deadline).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.')})`
              );
            } else {
              warnings.push(
                `Partial fulfillment for ${getReferenceName(demand.referenceId, state)}: ${(initialQuantity - remainingQuantity).toFixed(1)} tons scheduled, ${remainingQuantity.toFixed(1)} tons unmet (insufficient capacity within the week)`
              );
            }
          }
          break;
        }

        // Prevent infinite loops
        if (attemptedLines.has(selectedLineId)) {
          console.log(`[SCHEDULER] Already attempted line ${state.lines.find(l => l.id === selectedLineId)?.name}, breaking to avoid loop`);
          break;
        }
        attemptedLines.add(selectedLineId);
      }

      const schedule = lineSchedules.get(selectedLineId)!;
      const lineName = state.lines.find(l => l.id === selectedLineId)?.name || selectedLineId;

      // Check if we're beyond the deadline/week limit
      if (schedule.currentDate > effectiveDeadline) {
        console.log(`[SCHEDULER] Line ${lineName} exhausted (past deadline), selecting another line`);
        selectedLineId = null;
        continue;
      }

      const throughput = state.throughputs.find(
        (t) => t.lineId === selectedLineId && t.referenceId === demand.referenceId
      )!;

      // Check if setup is needed (when switching references on the same line)
      if (schedule.lastReferenceId && schedule.lastReferenceId !== demand.referenceId) {
        const setupTime = getSetupTime(
          selectedLineId,
          schedule.lastReferenceId,
          demand.referenceId,
          state
        );

        const setupDuration = setupTime > 0 ? setupTime : 0;

        // Schedule setup time block
        const setupResult = scheduleTask(
          schedule,
          selectedLineId,
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
          console.log(`[SCHEDULER] Setup couldn't fit on ${lineName}, trying another line`);
          selectedLineId = null;
          continue;
        }
      }

      // Calculate how much we can produce today
      const availableHours = getAvailableHours(schedule, selectedLineId, state);

      if (availableHours <= 0) {
        // No capacity left on this line today - advance to next day
        schedule.currentDate.setDate(schedule.currentDate.getDate() + 1);
        schedule.currentHour = 0;

        // Check if we've exceeded the deadline/week
        if (schedule.currentDate > effectiveDeadline) {
          console.log(`[SCHEDULER] Line ${lineName} completely exhausted, trying another line`);
          selectedLineId = null;
        }
        continue;
      }

      const hoursNeeded = remainingQuantity / throughput.rate;
      const hoursToUse = Math.min(hoursNeeded, availableHours);
      const quantityToSchedule = hoursToUse * throughput.rate;

      // Schedule production
      const productionResult = scheduleTask(
        schedule,
        selectedLineId,
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
        // Couldn't schedule - line is exhausted
        console.log(`[SCHEDULER] Couldn't schedule on ${lineName}, trying another line`);
        selectedLineId = null;
        continue;
      }
    }
  }

  // Phase 5: Final pass - ensure full capacity utilization
  console.log('[SCHEDULER] Phase 5: Final capacity utilization pass');

  // Build a map of demand fulfillment
  const demandFulfillment = new Map<string, { demand: typeof sortedDemands[0], scheduled: number }>();
  for (const demand of sortedDemands) {
    const scheduled = planItems
      .filter(p => p.referenceId === demand.referenceId && !p.isSetup)
      .reduce((sum, p) => sum + p.quantity, 0);
    demandFulfillment.set(demand.referenceId, { demand, scheduled });
  }

  // Find unfulfilled demands
  const unfulfilledDemands = Array.from(demandFulfillment.values())
    .filter(({ demand, scheduled }) => scheduled < demand.quantity)
    .map(({ demand, scheduled }) => ({
      demand,
      remainingQuantity: demand.quantity - scheduled,
    }));

  if (unfulfilledDemands.length > 0) {
    console.log(`[SCHEDULER] Found ${unfulfilledDemands.length} unfulfilled demands, attempting to use remaining capacity`);

    // Check each line for remaining capacity
    for (const [lineId, schedule] of lineSchedules) {
      const lineName = state.lines.find(l => l.id === lineId)?.name || lineId;

      // Calculate total remaining hours on this line
      let totalRemainingHours = 0;
      const tempDate = new Date(schedule.currentDate);

      while (tempDate <= endDate) {
        const jsDayOfWeek = tempDate.getDay();
        const dayOfWeek = jsDayOfWeek === 0 ? 6 : jsDayOfWeek - 1;
        const availability = state.availabilities.find(
          (a) => a.lineId === lineId && a.dayOfWeek === dayOfWeek
        );

        if (availability) {
          const dateKey = getDateKey(tempDate);
          const usedHours = schedule.dailyHoursUsed.get(dateKey) || 0;
          totalRemainingHours += Math.max(0, availability.hoursAvailable - usedHours);
        }

        tempDate.setDate(tempDate.getDate() + 1);
      }

      if (totalRemainingHours > 0) {
        console.log(`[SCHEDULER] Line ${lineName} has ${totalRemainingHours.toFixed(1)}h remaining capacity`);

        // Try to fit unfulfilled demands
        for (const unfulfilledDemand of unfulfilledDemands) {
          if (unfulfilledDemand.remainingQuantity <= 0) continue;

          const demand = unfulfilledDemand.demand;
          const throughput = state.throughputs.find(
            (t) => t.lineId === lineId && t.referenceId === demand.referenceId
          );

          if (!throughput) continue; // Line can't produce this reference

          const possibleQuantity = totalRemainingHours * throughput.rate;
          const quantityToSchedule = Math.min(possibleQuantity, unfulfilledDemand.remainingQuantity);

          if (quantityToSchedule > 0) {
            console.log(`[SCHEDULER] CAPACITY FILL: Scheduling ${quantityToSchedule.toFixed(1)} tons of ${getReferenceName(demand.referenceId, state)} on ${lineName}`);

            // Check if setup is needed
            if (schedule.lastReferenceId && schedule.lastReferenceId !== demand.referenceId) {
              const setupTime = getSetupTime(
                lineId,
                schedule.lastReferenceId,
                demand.referenceId,
                state
              );

              if (setupTime > 0) {
                const setupResult = scheduleTask(
                  schedule,
                  lineId,
                  demand.referenceId,
                  0,
                  setupTime,
                  true,
                  state,
                  endDate
                );

                if (setupResult) {
                  planItems.push(setupResult);
                  totalRemainingHours -= setupTime;
                }
              }
            }

            // Schedule the production
            const hoursNeeded = quantityToSchedule / throughput.rate;
            let quantityScheduled = 0;

            while (quantityScheduled < quantityToSchedule && schedule.currentDate <= endDate) {
              const availableHours = getAvailableHours(schedule, lineId, state);

              if (availableHours <= 0) {
                schedule.currentDate.setDate(schedule.currentDate.getDate() + 1);
                schedule.currentHour = 0;
                continue;
              }

              const remainingToSchedule = quantityToSchedule - quantityScheduled;
              const hoursForThisSlot = Math.min(
                availableHours,
                remainingToSchedule / throughput.rate
              );
              const quantityForThisSlot = hoursForThisSlot * throughput.rate;

              const productionResult = scheduleTask(
                schedule,
                lineId,
                demand.referenceId,
                quantityForThisSlot,
                hoursForThisSlot,
                false,
                state,
                endDate
              );

              if (productionResult) {
                planItems.push(productionResult);
                quantityScheduled += quantityForThisSlot;
                schedule.lastReferenceId = demand.referenceId;
              } else {
                break;
              }
            }

            // Update unfulfilled demand tracking
            const unfulfilledEntry = unfulfilledDemands.find(
              u => u.demand.referenceId === demand.referenceId
            );
            if (unfulfilledEntry) {
              unfulfilledEntry.remainingQuantity -= quantityScheduled;
            }

            totalRemainingHours -= hoursNeeded;

            if (totalRemainingHours <= 0) break;
          }
        }
      }
    }

    // Update warnings to reflect what was actually fulfilled
    // Remove old partial fulfillment warnings and add new ones if still unfulfilled
    const stillUnfulfilled = unfulfilledDemands.filter(({ remainingQuantity }) => remainingQuantity > 0);

    if (stillUnfulfilled.length > 0) {
      console.log(`[SCHEDULER] After capacity fill, ${stillUnfulfilled.length} demands still partially unfulfilled`);
    }
  }

  return { planItems, errors, warnings };
}

// Phase 3: Intelligent Line Selection with stickiness
function selectLineForDemand(
  referenceId: string,
  remainingQuantity: number,
  lineSchedules: Map<string, LineSchedule>,
  state: AppState,
  effectiveDeadline: Date,
  planItems: PlanItem[],
  preferredLines: PreferredLineMap
): string | null {
  const refName = getReferenceName(referenceId, state);

  // Priority 1: Can we continue on the current line? (Stickiness)
  const existingLine = planItems
    .filter((p) => p.referenceId === referenceId && !p.isSetup)
    .map((p) => p.lineId)[0];

  if (existingLine) {
    const existingSchedule = lineSchedules.get(existingLine);
    const throughput = state.throughputs.find(
      (t) => t.lineId === existingLine && t.referenceId === referenceId
    );

    if (existingSchedule && throughput && existingSchedule.currentDate <= effectiveDeadline) {
      // Calculate TOTAL remaining capacity on existing line
      let totalRemainingHours = 0;
      const tempDate = new Date(existingSchedule.currentDate);

      while (tempDate <= effectiveDeadline) {
        const jsDayOfWeek = tempDate.getDay();
        const dayOfWeek = jsDayOfWeek === 0 ? 6 : jsDayOfWeek - 1;
        const availability = state.availabilities.find(
          (a) => a.lineId === existingLine && a.dayOfWeek === dayOfWeek
        );

        if (availability) {
          const dateKey = getDateKey(tempDate);
          const usedHours = existingSchedule.dailyHoursUsed.get(dateKey) || 0;
          totalRemainingHours += Math.max(0, availability.hoursAvailable - usedHours);
        }

        tempDate.setDate(tempDate.getDate() + 1);
      }

      const quantityCanProduce = totalRemainingHours * throughput.rate;

      // If existing line can handle >=50% of remaining quantity, stick with it
      if (quantityCanProduce >= remainingQuantity * 0.5) {
        const lineName = state.lines.find(l => l.id === existingLine)?.name || existingLine;
        console.log(`[SCHEDULER] STICKY: Continuing ${refName} on ${lineName} (can produce ${quantityCanProduce.toFixed(1)} of ${remainingQuantity.toFixed(1)} tons)`);
        return existingLine;
      } else if (quantityCanProduce > 0) {
        console.log(`[SCHEDULER] Existing line can only produce ${quantityCanProduce.toFixed(1)} of ${remainingQuantity.toFixed(1)} tons, considering alternatives`);
      }
    }
  }

  // Priority 2: Use the preferred optimal line if available
  const preferredLineId = preferredLines[referenceId];
  if (preferredLineId) {
    const preferredSchedule = lineSchedules.get(preferredLineId);
    const throughput = state.throughputs.find(
      (t) => t.lineId === preferredLineId && t.referenceId === referenceId
    );

    if (preferredSchedule && throughput && preferredSchedule.currentDate <= effectiveDeadline) {
      // Calculate remaining capacity
      let totalRemainingHours = 0;
      const tempDate = new Date(preferredSchedule.currentDate);

      while (tempDate <= effectiveDeadline) {
        const jsDayOfWeek = tempDate.getDay();
        const dayOfWeek = jsDayOfWeek === 0 ? 6 : jsDayOfWeek - 1;
        const availability = state.availabilities.find(
          (a) => a.lineId === preferredLineId && a.dayOfWeek === dayOfWeek
        );

        if (availability) {
          const dateKey = getDateKey(tempDate);
          const usedHours = preferredSchedule.dailyHoursUsed.get(dateKey) || 0;
          totalRemainingHours += Math.max(0, availability.hoursAvailable - usedHours);
        }

        tempDate.setDate(tempDate.getDate() + 1);
      }

      if (totalRemainingHours > 0) {
        const lineName = state.lines.find(l => l.id === preferredLineId)?.name || preferredLineId;
        console.log(`[SCHEDULER] PREFERRED: Using optimal line ${lineName} for ${refName} (${totalRemainingHours.toFixed(1)}h available)`);
        return preferredLineId;
      }
    }
  }

  // Priority 3: Find any line with capacity (fallback)
  interface CandidateLine {
    lineId: string;
    throughputRate: number;
    totalRemainingHours: number;
    setupTime: number;
  }

  const candidates: CandidateLine[] = [];

  for (const [lineId, schedule] of lineSchedules) {
    const throughput = state.throughputs.find(
      (t) => t.lineId === lineId && t.referenceId === referenceId
    );

    if (!throughput) continue;

    // Calculate total remaining capacity
    let totalRemainingHours = 0;
    const tempDate = new Date(schedule.currentDate);

    while (tempDate <= effectiveDeadline) {
      const jsDayOfWeek = tempDate.getDay();
      const dayOfWeek = jsDayOfWeek === 0 ? 6 : jsDayOfWeek - 1;
      const availability = state.availabilities.find(
        (a) => a.lineId === lineId && a.dayOfWeek === dayOfWeek
      );

      if (availability) {
        const dateKey = getDateKey(tempDate);
        const usedHours = schedule.dailyHoursUsed.get(dateKey) || 0;
        totalRemainingHours += Math.max(0, availability.hoursAvailable - usedHours);
      }

      tempDate.setDate(tempDate.getDate() + 1);
    }

    if (totalRemainingHours <= 0) continue;

    const setupTime = schedule.lastReferenceId && schedule.lastReferenceId !== referenceId
      ? getSetupTime(lineId, schedule.lastReferenceId, referenceId, state)
      : 0;

    candidates.push({
      lineId,
      throughputRate: throughput.rate,
      totalRemainingHours,
      setupTime,
    });
  }

  if (candidates.length === 0) {
    console.log(`[SCHEDULER] FALLBACK: No compatible lines with capacity for ${refName}`);
    return null;
  }

  // Sort candidates: highest throughput first, then lowest setup time, then most capacity
  candidates.sort((a, b) => {
    if (b.throughputRate !== a.throughputRate) {
      return b.throughputRate - a.throughputRate;
    }
    if (a.setupTime !== b.setupTime) {
      return a.setupTime - b.setupTime;
    }
    return b.totalRemainingHours - a.totalRemainingHours;
  });

  const selected = candidates[0];
  const lineName = state.lines.find(l => l.id === selected.lineId)?.name || selected.lineId;
  console.log(`[SCHEDULER] FALLBACK: Selected ${lineName} for ${refName} (throughput=${selected.throughputRate}, capacity=${selected.totalRemainingHours.toFixed(1)}h)`);

  return selected.lineId;
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
