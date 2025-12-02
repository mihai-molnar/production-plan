# Production Scheduler Optimization Plan

## Executive Summary
The current scheduler has critical bugs that prevent full utilization of available line capacity, resulting in unfulfilled demand even when lines have availability. This plan addresses the root causes and redesigns the algorithm to ensure optimal scheduling.

## Critical Issues Identified

### 1. **Over-Dynamic Line Selection**
**Problem:** The algorithm calls `findBestLine()` on every iteration of the scheduling loop (line 107), even when the current line still has capacity and is already running the same reference.

**Impact:** This causes unnecessary line switching and may abandon a perfectly good line mid-production.

### 2. **Premature Loop Exit**
**Problem:** When a line runs out of capacity for the current day and advances to the next day, if that next day exceeds the deadline, the algorithm breaks entirely (line 232), abandoning the demand even if other lines have capacity.

**Impact:** With 1 line and 1 ref, if Mon-Wed are used and the algorithm's internal state gets confused, it may stop scheduling even though Thu-Sun are available.

### 3. **Throughput Dominates Cost Function**
**Problem:** Line 373 calculates `throughputScore = -throughput.rate * 1000`, which can dominate the cost calculation and override setup minimization and line continuation preferences.

**Impact:** The algorithm may constantly switch between lines chasing marginal throughput differences, creating unnecessary setups.

### 4. **Weak Line Continuation Incentive**
**Problem:** The continuation bonus (line 400) is only `-100`, which can easily be outweighed by throughput differences, causing the algorithm to abandon a line that's already producing a reference.

**Impact:** More setups than necessary, reduced efficiency.

### 5. **No "Can Complete" Check**
**Problem:** The algorithm doesn't check if a selected line can actually complete the remaining quantity within the deadline before selecting it.

**Impact:** It may select a line that can only partially fulfill demand, then switch to another line unnecessarily.

---

## Proposed Algorithm Redesign

### Phase 1: Pre-Analysis (One-time per scheduling run)

**Purpose:** Understand the optimal line for each reference and total capacity available.

#### Step 1.1: Build Reference-Line Compatibility Matrix
```
For each reference:
  For each line:
    If throughput exists:
      Calculate max output potential = throughput.rate * total_available_hours_on_line
      Store: { referenceId, lineId, throughputRate, totalCapacity }
```

**Output:** Clear understanding of which lines can produce which references and at what rate.

#### Step 1.2: Identify Optimal Line for Each Reference
```
For each reference:
  Find line with:
    1. Highest throughput rate
    2. Most available capacity (as tiebreaker)
  Store as "preferred line" for this reference
```

**Output:** A mapping of `referenceId -> preferredLineId` for ideal production.

---

### Phase 2: Demand Sorting and Prioritization

**Purpose:** Schedule demands in the optimal order to minimize setups and meet deadlines.

#### Step 2.1: Enhanced Demand Sorting
```
Sort demands by:
  1. Has deadline? (Yes before No)
  2. Deadline date (earliest first)
  3. Quantity (largest first, to minimize setups)
```

**Rationale:** Deadline-driven demands must be scheduled first. Among non-deadline demands, larger quantities should go first to maximize continuous runs and minimize setup waste.

---

### Phase 3: Intelligent Line Selection

**Purpose:** Select lines based on the complete picture, not just local optimization.

#### Step 3.1: Line Selection Algorithm (Replaces `findBestLine`)
```
function selectLineForDemand(
  demand,
  remainingQuantity,
  lineSchedules,
  state
) {
  // Priority 1: Can we continue on the current line?
  existingLine = findLineAlreadyRunningThisReference(demand.referenceId)

  if (existingLine) {
    totalRemainingCapacity = calculateTotalRemainingCapacity(
      existingLine,
      demand.deadline
    )

    // If existing line can handle >=50% of remaining quantity, continue on it
    // This prevents premature line switching
    if (totalRemainingCapacity * throughputRate >= remainingQuantity * 0.5) {
      return existingLine
    }
  }

  // Priority 2: Use the preferred optimal line if available
  preferredLine = getPreferredLine(demand.referenceId)

  if (lineIsAvailable(preferredLine, demand.deadline)) {
    totalCapacity = calculateTotalRemainingCapacity(
      preferredLine,
      demand.deadline
    )

    if (totalCapacity > 0) {
      return preferredLine
    }
  }

  // Priority 3: Find any line with capacity (fallback)
  candidateLines = getAllCompatibleLines(demand.referenceId)
    .filter(line => hasRemainingCapacity(line, demand.deadline))
    .sortBy([
      (a, b) => b.throughputRate - a.throughputRate,  // Highest throughput first
      (a, b) => setupCostDifference(a, b),             // Lower setup cost second
      (a, b) => b.totalCapacity - a.totalCapacity      // Most capacity third
    ])

  return candidateLines[0] || null
}
```

**Key Improvements:**
- **Sticky line selection:** Once a line is producing a reference, keep using it if it has substantial capacity
- **Preferred line usage:** Leverage pre-analysis to use optimal lines
- **Multi-tier fallback:** Clear priority system for line selection

---

### Phase 4: Demand Fulfillment Loop (Replaces main while loop)

**Purpose:** Ensure complete fulfillment of demand before moving to next demand.

#### Step 4.1: Enhanced Scheduling Loop
```
for each demand in sortedDemands:
  remainingQuantity = demand.quantity
  selectedLine = null
  attemptedLines = new Set()

  while (remainingQuantity > 0) {
    // Only select a new line if:
    // 1. We don't have a selected line yet, OR
    // 2. The current line is completely exhausted

    if (!selectedLine || isLineCompletelyExhausted(selectedLine, demand.deadline)) {
      selectedLine = selectLineForDemand(
        demand,
        remainingQuantity,
        lineSchedules,
        state
      )

      if (!selectedLine) {
        // No lines available at all
        if (remainingQuantity === demand.quantity) {
          ERROR: "No compatible line found"
        } else {
          WARNING: "Partial fulfillment"
        }
        break
      }

      // Prevent infinite loops - if we've tried this line before and it failed
      if (attemptedLines.has(selectedLine)) {
        break
      }
      attemptedLines.add(selectedLine)
    }

    schedule = lineSchedules.get(selectedLine)

    // Handle setup if needed
    if (needsSetup(selectedLine, demand.referenceId)) {
      scheduledSetup = scheduleSetupTime(selectedLine, demand, schedule)
      if (!scheduledSetup) {
        // Setup couldn't fit, mark line as exhausted and try another
        selectedLine = null
        continue
      }
    }

    // Schedule production on the selected line for TODAY
    quantityScheduled = scheduleProductionForToday(
      selectedLine,
      demand,
      remainingQuantity,
      schedule
    )

    if (quantityScheduled > 0) {
      remainingQuantity -= quantityScheduled
    } else {
      // No capacity today, advance to next available day
      advanced = advanceToNextAvailableDay(schedule, demand.deadline)

      if (!advanced) {
        // This line is completely exhausted before deadline
        // Mark it and try another line
        selectedLine = null
      }
    }
  }
```

**Key Improvements:**
- **Line stickiness:** Don't call line selection on every iteration - stick with a line once selected
- **Proper exhaustion handling:** Only abandon a line when it's completely exhausted, not just for one day
- **Multi-line fallback:** If one line runs out, automatically try others
- **Loop safety:** Track attempted lines to prevent infinite loops

---

### Phase 5: Capacity Utilization Guarantee

**Purpose:** Ensure no demand goes unfulfilled while any line has available capacity.

#### Step 5.1: Final Pass for Unfulfilled Demands
```
After main scheduling loop:

unfulfilledDemands = demands.filter(d => d.scheduledQuantity < d.quantity)

if (unfulfilledDemands.length > 0) {
  // Check if ANY line has ANY remaining capacity
  for each line in lines:
    remainingHours = getTotalRemainingHours(line)

    if (remainingHours > 0) {
      // Try to fit unfulfilled demands
      for each demand in unfulfilledDemands:
        if (lineCanProduce(line, demand.reference)) {
          throughput = getThroughput(line, demand.reference)
          possibleQuantity = remainingHours * throughput
          quantityToSchedule = min(
            possibleQuantity,
            demand.quantity - demand.scheduledQuantity
          )

          if (quantityToSchedule > 0) {
            scheduleOnLine(line, demand, quantityToSchedule)

            WARNING: "Scheduling ${quantityToSchedule} of ${demand.reference}
                     on non-optimal line ${line.name} to maximize capacity utilization"
          }
        }
      }
    }
  }
}
```

**Rationale:** Even if a line isn't optimal for a reference, it's better to use available capacity than to leave demand unfulfilled. This ensures the user's requirement: "ensure full line usage even if not the best output, don't allow missing qty while lines still have availability."

---

## Implementation Order

### Step 1: Refactor Line Selection (1-2 hours)
- Extract `findBestLine()` into new `selectLineForDemand()`
- Implement preferred line caching from Phase 1
- Add line stickiness logic

### Step 2: Fix Scheduling Loop (1-2 hours)
- Modify main while loop to only call line selection when needed
- Improve line exhaustion detection
- Add multi-line fallback logic

### Step 3: Add Capacity Guarantee Pass (1 hour)
- Implement final pass that fills unfulfilled demands with any available capacity
- Add appropriate warnings for non-optimal scheduling

### Step 4: Testing (2-3 hours)
- Test case 1: 1 line, 1 ref, 24x7 availability → should fully utilize all available hours
- Test case 2: 2 lines (different throughputs), 1 ref → should prefer high-throughput line
- Test case 3: 1 line, 2 refs with deadlines → should minimize setups
- Test case 4: Multiple lines, multiple refs → should balance deadlines vs setups
- Test case 5: Insufficient capacity → should use ALL available capacity before warning

### Step 5: Optimization (1 hour)
- Profile performance with large datasets
- Add additional logging for debugging
- Fine-tune cost function weights if needed

---

## Success Criteria

1. **Full Utilization:** With 1 line and 1 ref with 24x7 availability, the scheduler should use all available time until demand is met or capacity is exhausted.

2. **No Premature Warnings:** Partial fulfillment warnings should only appear when ALL compatible lines are completely exhausted.

3. **Optimal Line Selection:** Each reference should primarily be scheduled on its highest-throughput line.

4. **Setup Minimization:** Reference changes on the same line should be minimized by batching production runs.

5. **Deadline Compliance:** Demands with deadlines should be prioritized, with optimal line selection within the deadline constraint.

6. **Capacity Exhaustion:** Before declaring any demand as unfulfillable, the algorithm must attempt to use every compatible line's available capacity.

---

## Risk Mitigation

### Risk 1: Infinite Loops
**Mitigation:** Track attempted lines per demand and break if the same line is attempted twice without progress.

### Risk 2: Over-Stickiness
**Mitigation:** If a line has <10% of needed capacity remaining, allow switching to a better line even mid-production.

### Risk 3: Performance Degradation
**Mitigation:** Pre-calculate compatibility matrix once; cache capacity calculations; limit final pass iterations.

### Risk 4: Complex Edge Cases
**Mitigation:** Comprehensive test suite covering single-line, multi-line, deadline, no-deadline, setup, and no-setup scenarios.

---

## Expected Outcomes

**Before Fix:**
- 1 line, 1 ref, 24x7 availability, 100 tons demand
- Current: 40 tons scheduled Mon-Wed, 60 tons unfulfilled
- Error: "Partial fulfillment... 60 tons unmet"

**After Fix:**
- 1 line, 1 ref, 24x7 availability, 100 tons demand
- Expected: 100 tons scheduled Mon-Sun (or until capacity exhausted)
- No errors or warnings (unless true capacity limit reached)

---

## Questions for Review

1. **Line switching threshold:** Should we allow switching from a sticky line if another line is >2x faster? Or stay completely sticky?

2. **Setup time handling:** Should setups also be considered in the "capacity exhaustion" check, or only production time?

3. **Final pass behavior:** Should the final capacity utilization pass ignore deadlines to maximize throughput, or respect them?

4. **Warning verbosity:** Should we warn when scheduling on non-optimal lines, or only show errors for unfulfilled demand?

Please review and provide feedback on this plan before implementation.
