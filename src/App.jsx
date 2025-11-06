import React, { useState, useEffect } from 'react';

const custodians = ['Alice', 'Bob', 'Charlie', 'Diana'];
const restrooms = ['Restroom A', 'Restroom B', 'Restroom C', 'Restroom D'];

function App() {
  const [logs, setLogs] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [selectedCustodian, setSelectedCustodian] = useState(custodians[0]);
  const [selectedRestroom, setSelectedRestroom] = useState(restrooms[0]);
  const [selectedRestroom2, setSelectedRestroom2] = useState(restrooms[0]);
  const [incidentDescription, setIncidentDescription] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  // Load from localStorage on initial load
  useEffect(() => {
    const storedLogs = JSON.parse(localStorage.getItem('logs')) || [];
    const storedIncidents = JSON.parse(localStorage.getItem('incidents')) || [];
    setLogs(storedLogs);
    setIncidents(storedIncidents);
  }, []);

  // Save to localStorage on data change
  useEffect(() => {
    localStorage.setItem('logs', JSON.stringify(logs));
  }, [logs]);

  useEffect(() => {
    localStorage.setItem('incidents', JSON.stringify(incidents));
  }, [incidents]);

  // Handlers
  const handleLogCheck = () => {
    const newLog = {
      id: Date.now(),
      custodian: selectedCustodian,
      restroom: selectedRestroom,
      timestamp: new Date(),
    };
    setLogs([newLog, ...logs]);
  };

  const handleReportIncident = () => {
    const newIncident = {
      id: Date.now(),
      custodian: selectedCustodian,
      restroom: selectedRestroom2,
      description: incidentDescription,
      timestamp: new Date(),
      lastChecked: getLastCheckedTime(selectedRestroom),
      pending: true,
    };
    setIncidents([newIncident, ...incidents]);
    setIncidentDescription('');
  };

  const handleResolveIncident = (id) => {
    setIncidents(incidents.map(i => i.id === id ? {...i, pending: false} : i));
  };

  // Helper to get last checked time for a restroom
  const getLastCheckedTime = (restroom) => {
    const lastLog = [...logs].filter(l => l.restroom === restroom).sort((a, b) => b.timestamp - a.timestamp)[0];
    return lastLog ? new Date(lastLog.timestamp).toLocaleString() : 'Never checked';
  };

  // Get last checked times for all restrooms
  const restroomLastChecked = restrooms.reduce((acc, restroom) => {
    acc[restroom] = getLastCheckedTime(restroom);
    return acc;
  }, {});

  // Incidents with last checked info
  const pendingIncidents = incidents.filter(i => i.pending);

  return (
    <div className="p-6 max-w-4xl mx-auto font-sans space-y-8">
      <h1 className="text-3xl font-bold mb-4">Restroom Log & Incident Reporting</h1>

      {/* Admin Toggle */}
      <div className="flex justify-end mb-4">
        <button
          className={`px-4 py-2 rounded ${isAdmin ? 'bg-green-500' : 'bg-gray-300'}`}
          onClick={() => setIsAdmin(!isAdmin)}
        >
          {isAdmin ? 'Switch to User' : 'Switch to Admin'}
        </button>
      </div>

      {/* Custodian Selector */}
      <div className="mb-4">
        <label className="block mb-2 font-semibold">Select Your Name:</label>
        <select
          className="border border-gray-300 rounded p-2 w-full"
          value={selectedCustodian}
          onChange={(e) => setSelectedCustodian(e.target.value)}
        >
          {custodians.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>

      {/* Log Restroom Check */}
      <div className="border p-4 rounded shadow">
        <h2 className="text-xl font-semibold mb-2">Log Restroom Check</h2>
        <div className="mb-2">
          <label className="block mb-1 font-semibold">Select Restroom:</label>
          <select
            className="border border-gray-300 rounded p-2 w-full"
            value={selectedRestroom}
            onChange={(e) => setSelectedRestroom(e.target.value)}
          >
            {restrooms.map((restroom) => (
              <option key={restroom} value={restroom}>{restroom}</option>
            ))}
          </select>
        </div>
        <button
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          onClick={handleLogCheck}
        >
          Log Check
        </button>
      </div>

      {/* Submit Incident */}
      <div className="border p-4 rounded shadow mt-4">
        <h2 className="text-xl font-semibold mb-2">Report Incident</h2>
        <div className="mb-2">
          <label className="block mb-1 font-semibold">Select Restroom:</label>
          <select
            className="border border-gray-300 rounded p-2 w-full"
            value={selectedRestroom2}
            onChange={(e) => setSelectedRestroom2(e.target.value)}
          >
            {restrooms.map((restroom) => (
              <option key={restroom} value={restroom}>{restroom}</option>
            ))}
          </select>
        </div>
        <textarea
          placeholder="Incident Description"
          className="border border-gray-300 rounded p-2 w-full mb-2"
          rows={3}
          value={incidentDescription}
          onChange={(e) => setIncidentDescription(e.target.value)}
        />
        <button
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          onClick={handleReportIncident}
        >
          Submit Incident
        </button>
      </div>

      {/* Last Checked Restrooms */}
      <div className="mt-6">
        <h2 className="text-xl font-semibold mb-2">Last Checked Restrooms</h2>
        <ul className="divide-y divide-gray-200">
          {restrooms.map((restroom) => (
            <li key={restroom} className="py-2 flex justify-between items-center">
              <div>
                <p className="font-semibold">{restroom}</p>
                <p className="text-sm text-gray-600">Last checked: {restroomLastChecked[restroom]}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Restrooms with Pending Incidents */}
      <div className="mt-6">
        <h2 className="text-xl font-semibold mb-2">Restrooms with Pending Incidents</h2>
        {pendingIncidents.length > 0 ? (
          <ul className="divide-y divide-gray-200">
            {pendingIncidents.map((incident) => (
              <li key={incident.id} className="py-2 border-b border-gray-200">
                <div className="flex justify-between items-center mb-1">
                  <div>
                    <p className="font-semibold">{incident.restroom}</p>
                    <p className="text-sm text-gray-600">{incident.description}</p>
                  </div>
                  {isAdmin && (
                    <button
                      className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
                      onClick={() => handleResolveIncident(incident.id)}
                    >
                      Resolve
                    </button>
                  )}
                </div>
                <p className="text-sm text-gray-400">
                  Reported by {incident.custodian} at {new Date(incident.timestamp).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p>No pending incidents.</p>
        )}
      </div>
    </div>
  );
}

export default App;