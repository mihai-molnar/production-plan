import { useApp } from '../../context/AppContext';

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export const AvailabilityConfig = () => {
  const { state, addAvailability, updateAvailability, deleteAvailability } = useApp();

  const getAvailability = (lineId: string, dayOfWeek: number): number | undefined => {
    return state.availabilities.find((a) => a.lineId === lineId && a.dayOfWeek === dayOfWeek)
      ?.hoursAvailable;
  };

  const handleCellChange = (lineId: string, dayOfWeek: number, value: string) => {
    const hoursAvailable = parseFloat(value);

    if (value === '' || isNaN(hoursAvailable)) {
      // If empty or invalid, delete the availability
      const exists = state.availabilities.some(
        (a) => a.lineId === lineId && a.dayOfWeek === dayOfWeek
      );
      if (exists) {
        deleteAvailability(lineId, dayOfWeek);
      }
      return;
    }

    if (hoursAvailable < 0 || hoursAvailable > 24) {
      return; // Ignore invalid values
    }

    const exists = state.availabilities.some(
      (a) => a.lineId === lineId && a.dayOfWeek === dayOfWeek
    );

    if (exists) {
      updateAvailability(lineId, dayOfWeek, { hoursAvailable });
    } else {
      addAvailability({ lineId, dayOfWeek, hoursAvailable });
    }
  };

  const fillRow = (lineId: string, hours: number) => {
    for (let day = 0; day < 7; day++) {
      const exists = state.availabilities.some(
        (a) => a.lineId === lineId && a.dayOfWeek === day
      );
      if (exists) {
        updateAvailability(lineId, day, { hoursAvailable: hours });
      } else {
        addAvailability({ lineId, dayOfWeek: day, hoursAvailable: hours });
      }
    }
  };

  const clearRow = (lineId: string) => {
    for (let day = 0; day < 7; day++) {
      const exists = state.availabilities.some(
        (a) => a.lineId === lineId && a.dayOfWeek === day
      );
      if (exists) {
        deleteAvailability(lineId, day);
      }
    }
  };

  if (state.lines.length === 0) {
    return (
      <div>
        <h3 className="text-lg font-semibold mb-4">Line Availability</h3>
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <p className="text-yellow-800">
            Please add Lines first before configuring availability.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Line Availability (Hours)</h3>
      <p className="text-sm text-gray-600 mb-4">
        Enter the number of hours each line is available for each day of the week (0-24). Leave
        empty for days when the line is unavailable.
      </p>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 border-b border-r">
                Line
              </th>
              {DAYS_OF_WEEK.map((day) => (
                <th
                  key={day}
                  className="px-4 py-2 text-center text-sm font-semibold text-gray-700 border-b"
                >
                  {day}
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
                <td className="px-4 py-2 font-medium text-sm border-b border-r">
                  {line.name}
                </td>
                {DAYS_OF_WEEK.map((_, dayIndex) => (
                  <td key={dayIndex} className="px-2 py-2 border-b">
                    <input
                      type="number"
                      min="0"
                      max="24"
                      step="0.5"
                      value={getAvailability(line.id, dayIndex) ?? ''}
                      onChange={(e) => handleCellChange(line.id, dayIndex, e.target.value)}
                      className="w-full px-2 py-1 text-center border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="-"
                    />
                  </td>
                ))}
                <td className="px-2 py-2 border-b border-l">
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={() => fillRow(line.id, 24)}
                      className="text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap"
                      title="Fill all days with 24 hours"
                    >
                      Fill 24h
                    </button>
                    <button
                      onClick={() => clearRow(line.id)}
                      className="text-xs text-red-600 hover:text-red-800"
                      title="Clear all days"
                    >
                      Clear
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
        <p className="text-sm text-blue-800">
          <strong>Tip:</strong> Use "Fill 24h" to quickly set a line to 24 hours for all days,
          then adjust individual days as needed.
        </p>
      </div>
    </div>
  );
};
