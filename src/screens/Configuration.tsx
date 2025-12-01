import { useState } from 'react';
import { Tabs } from '../components/Tabs';
import { LinesConfig } from './config/LinesConfig';
import { ReferencesConfig } from './config/ReferencesConfig';
import { ThroughputConfig } from './config/ThroughputConfig';
import { AvailabilityConfig } from './config/AvailabilityConfig';
import { SetupTimesConfig } from './config/SetupTimesConfig';

export const Configuration = () => {
  const [activeTab, setActiveTab] = useState('lines');

  const tabs = [
    {
      id: 'lines',
      label: 'Lines',
      content: <LinesConfig />,
    },
    {
      id: 'references',
      label: 'References',
      content: <ReferencesConfig />,
    },
    {
      id: 'throughput',
      label: 'Throughput',
      content: <ThroughputConfig />,
    },
    {
      id: 'availability',
      label: 'Availability',
      content: <AvailabilityConfig />,
    },
    {
      id: 'setup',
      label: 'Setup Times',
      content: <SetupTimesConfig />,
    },
  ];

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Configuration</h2>
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
    </div>
  );
};
