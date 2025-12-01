import { useState } from 'react';
import { AppProvider } from './context/AppContext';
import { Layout } from './components/Layout';
import { Tabs } from './components/Tabs';
import { Dashboard } from './screens/Dashboard';
import { Configuration } from './screens/Configuration';
import { Planner } from './screens/Planner';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const tabs = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      content: <Dashboard />,
    },
    {
      id: 'configuration',
      label: 'Configuration',
      content: <Configuration />,
    },
    {
      id: 'planner',
      label: 'Planner',
      content: <Planner />,
    },
  ];

  return (
    <AppProvider>
      <Layout>
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
      </Layout>
    </AppProvider>
  );
}

export default App;
