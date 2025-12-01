import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { generateProductionPlan } from '../utils/scheduler';

export const Planner = () => {
  const { state, addDemand, deleteDemand, setPlanItems } = useApp();
  const [planErrors, setPlanErrors] = useState<string[]>([]);
  const [planWarnings, setPlanWarnings] = useState<string[]>([]);
  const [showDetailedPlan, setShowDetailedPlan] = useState(false);
  const [formData, setFormData] = useState({
    referenceId: '',
    quantity: '',
    deadline: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.referenceId || !formData.quantity) return;

    const quantity = parseFloat(formData.quantity);
    if (isNaN(quantity) || quantity <= 0) {
      alert('Please enter a valid quantity greater than 0');
      return;
    }

    addDemand({
      referenceId: formData.referenceId,
      quantity,
      deadline: formData.deadline ? new Date(formData.deadline) : undefined,
    });

    setFormData({ referenceId: '', quantity: '', deadline: '' });
  };

  const handleDelete = (index: number) => {
    if (confirm('Are you sure you want to delete this demand?')) {
      deleteDemand(index);
    }
  };

  const handleGeneratePlan = () => {
    setPlanErrors([]);
    setPlanWarnings([]);
    const result = generateProductionPlan(state);

    if (result.errors.length > 0) {
      setPlanErrors(result.errors);
    }

    if (result.warnings.length > 0) {
      setPlanWarnings(result.warnings);
    }

    if (result.planItems.length > 0) {
      setPlanItems(result.planItems);
      const message = result.warnings.length > 0
        ? `Plan generated with warnings. ${result.planItems.length} items scheduled. Check warnings below.`
        : `Plan generated successfully! ${result.planItems.length} items scheduled.`;
      alert(message);
    } else if (result.errors.length === 0) {
      alert('No plan items generated. Please check your configuration.');
    }
  };

  const getReferenceName = (referenceId: string) => {
    return state.references.find((r) => r.id === referenceId)?.name || referenceId;
  };

  const getTotalDemand = () => {
    return state.demands.reduce((sum, d) => sum + d.quantity, 0);
  };

  if (state.references.length === 0) {
    return (
      <div>
        <h2 className="text-xl font-semibold mb-4">Planner</h2>
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <p className="text-yellow-800">
            Please add References in the Configuration tab before creating a production plan.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Production Planner</h2>

      {/* Demand Input Form */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
        <h3 className="text-lg font-semibold mb-4">Add Demand</h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Product Reference *
            </label>
            <select
              value={formData.referenceId}
              onChange={(e) => setFormData({ ...formData, referenceId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select reference...</option>
              {state.references.map((ref) => (
                <option key={ref.id} value={ref.id}>
                  {ref.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quantity (Tons) *
            </label>
            <input
              type="number"
              step="0.1"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., 100"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Deadline (Optional)
            </label>
            <input
              type="date"
              value={formData.deadline}
              onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md"
            >
              Add Demand
            </button>
          </div>
        </form>
      </div>

      {/* Demand List */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Current Demands</h3>
          {state.demands.length > 0 && (
            <div className="text-sm text-gray-600">
              Total: <span className="font-semibold">{getTotalDemand().toFixed(1)} tons</span>
            </div>
          )}
        </div>

        {state.demands.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No demands added yet. Add your first demand above to get started.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 border-b">
                    #
                  </th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 border-b">
                    Reference
                  </th>
                  <th className="px-4 py-2 text-right text-sm font-semibold text-gray-700 border-b">
                    Quantity (Tons)
                  </th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 border-b">
                    Deadline
                  </th>
                  <th className="px-4 py-2 text-center text-sm font-semibold text-gray-700 border-b">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {state.demands.map((demand, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm border-b">{index + 1}</td>
                    <td className="px-4 py-2 text-sm border-b">
                      {getReferenceName(demand.referenceId)}
                    </td>
                    <td className="px-4 py-2 text-sm text-right border-b">
                      {demand.quantity.toFixed(1)}
                    </td>
                    <td className="px-4 py-2 text-sm border-b">
                      {demand.deadline
                        ? new Date(demand.deadline).toLocaleDateString()
                        : '-'}
                    </td>
                    <td className="px-4 py-2 text-sm border-b text-center">
                      <button
                        onClick={() => handleDelete(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Errors */}
      {planErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <h4 className="font-semibold text-red-800 mb-2">Planning Errors:</h4>
          <ul className="list-disc list-inside text-sm text-red-700">
            {planErrors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {planWarnings.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-md p-4 mb-6">
          <h4 className="font-semibold text-orange-800 mb-2">Capacity Warnings:</h4>
          <ul className="list-disc list-inside text-sm text-orange-700">
            {planWarnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
          <p className="text-sm text-orange-700 mt-2 font-medium">
            Note: The plan is limited to one week. Some demands could not be fully scheduled within
            available capacity.
          </p>
        </div>
      )}

      {/* Generate Plan Button */}
      {state.demands.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold mb-1">Generate Production Plan</h3>
              <p className="text-sm text-gray-600">
                Click to generate an optimized production schedule based on your demands and
                configuration.
              </p>
            </div>
            <button
              onClick={handleGeneratePlan}
              className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-md font-semibold"
            >
              Generate Plan
            </button>
          </div>
        </div>
      )}

      {/* Plan Results */}
      {state.planItems.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mt-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-semibold">Generated Production Plan</h3>
              <p className="text-sm text-gray-600 mt-1">
                {state.planItems.length} items scheduled (
                {state.planItems.filter((p) => !p.isSetup).length} production,{' '}
                {state.planItems.filter((p) => p.isSetup).length} setup)
              </p>
            </div>
            <button
              onClick={() => setPlanItems([])}
              className="text-sm text-red-600 hover:text-red-800"
            >
              Clear Plan
            </button>
          </div>

          {/* Group by date and display clearly */}
          <div className="space-y-4">
            {Object.entries(
              state.planItems.reduce((acc, item) => {
                if (!acc[item.date]) acc[item.date] = [];
                acc[item.date].push(item);
                return acc;
              }, {} as Record<string, typeof state.planItems>)
            )
              .sort(([dateA], [dateB]) => {
                // Sort by EU day of week (Mon=0, Sun=6) instead of chronological date
                const dateObjA = new Date(dateA);
                const dateObjB = new Date(dateB);
                const jsDayA = dateObjA.getDay();
                const jsDayB = dateObjB.getDay();
                const euDayA = jsDayA === 0 ? 6 : jsDayA - 1; // Convert JS day to EU day
                const euDayB = jsDayB === 0 ? 6 : jsDayB - 1;

                // If same week, sort by EU day; otherwise sort by date
                if (euDayA !== euDayB) {
                  return euDayA - euDayB;
                }
                return dateA.localeCompare(dateB);
              })
              .map(([date, items]) => {
                const dateObj = new Date(date);
                const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                const jsDayOfWeek = dateObj.getDay();
                const dayOfWeek = jsDayOfWeek === 0 ? 6 : jsDayOfWeek - 1;
                const dayName = dayNames[dayOfWeek];

                // Group by line
                const byLine = items.reduce((acc, item) => {
                  if (!acc[item.lineId]) acc[item.lineId] = [];
                  acc[item.lineId].push(item);
                  return acc;
                }, {} as Record<string, typeof items>);

                return (
                  <div key={date} className="border border-gray-200 rounded-md overflow-hidden">
                    <div className="bg-gray-100 px-4 py-2 font-semibold text-gray-800">
                      {dayName} - {dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}
                    </div>
                    <div className="p-4 space-y-3">
                      {Object.entries(byLine)
                        .sort(([lineA], [lineB]) => {
                          const nameA = state.lines.find((l) => l.id === lineA)?.name || lineA;
                          const nameB = state.lines.find((l) => l.id === lineB)?.name || lineB;
                          return nameA.localeCompare(nameB);
                        })
                        .map(([lineId, lineItems]) => {
                          const lineName = state.lines.find((l) => l.id === lineId)?.name || lineId;
                          return (
                            <div key={lineId} className="flex items-start gap-4">
                              <div className="font-medium text-gray-700 w-16">{lineName}</div>
                              <div className="flex-1 space-y-1">
                                {lineItems.map((item, idx) => {
                                  const refName = getReferenceName(item.referenceId);
                                  return (
                                    <div
                                      key={idx}
                                      className={`flex items-center gap-3 text-sm ${
                                        item.isSetup ? 'text-orange-700' : 'text-gray-700'
                                      }`}
                                    >
                                      {item.isSetup ? (
                                        <span className="font-medium">
                                          ⚙️ Setup → {refName} ({item.duration.toFixed(1)}h)
                                        </span>
                                      ) : (
                                        <>
                                          <span className="font-medium">{refName}</span>
                                          <span className="text-gray-500">•</span>
                                          <span>{item.quantity.toFixed(1)} tons</span>
                                          <span className="text-gray-500">•</span>
                                          <span>{item.duration.toFixed(1)} hours</span>
                                          <span className="text-gray-400 text-xs">
                                            ({new Date(item.startTime).toLocaleTimeString('en-GB', {
                                              hour: '2-digit',
                                              minute: '2-digit',
                                            })}{' '}
                                            -{' '}
                                            {new Date(item.endTime).toLocaleTimeString('en-GB', {
                                              hour: '2-digit',
                                              minute: '2-digit',
                                            })})
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Capacity Utilization */}
          <div className="mt-6 p-4 bg-purple-50 border border-purple-200 rounded-md">
            <h4 className="font-semibold text-purple-800 mb-3">Capacity Utilization:</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-purple-200">
                    <th className="text-left py-2 px-3 font-semibold text-purple-800">Line</th>
                    {(() => {
                      const uniqueDates = Array.from(new Set(state.planItems.map((p) => p.date))).sort((a, b) => {
                        const dateA = new Date(a);
                        const dateB = new Date(b);
                        const jsDayA = dateA.getDay();
                        const jsDayB = dateB.getDay();
                        const euDayA = jsDayA === 0 ? 6 : jsDayA - 1;
                        const euDayB = jsDayB === 0 ? 6 : jsDayB - 1;
                        // Sort by EU week day (Mon=0, Sun=6)
                        if (euDayA !== euDayB) return euDayA - euDayB;
                        // If same day of week, sort chronologically
                        return a.localeCompare(b);
                      });
                      return uniqueDates.map((date) => {
                        const dateObj = new Date(date);
                        const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                        const jsDayOfWeek = dateObj.getDay();
                        const dayOfWeek = jsDayOfWeek === 0 ? 6 : jsDayOfWeek - 1;
                        const dayName = dayNames[dayOfWeek];
                        return (
                          <th key={date} className="text-center py-2 px-3 font-semibold text-purple-800">
                            {dayName}
                          </th>
                        );
                      });
                    })()}
                  </tr>
                </thead>
                <tbody>
                  {state.lines.map((line) => {
                    const uniqueDates = Array.from(new Set(state.planItems.map((p) => p.date))).sort((a, b) => {
                      const dateA = new Date(a);
                      const dateB = new Date(b);
                      const jsDayA = dateA.getDay();
                      const jsDayB = dateB.getDay();
                      const euDayA = jsDayA === 0 ? 6 : jsDayA - 1;
                      const euDayB = jsDayB === 0 ? 6 : jsDayB - 1;
                      // Sort by EU week day (Mon=0, Sun=6)
                      if (euDayA !== euDayB) return euDayA - euDayB;
                      return a.localeCompare(b);
                    });
                    return (
                      <tr key={line.id} className="border-b border-purple-100">
                        <td className="py-2 px-3 font-medium text-purple-900">{line.name}</td>
                        {uniqueDates.map((date) => {
                          const dateObj = new Date(date);
                          const jsDayOfWeek = dateObj.getDay();
                          const dayOfWeek = jsDayOfWeek === 0 ? 6 : jsDayOfWeek - 1;

                          // Get availability for this line and day
                          const availability = state.availabilities.find(
                            (a) => a.lineId === line.id && a.dayOfWeek === dayOfWeek
                          );
                          const totalHours = availability?.hoursAvailable || 0;

                          // Calculate used hours
                          const usedHours = state.planItems
                            .filter((p) => p.date === date && p.lineId === line.id)
                            .reduce((sum, p) => sum + p.duration, 0);

                          const remainingHours = totalHours - usedHours;
                          const utilization = totalHours > 0 ? (usedHours / totalHours) * 100 : 0;

                          return (
                            <td key={date} className="py-2 px-3 text-center">
                              {totalHours === 0 ? (
                                <span className="text-gray-400">-</span>
                              ) : (
                                <div className="flex flex-col items-center">
                                  <div className="text-xs text-purple-700 font-medium">
                                    {usedHours.toFixed(1)} / {totalHours.toFixed(1)}h
                                  </div>
                                  <div
                                    className={`text-xs font-semibold ${
                                      remainingHours <= 0
                                        ? 'text-red-600'
                                        : remainingHours < 5
                                        ? 'text-orange-600'
                                        : 'text-green-600'
                                    }`}
                                  >
                                    {remainingHours.toFixed(1)}h left
                                  </div>
                                  <div className="w-full bg-purple-200 rounded-full h-1.5 mt-1">
                                    <div
                                      className={`h-1.5 rounded-full ${
                                        utilization >= 100
                                          ? 'bg-red-500'
                                          : utilization >= 80
                                          ? 'bg-orange-500'
                                          : 'bg-green-500'
                                      }`}
                                      style={{ width: `${Math.min(utilization, 100)}%` }}
                                    ></div>
                                  </div>
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-purple-700 mt-3">
              Shows hours used / available per day. Green = plenty of capacity, Orange = limited capacity, Red = at/over capacity
            </p>
          </div>

          {/* Summary */}
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <h4 className="font-semibold text-blue-800 mb-2">Summary:</h4>
            <div className="text-sm text-blue-700 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <span className="font-medium">Total Production:</span>{' '}
                {state.planItems
                  .filter((p) => !p.isSetup)
                  .reduce((sum, p) => sum + p.quantity, 0)
                  .toFixed(1)}{' '}
                tons
              </div>
              <div>
                <span className="font-medium">Production Time:</span>{' '}
                {state.planItems
                  .filter((p) => !p.isSetup)
                  .reduce((sum, p) => sum + p.duration, 0)
                  .toFixed(1)}{' '}
                hours
              </div>
              <div>
                <span className="font-medium">Setup Time:</span>{' '}
                {state.planItems
                  .filter((p) => p.isSetup)
                  .reduce((sum, p) => sum + p.duration, 0)
                  .toFixed(1)}{' '}
                hours
              </div>
              <div>
                <span className="font-medium">Total Time:</span>{' '}
                {state.planItems.reduce((sum, p) => sum + p.duration, 0).toFixed(1)} hours
              </div>
            </div>
          </div>

          {/* Detailed Plan Button and Table */}
          <div className="mt-4">
            <button
              onClick={() => setShowDetailedPlan(!showDetailedPlan)}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-md font-medium flex items-center justify-center gap-2"
            >
              {showDetailedPlan ? '▼' : '▶'} {showDetailedPlan ? 'Hide' : 'Show'} Detailed Plan by Line
            </button>

            {showDetailedPlan && (
              <div className="mt-4 space-y-6">
                {state.lines.map((line) => {
                  // Get all unique dates and references for this line
                  const linePlanItems = state.planItems.filter(
                    (p) => p.lineId === line.id && !p.isSetup
                  );

                  if (linePlanItems.length === 0) return null;

                  // Get unique dates sorted by EU week order
                  const uniqueDates = Array.from(new Set(linePlanItems.map((p) => p.date)))
                    .sort((a, b) => {
                      const dateObjA = new Date(a);
                      const dateObjB = new Date(b);
                      const jsDayA = dateObjA.getDay();
                      const jsDayB = dateObjB.getDay();
                      const euDayA = jsDayA === 0 ? 6 : jsDayA - 1;
                      const euDayB = jsDayB === 0 ? 6 : jsDayB - 1;
                      if (euDayA !== euDayB) return euDayA - euDayB;
                      return a.localeCompare(b);
                    });

                  // Get unique references that appear on this line
                  const lineReferences = Array.from(
                    new Set(linePlanItems.map((p) => p.referenceId))
                  ).sort((a, b) => {
                    const nameA = state.references.find((r) => r.id === a)?.name || a;
                    const nameB = state.references.find((r) => r.id === b)?.name || b;
                    return nameA.localeCompare(nameB);
                  });

                  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

                  return (
                    <div key={line.id} className="border border-gray-300 rounded-md overflow-hidden">
                      <div className="bg-gray-200 px-4 py-2 font-bold text-gray-900">
                        {line.name}
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="bg-gray-100">
                              <th className="px-4 py-2 text-left font-semibold text-gray-700 border-b border-r">
                                Reference
                              </th>
                              {uniqueDates.map((date) => {
                                const dateObj = new Date(date);
                                const jsDayOfWeek = dateObj.getDay();
                                const dayOfWeek = jsDayOfWeek === 0 ? 6 : jsDayOfWeek - 1;
                                const dayName = dayNames[dayOfWeek];
                                return (
                                  <th
                                    key={date}
                                    className="px-4 py-2 text-center font-semibold text-gray-700 border-b"
                                  >
                                    {dayName}
                                  </th>
                                );
                              })}
                            </tr>
                          </thead>
                          <tbody>
                            {lineReferences.map((refId) => {
                              const refName = state.references.find((r) => r.id === refId)?.name || refId;
                              return (
                                <tr key={refId} className="border-b">
                                  <td className="px-4 py-2 font-medium text-gray-900 border-r bg-gray-50">
                                    {refName}
                                  </td>
                                  {uniqueDates.map((date) => {
                                    const quantity = linePlanItems
                                      .filter((p) => p.date === date && p.referenceId === refId)
                                      .reduce((sum, p) => sum + p.quantity, 0);

                                    return (
                                      <td
                                        key={date}
                                        className="px-4 py-2 text-center text-gray-700"
                                      >
                                        {quantity > 0 ? quantity.toFixed(1) : '-'}
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
