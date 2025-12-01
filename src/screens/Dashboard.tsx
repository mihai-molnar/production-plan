import { useApp } from '../context/AppContext';

export const Dashboard = () => {
  const { state } = useApp();

  const hasPlan = state.planItems.length > 0;
  const totalProduction = state.planItems
    .filter((p) => !p.isSetup)
    .reduce((sum, p) => sum + p.quantity, 0);
  const totalProductionTime = state.planItems
    .filter((p) => !p.isSetup)
    .reduce((sum, p) => sum + p.duration, 0);
  const totalSetupTime = state.planItems
    .filter((p) => p.isSetup)
    .reduce((sum, p) => sum + p.duration, 0);
  const totalDemand = state.demands.reduce((sum, d) => sum + d.quantity, 0);
  const fulfillmentRate = totalDemand > 0 ? (totalProduction / totalDemand) * 100 : 0;

  const configStatus = {
    lines: state.lines.length,
    references: state.references.length,
    throughputs: state.throughputs.length,
    availabilities: state.availabilities.length,
    setupTimes: state.setupTimes.length,
  };

  const isConfigComplete =
    configStatus.lines > 0 &&
    configStatus.references > 0 &&
    configStatus.throughputs > 0 &&
    configStatus.availabilities > 0;

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6">Dashboard</h2>

      {/* Configuration Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-700">Configuration Status</h3>
            {isConfigComplete ? (
              <span className="text-green-600 text-xl">✓</span>
            ) : (
              <span className="text-orange-600 text-xl">⚠</span>
            )}
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Lines:</span>
              <span className={configStatus.lines > 0 ? 'text-green-600 font-medium' : 'text-gray-400'}>
                {configStatus.lines}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">References:</span>
              <span className={configStatus.references > 0 ? 'text-green-600 font-medium' : 'text-gray-400'}>
                {configStatus.references}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Throughputs:</span>
              <span className={configStatus.throughputs > 0 ? 'text-green-600 font-medium' : 'text-gray-400'}>
                {configStatus.throughputs}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Availabilities:</span>
              <span className={configStatus.availabilities > 0 ? 'text-green-600 font-medium' : 'text-gray-400'}>
                {configStatus.availabilities}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Setup Times:</span>
              <span className={configStatus.setupTimes > 0 ? 'text-green-600 font-medium' : 'text-gray-400'}>
                {configStatus.setupTimes}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Demand Status</h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Demands:</span>
              <span className="font-medium">{state.demands.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Quantity:</span>
              <span className="font-medium">{totalDemand.toFixed(1)} tons</span>
            </div>
            {hasPlan && (
              <>
                <div className="flex justify-between mt-3 pt-3 border-t border-gray-200">
                  <span className="text-gray-600">Planned:</span>
                  <span className="font-medium text-blue-600">{totalProduction.toFixed(1)} tons</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Fulfillment:</span>
                  <span
                    className={`font-medium ${
                      fulfillmentRate >= 100
                        ? 'text-green-600'
                        : fulfillmentRate >= 80
                        ? 'text-orange-600'
                        : 'text-red-600'
                    }`}
                  >
                    {fulfillmentRate.toFixed(0)}%
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Production Plan</h3>
          {hasPlan ? (
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Items:</span>
                <span className="font-medium">{state.planItems.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Production Time:</span>
                <span className="font-medium">{totalProductionTime.toFixed(1)}h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Setup Time:</span>
                <span className="font-medium">{totalSetupTime.toFixed(1)}h</span>
              </div>
              <div className="flex justify-between mt-3 pt-3 border-t border-gray-200">
                <span className="text-gray-600">Total Time:</span>
                <span className="font-medium text-blue-600">
                  {(totalProductionTime + totalSetupTime).toFixed(1)}h
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No plan generated yet</p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      {!isConfigComplete && (
        <div className="bg-orange-50 border border-orange-200 rounded-md p-4 mb-6">
          <h4 className="font-semibold text-orange-800 mb-2">⚠ Configuration Incomplete</h4>
          <p className="text-sm text-orange-700 mb-3">
            Complete the configuration before generating a production plan:
          </p>
          <ul className="text-sm text-orange-700 space-y-1 list-disc list-inside">
            {configStatus.lines === 0 && <li>Add production lines</li>}
            {configStatus.references === 0 && <li>Add product references</li>}
            {configStatus.throughputs === 0 && <li>Configure throughput rates</li>}
            {configStatus.availabilities === 0 && <li>Set line availability schedules</li>}
          </ul>
        </div>
      )}

      {isConfigComplete && state.demands.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
          <h4 className="font-semibold text-blue-800 mb-2">Ready to Plan</h4>
          <p className="text-sm text-blue-700">
            Configuration is complete! Go to the <strong>Planner</strong> tab to add demands and
            generate your production plan.
          </p>
        </div>
      )}

      {/* Current Plan Summary */}
      {hasPlan && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Current Plan Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Production by Reference */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Production by Reference</h4>
              <div className="space-y-2">
                {Object.entries(
                  state.planItems
                    .filter((p) => !p.isSetup)
                    .reduce((acc, item) => {
                      const refName = state.references.find((r) => r.id === item.referenceId)?.name || item.referenceId;
                      if (!acc[refName]) acc[refName] = 0;
                      acc[refName] += item.quantity;
                      return acc;
                    }, {} as Record<string, number>)
                )
                  .sort(([, a], [, b]) => b - a)
                  .map(([ref, qty]) => (
                    <div key={ref} className="flex justify-between text-sm">
                      <span className="text-gray-700">{ref}</span>
                      <span className="font-medium text-gray-900">{qty.toFixed(1)} tons</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Line Utilization */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Line Utilization</h4>
              <div className="space-y-2">
                {state.lines.map((line) => {
                  const lineHours = state.planItems
                    .filter((p) => p.lineId === line.id)
                    .reduce((sum, p) => sum + p.duration, 0);
                  return (
                    <div key={line.id} className="flex justify-between text-sm">
                      <span className="text-gray-700">{line.name}</span>
                      <span className="font-medium text-gray-900">{lineHours.toFixed(1)}h</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
