import { useApp } from '../../context/AppContext';

export const ThroughputConfig = () => {
  const { state, addThroughput, updateThroughput, deleteThroughput } = useApp();

  const getThroughput = (lineId: string, referenceId: string): number | undefined => {
    return state.throughputs.find((t) => t.lineId === lineId && t.referenceId === referenceId)
      ?.rate;
  };

  const handleCellChange = (lineId: string, referenceId: string, value: string) => {
    const rate = parseFloat(value);

    if (value === '' || isNaN(rate)) {
      // If empty or invalid, delete the throughput
      const exists = state.throughputs.some(
        (t) => t.lineId === lineId && t.referenceId === referenceId
      );
      if (exists) {
        deleteThroughput(lineId, referenceId);
      }
      return;
    }

    if (rate <= 0) {
      return; // Ignore invalid values
    }

    const exists = state.throughputs.some(
      (t) => t.lineId === lineId && t.referenceId === referenceId
    );

    if (exists) {
      updateThroughput(lineId, referenceId, { rate });
    } else {
      addThroughput({ lineId, referenceId, rate });
    }
  };

  const clearRow = (lineId: string) => {
    state.references.forEach((ref) => {
      const exists = state.throughputs.some(
        (t) => t.lineId === lineId && t.referenceId === ref.id
      );
      if (exists) {
        deleteThroughput(lineId, ref.id);
      }
    });
  };

  if (state.lines.length === 0 || state.references.length === 0) {
    return (
      <div>
        <h3 className="text-lg font-semibold mb-4">Throughput Rates</h3>
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <p className="text-yellow-800">
            Please add Lines and References first before configuring throughput rates.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Throughput Rates (Tons/Hour)</h3>
      <p className="text-sm text-gray-600 mb-4">
        Enter the production rate (tons per hour) for each line-reference combination. Leave empty
        if a line cannot produce a specific reference.
      </p>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 border-b border-r sticky left-0 bg-gray-100">
                Line / Reference
              </th>
              {state.references.map((ref) => (
                <th
                  key={ref.id}
                  className="px-4 py-2 text-center text-sm font-semibold text-gray-700 border-b"
                >
                  {ref.name}
                </th>
              ))}
              <th className="px-4 py-2 text-center text-sm font-semibold text-gray-700 border-b border-l">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {state.lines.map((line) => (
              <tr key={line.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-medium text-sm border-b border-r sticky left-0 bg-white">
                  {line.name}
                </td>
                {state.references.map((ref) => (
                  <td key={ref.id} className="px-2 py-2 border-b">
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={getThroughput(line.id, ref.id) ?? ''}
                      onChange={(e) => handleCellChange(line.id, ref.id, e.target.value)}
                      className="w-full px-2 py-1 text-center border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="-"
                    />
                  </td>
                ))}
                <td className="px-2 py-2 border-b border-l">
                  <button
                    onClick={() => clearRow(line.id)}
                    className="text-xs text-red-600 hover:text-red-800"
                    title="Clear all rates for this line"
                  >
                    Clear
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
        <p className="text-sm text-blue-800">
          <strong>Tip:</strong> Only fill in combinations where a line can actually produce a
          reference. Empty cells mean the line cannot produce that reference.
        </p>
      </div>
    </div>
  );
};
