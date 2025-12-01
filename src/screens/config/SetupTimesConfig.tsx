import { useState } from 'react';
import { useApp } from '../../context/AppContext';

export const SetupTimesConfig = () => {
  const { state, addSetupTime, updateSetupTime, deleteSetupTime } = useApp();
  const [selectedLineId, setSelectedLineId] = useState<string>('');

  const getSetupTime = (lineId: string, fromRefId: string, toRefId: string): number | undefined => {
    return state.setupTimes.find(
      (s) => s.lineId === lineId && s.fromReferenceId === fromRefId && s.toReferenceId === toRefId
    )?.duration;
  };

  const handleCellChange = (fromRefId: string, toRefId: string, value: string) => {
    if (!selectedLineId) return;

    const duration = parseFloat(value);

    if (value === '' || isNaN(duration)) {
      // If empty or invalid, delete the setup time
      const exists = state.setupTimes.some(
        (s) =>
          s.lineId === selectedLineId &&
          s.fromReferenceId === fromRefId &&
          s.toReferenceId === toRefId
      );
      if (exists) {
        deleteSetupTime(selectedLineId, fromRefId, toRefId);
      }
      return;
    }

    if (duration < 0) {
      return; // Ignore invalid values
    }

    const exists = state.setupTimes.some(
      (s) =>
        s.lineId === selectedLineId &&
        s.fromReferenceId === fromRefId &&
        s.toReferenceId === toRefId
    );

    if (exists) {
      updateSetupTime(selectedLineId, fromRefId, toRefId, { duration });
    } else {
      addSetupTime({
        lineId: selectedLineId,
        fromReferenceId: fromRefId,
        toReferenceId: toRefId,
        duration,
      });
    }
  };

  const clearMatrix = () => {
    if (!selectedLineId) return;
    if (!confirm('Clear all setup times for this line?')) return;

    state.references.forEach((fromRef) => {
      state.references.forEach((toRef) => {
        if (fromRef.id !== toRef.id) {
          const exists = state.setupTimes.some(
            (s) =>
              s.lineId === selectedLineId &&
              s.fromReferenceId === fromRef.id &&
              s.toReferenceId === toRef.id
          );
          if (exists) {
            deleteSetupTime(selectedLineId, fromRef.id, toRef.id);
          }
        }
      });
    });
  };

  const fillDiagonal = (value: number) => {
    if (!selectedLineId) return;

    state.references.forEach((fromRef) => {
      state.references.forEach((toRef) => {
        if (fromRef.id !== toRef.id) {
          const exists = state.setupTimes.some(
            (s) =>
              s.lineId === selectedLineId &&
              s.fromReferenceId === fromRef.id &&
              s.toReferenceId === toRef.id
          );
          if (exists) {
            updateSetupTime(selectedLineId, fromRef.id, toRef.id, { duration: value });
          } else {
            addSetupTime({
              lineId: selectedLineId,
              fromReferenceId: fromRef.id,
              toReferenceId: toRef.id,
              duration: value,
            });
          }
        }
      });
    });
  };

  if (state.lines.length === 0 || state.references.length === 0) {
    return (
      <div>
        <h3 className="text-lg font-semibold mb-4">Setup Times</h3>
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <p className="text-yellow-800">
            Please add Lines and References first before configuring setup times.
          </p>
        </div>
      </div>
    );
  }

  // Set default line if not selected
  if (!selectedLineId && state.lines.length > 0) {
    setSelectedLineId(state.lines[0].id);
  }

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Setup Times (Hours)</h3>
      <p className="text-sm text-gray-600 mb-4">
        Enter the time (in hours) required to switch production from one reference to another on
        each line. Leave empty for instant changeovers.
      </p>

      <div className="mb-4 flex items-center gap-4">
        <label className="font-medium text-sm">Select Line:</label>
        <select
          value={selectedLineId}
          onChange={(e) => setSelectedLineId(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {state.lines.map((line) => (
            <option key={line.id} value={line.id}>
              {line.name}
            </option>
          ))}
        </select>
        <div className="flex gap-2 ml-auto">
          <button
            onClick={() => fillDiagonal(1)}
            className="text-sm px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            title="Fill all with 1 hour"
          >
            Fill 1h
          </button>
          <button
            onClick={() => fillDiagonal(2)}
            className="text-sm px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            title="Fill all with 2 hours"
          >
            Fill 2h
          </button>
          <button
            onClick={clearMatrix}
            className="text-sm px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600"
          >
            Clear All
          </button>
        </div>
      </div>

      {selectedLineId && (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 border-b border-r sticky left-0 bg-gray-100">
                  From → To
                </th>
                {state.references.map((ref) => (
                  <th
                    key={ref.id}
                    className="px-4 py-2 text-center text-sm font-semibold text-gray-700 border-b"
                  >
                    {ref.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.references.map((fromRef) => (
                <tr key={fromRef.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-sm border-b border-r sticky left-0 bg-white">
                    {fromRef.name}
                  </td>
                  {state.references.map((toRef) => (
                    <td
                      key={toRef.id}
                      className={`px-2 py-2 border-b ${
                        fromRef.id === toRef.id ? 'bg-gray-100' : ''
                      }`}
                    >
                      {fromRef.id === toRef.id ? (
                        <div className="text-center text-gray-400 text-sm">-</div>
                      ) : (
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={getSetupTime(selectedLineId, fromRef.id, toRef.id) ?? ''}
                          onChange={(e) => handleCellChange(fromRef.id, toRef.id, e.target.value)}
                          className="w-full px-2 py-1 text-center border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="0"
                        />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
        <p className="text-sm text-blue-800">
          <strong>Tip:</strong> The matrix shows setup time when changing from one reference
          (rows) to another (columns). Diagonal cells (same reference) are disabled as no setup
          is needed.
        </p>
      </div>
    </div>
  );
};
