import React, { useState, useEffect } from 'react';
import api from './api';

// Gender mapping (move to backend later if needed)
const femaleCustodians = ['Shantelle', 'Jalessa'];
const maleCustodians = ['Joel', 'Javon', 'Rey'];
const femaleRestrooms = ["Girls' Locker Room", 'H Wing', 'J Wing', 'C Wing', 'E Wing', 'M Wing'];
const maleRestrooms = ["Boys' Locker Room", 'G Wing', 'D Wing', 'L Wing', 'N Wing'];

function App() {
  const [restrooms, setRestrooms] = useState([]);
  const [custodians, setCustodians] = useState([]);
  const [logs, setLogs] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustodian, setSelectedCustodian] = useState('');
  const [selectedRestroom, setSelectedRestroom] = useState('');
  const [selectedRestroom2, setSelectedRestroom2] = useState('');
  const [incidentDescription, setIncidentDescription] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [usingLocalStorage, setUsingLocalStorage] = useState(false);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLoginScreen, setShowLoginScreen] = useState(false); // Start as false, will be set after auth check
  const [loginPassword, setLoginPassword] = useState('');
  const [checkingAuth, setCheckingAuth] = useState(true); // Track if we're checking auth

  // Load data on mount - always check auth status first
  useEffect(() => {
    // Check auth status without resetting state first
    checkAuthStatus();
  }, []);

  // Load data after authentication
  useEffect(() => {
    if (isAuthenticated && !usingLocalStorage) {
      loadData();
      checkAdminStatus();
    }
  }, [isAuthenticated]);

  // Auto-refresh data every 30 seconds (only when authenticated)
  useEffect(() => {
    if (!isAuthenticated && !usingLocalStorage) return;

    const interval = setInterval(() => {
      // Refresh data silently (without showing loading spinner)
      if (isAuthenticated || usingLocalStorage) {
        loadData(false).catch(err => console.error('Auto-refresh error:', err));
        if (!usingLocalStorage) {
          checkAdminStatus();
        }
      }
    }, 30000); // Refresh every 30 seconds

    // Cleanup interval on unmount
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, usingLocalStorage]); // Re-run when auth status changes

  // Check authentication status
  const checkAuthStatus = async () => {
    setCheckingAuth(true); // Start checking
    try {
      const response = await api.checkAuthStatus();
      // Explicitly check for authentication - always require login screen if not authenticated
      if (response.isAuthenticated === true) {
        setIsAuthenticated(true);
        setShowLoginScreen(false);
        setIsAdmin(response.isAdmin || false);
        if (!usingLocalStorage) {
          loadData();
          checkAdminStatus();
        }
      } else {
        // Not authenticated - show login screen
        setIsAuthenticated(false);
        setShowLoginScreen(true);
      }
    } catch (error) {
      // On error, check if it's a 401 (unauthorized) - then show login
      if (error.response?.status === 401) {
        setIsAuthenticated(false);
        setShowLoginScreen(true);
      } else {
        // Network/other errors - allow localStorage mode as fallback
        console.warn('Auth check failed, allowing localStorage mode:', error);
        setUsingLocalStorage(true);
        setIsAuthenticated(true);
        setShowLoginScreen(false);
        loadData();
      }
    } finally {
      setCheckingAuth(false); // Done checking
    }
  };

  // Check admin status from server
  const checkAdminStatus = async () => {
    try {
      const response = await api.checkAdminStatus();
      setIsAdmin(response.isAdmin || false);
    } catch (error) {
      // If API fails, fall back to localStorage mode - no admin by default
      setIsAdmin(false);
    }
  };

  // Handle user login
  const handleUserLogin = async () => {
    try {
      const response = await api.userLogin(loginPassword);
      if (response.success) {
        setIsAuthenticated(true);
        setShowLoginScreen(false);
        setLoginPassword('');
        await loadData();
        await checkAdminStatus();
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Invalid password';
      alert(errorMsg);
      setLoginPassword('');
    }
  };

  const loadData = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const [restroomsData, custodiansData, checksData, incidentsData] = await Promise.all([
        api.getRestrooms(),
        api.getCustodians(),
        api.getChecks(),
        api.getIncidents()
      ]);
      
      setRestrooms(restroomsData);
      setCustodians(custodiansData);
      setLogs(checksData);
      setIncidents(incidentsData);
      
      // Set initial selections
      if (custodiansData.length > 0 && !selectedCustodian) {
        setSelectedCustodian(custodiansData[0].name);
      }
      if (restroomsData.length > 0 && !selectedRestroom) {
        setSelectedRestroom(restroomsData[0].name);
        setSelectedRestroom2(restroomsData[0].name);
      }
    } catch (error) {
      console.error('Failed to load data from API:', error);
      // Fallback to localStorage if API fails
      console.log('Falling back to localStorage...');
      setUsingLocalStorage(true);
      const storedLogs = JSON.parse(localStorage.getItem('logs')) || [];
      const storedIncidents = JSON.parse(localStorage.getItem('incidents')) || [];
      
      // Use default data structure
      const defaultRestrooms = [
        // Boys' restrooms
        { id: 'boys-locker-room', name: "Boys' Locker Room", building: 'Athletics', floor: 1 },
        { id: 'g-wing', name: 'G Wing', building: 'G Wing', floor: 1 },
        { id: 'd-wing', name: 'D Wing', building: 'D Wing', floor: 1 },
        { id: 'l-wing', name: 'L Wing', building: 'L Wing', floor: 1 },
        { id: 'n-wing', name: 'N Wing', building: 'N Wing', floor: 1 },
        // Girls' restrooms
        { id: 'girls-locker-room', name: "Girls' Locker Room", building: 'Athletics', floor: 1 },
        { id: 'h-wing', name: 'H Wing', building: 'H Wing', floor: 1 },
        { id: 'j-wing', name: 'J Wing', building: 'J Wing', floor: 1 },
        { id: 'c-wing', name: 'C Wing', building: 'C Wing', floor: 1 },
        { id: 'e-wing', name: 'E Wing', building: 'E Wing', floor: 1 },
        { id: 'm-wing', name: 'M Wing', building: 'M Wing', floor: 1 }
      ];
      
      const defaultCustodians = [
        { id: 'shantelle', name: 'Shantelle', gender: 'female' },
        { id: 'jalessa', name: 'Jalessa', gender: 'female' },
        { id: 'joel', name: 'Joel', gender: 'male' },
        { id: 'javon', name: 'Javon', gender: 'male' },
        { id: 'rey', name: 'Rey', gender: 'male' }
      ];
      
      setRestrooms(defaultRestrooms);
      setCustodians(defaultCustodians);
      setLogs(storedLogs);
      setIncidents(storedIncidents);
      
      // Set initial selections
      if (defaultCustodians.length > 0 && !selectedCustodian) {
        setSelectedCustodian(defaultCustodians[0].name);
      }
      if (defaultRestrooms.length > 0 && !selectedRestroom) {
        setSelectedRestroom(defaultRestrooms[0].name);
        setSelectedRestroom2(defaultRestrooms[0].name);
      }
    } finally {
      setLoading(false);
    }
  };

  // Get available restrooms based on custodian gender
  const getAvailableRestrooms = (custodianName) => {
    if (femaleCustodians.includes(custodianName)) {
      return restrooms.filter(r => femaleRestrooms.includes(r.name));
    } else if (maleCustodians.includes(custodianName)) {
      return restrooms.filter(r => maleRestrooms.includes(r.name));
    }
    return restrooms;
  };

  const availableRestrooms = getAvailableRestrooms(selectedCustodian);

  // Update selected restrooms when custodian changes
  useEffect(() => {
    const available = getAvailableRestrooms(selectedCustodian);
    if (available.length > 0) {
      if (!available.find(r => r.name === selectedRestroom)) {
        setSelectedRestroom(available[0].name);
      }
      if (!available.find(r => r.name === selectedRestroom2)) {
        setSelectedRestroom2(available[0].name);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustodian]);

  // Helper to get the last check time for a restroom
  const getLastCheckTime = (restroomName) => {
    const logsForRestroom = logs.filter(l => l.restroom === restroomName);
    if (logsForRestroom.length === 0) return 'Never checked';
    const lastLog = logsForRestroom.reduce((latest, current) =>
      new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest
    );
    return new Date(lastLog.timestamp).toLocaleString();
  };

  // Helper to determine if a restroom has an active incident
  const hasActiveIncident = (restroomName) => {
    return incidents.some(i => i.restroom === restroomName && (i.pending === 1 || i.pending === true));
  };

  const handleLogCheck = async () => {
    if (hasActiveIncident(selectedRestroom)) {
      alert('Cannot check this restroom. There is an active incident reported.');
      return;
    }

    try {
      const custodian = custodians.find(c => c.name === selectedCustodian);
      const restroom = restrooms.find(r => r.name === selectedRestroom);
      
      if (!custodian || !restroom) {
        alert('Invalid custodian or restroom selection');
        return;
      }

      // Try API first, fallback to localStorage
      try {
        await api.logCheck(custodian.id, restroom.id);
        await loadData();
        alert('Check logged successfully!');
      } catch (apiError) {
        console.warn('API failed, using localStorage:', apiError);
        // Fallback to localStorage
    const newLog = {
      id: Date.now(),
      custodian: selectedCustodian,
      restroom: selectedRestroom,
          timestamp: new Date().toISOString(),
    };
        const updatedLogs = [newLog, ...logs];
        setLogs(updatedLogs);
        localStorage.setItem('logs', JSON.stringify(updatedLogs));
        alert('Check logged successfully! (Using local storage)');
      }
    } catch (error) {
      console.error('Failed to log check:', error);
      alert('Failed to log check. Please try again.');
    }
  };

  const handleReportIncident = async () => {
    if (!incidentDescription.trim()) {
      alert('Please describe the incident');
      return;
    }

    try {
      const custodian = custodians.find(c => c.name === selectedCustodian);
      const restroom = restrooms.find(r => r.name === selectedRestroom2);
      
      if (!custodian || !restroom) {
        alert('Invalid custodian or restroom selection');
        return;
      }

      // Try API first, fallback to localStorage
      try {
        await api.reportIncident(custodian.id, restroom.id, incidentDescription);
        await loadData();
        setIncidentDescription('');
        alert('Incident reported successfully!');
      } catch (apiError) {
        console.warn('API failed, using localStorage:', apiError);
        // Fallback to localStorage
    const newIncident = {
      id: Date.now(),
      custodian: selectedCustodian,
      restroom: selectedRestroom2,
      description: incidentDescription,
          timestamp: new Date().toISOString(),
      lastChecked: getLastCheckTime(selectedRestroom2),
      pending: true,
    };
        const updatedIncidents = [newIncident, ...incidents];
        setIncidents(updatedIncidents);
        localStorage.setItem('incidents', JSON.stringify(updatedIncidents));
    setIncidentDescription('');
        alert('Incident reported successfully! (Using local storage)');
      }
    } catch (error) {
      console.error('Failed to report incident:', error);
      alert('Failed to report incident. Please try again.');
    }
  };

  const handleResolveIncident = async (incidentId) => {
    try {
      // Only use API if not in localStorage mode
      if (!usingLocalStorage) {
        await api.resolveIncident(incidentId);
        await loadData();
        alert('Incident resolved!');
      } else {
        // Fallback to localStorage only if in localStorage mode
        const updatedIncidents = incidents.map(i => 
          i.id === incidentId ? { ...i, pending: false } : i
        );
        setIncidents(updatedIncidents);
        localStorage.setItem('incidents', JSON.stringify(updatedIncidents));
        alert('Incident resolved! (Using local storage)');
      }
    } catch (error) {
      console.error('Failed to resolve incident:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Unknown error';
      
      // If it's a 403 (forbidden), user needs to be admin
      if (error.response?.status === 403) {
        alert('Admin access required to resolve incidents. Please log in as admin.');
      } else if (error.response?.status) {
        // Other API error
        alert(`Failed to resolve incident: ${errorMsg}`);
      } else {
        // Network/connection error - fallback to localStorage if API unavailable
        console.warn('API unavailable, using localStorage:', error);
        const updatedIncidents = incidents.map(i => 
          i.id === incidentId ? { ...i, pending: false } : i
        );
        setIncidents(updatedIncidents);
        localStorage.setItem('incidents', JSON.stringify(updatedIncidents));
        alert('Incident resolved! (Using local storage - API unavailable)');
      }
    }
  };

  const handleAdminLogin = async () => {
    try {
      // Try API first
      try {
        const response = await api.adminLogin(passwordInput);
        if (response.success) {
          setIsAdmin(true);
          setShowPasswordPrompt(false);
          setPasswordInput('');
          alert('Admin access granted!');
          return;
        }
      } catch (apiError) {
        // If API fails and we're in localStorage mode, we can't verify password
        // In this case, we'll just show an error
        if (usingLocalStorage) {
          alert('Admin authentication requires backend server connection.');
          setPasswordInput('');
          setShowPasswordPrompt(false);
          return;
        }
        const errorMsg = apiError.response?.data?.error || 'Invalid password';
        alert(errorMsg);
        setPasswordInput('');
      }
    } catch (error) {
      console.error('Admin login error:', error);
      alert('Failed to authenticate. Please try again.');
      setPasswordInput('');
    }
  };

  const handleAdminLogout = async () => {
    try {
      await api.adminLogout();
      setIsAdmin(false);
      alert('Logged out of admin mode');
    } catch (error) {
      console.error('Failed to logout:', error);
      // Still set admin to false locally
      setIsAdmin(false);
    }
  };

  const pendingIncidents = incidents.filter(i => i.pending === 1 || i.pending === true);

  // Show loading screen while checking auth
  if (checkingAuth && !usingLocalStorage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="text-center">
          <div className="text-4xl mb-4">🧹</div>
          <div className="text-2xl font-semibold text-gray-700">Loading...</div>
        </div>
      </div>
    );
  }

  // Show login screen if not authenticated
  if (showLoginScreen && !usingLocalStorage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4">
          <div className="text-center mb-6">
            <div className="text-5xl mb-4">🧹</div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
              Restroom Management System
            </h1>
            <p className="text-gray-600">Please enter the password to access</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block mb-2 font-semibold text-gray-700">Password:</label>
              <input
                type="password"
                className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
                placeholder="Enter password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleUserLogin();
                  }
                }}
                autoFocus
              />
            </div>
            <button
              className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-[1.02]"
              onClick={handleUserLogin}
            >
              Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="text-center">
          <div className="text-4xl mb-4">🧹</div>
          <div className="text-2xl font-semibold text-gray-700">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="p-6 max-w-6xl mx-auto font-sans space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
                🧹 Restroom Management System
              </h1>
              <p className="text-gray-600">Track checks and report incidents</p>
              {usingLocalStorage && (
                <p className="text-yellow-600 text-sm mt-1 font-semibold">
                  ⚠️ Using local storage mode (Backend server not available)
                </p>
              )}
              <p className="text-xs text-gray-400 mt-1">🔄 Auto-sync enabled • Updates every 30 seconds</p>
            </div>
        <button
              className={`px-6 py-3 rounded-xl font-semibold transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 ${
                isAdmin 
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white' 
                  : 'bg-gradient-to-r from-gray-400 to-gray-500 text-white'
              }`}
              onClick={() => {
                if (isAdmin) {
                  handleAdminLogout();
                } else {
                  setShowPasswordPrompt(true);
                }
              }}
        >
              {isAdmin ? '👤 Admin Mode' : '👤 User Mode'}
        </button>
      </div>

          {/* Password Prompt Modal */}
          {showPasswordPrompt && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-4">
                <h3 className="text-2xl font-bold text-gray-800 mb-4">Enter Admin Password</h3>
                <input
                  type="password"
                  className="w-full border-2 border-gray-200 rounded-xl p-3 mb-4 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
                  placeholder="Admin password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleAdminLogin();
                    }
                  }}
                  autoFocus
                />
                <div className="flex gap-3">
                  <button
                    className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 shadow-md hover:shadow-lg"
                    onClick={handleAdminLogin}
                  >
                    Login
                  </button>
                  <button
                    className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 px-6 py-3 rounded-xl font-semibold transition-all duration-200"
                    onClick={() => {
                      setShowPasswordPrompt(false);
                      setPasswordInput('');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4">
            <label className="block mb-2 font-semibold text-gray-700">Select Your Name:</label>
        <select
              className="w-full border-2 border-gray-200 rounded-xl p-3 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none font-medium"
          value={selectedCustodian}
          onChange={(e) => setSelectedCustodian(e.target.value)}
        >
              {custodians.map((custodian) => (
                <option key={custodian.id} value={custodian.name}>{custodian.name}</option>
          ))}
        </select>
          </div>
      </div>

        {/* Action Cards Grid */}
        <div className="grid md:grid-cols-2 gap-6">
      {/* Log Restroom Check */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow duration-200">
            <div className="flex items-center mb-4">
              <div className="bg-blue-100 rounded-full p-3 mr-3">
                <span className="text-2xl">✅</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Log Restroom Check</h2>
            </div>
            <div className="mb-4">
              <label className="block mb-2 font-semibold text-gray-700">Select Restroom:</label>
          <select
                className="w-full border-2 border-gray-200 rounded-xl p-3 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
            value={selectedRestroom}
            onChange={(e) => setSelectedRestroom(e.target.value)}
          >
                {availableRestrooms.map((restroom) => (
                  <option key={restroom.id} value={restroom.name}>{restroom.name}</option>
            ))}
          </select>
        </div>
        <button
              className={`w-full px-6 py-3 rounded-xl font-semibold transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-[1.02] ${
                hasActiveIncident(selectedRestroom) 
                  ? 'bg-gray-300 cursor-not-allowed text-gray-500' 
                  : 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white'
              }`}
          onClick={handleLogCheck}
          disabled={hasActiveIncident(selectedRestroom)}
        >
              {hasActiveIncident(selectedRestroom) ? '⚠️ Cannot Check - Active Incident' : '✓ Log Check'}
        </button>
        {hasActiveIncident(selectedRestroom) && (
              <div className="mt-4 p-3 bg-red-50 border-l-4 border-red-500 rounded-lg">
                <p className="text-red-700 font-semibold flex items-center">
                  <span className="mr-2">🚨</span>
                  Incident reported! Cannot check this restroom until resolved.
                </p>
              </div>
        )}
      </div>

      {/* Submit Incident */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow duration-200">
            <div className="flex items-center mb-4">
              <div className="bg-red-100 rounded-full p-3 mr-3">
                <span className="text-2xl">🚨</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Report Incident</h2>
            </div>
            <div className="mb-4">
              <label className="block mb-2 font-semibold text-gray-700">Select Restroom:</label>
          <select
                className="w-full border-2 border-gray-200 rounded-xl p-3 bg-white focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all outline-none"
            value={selectedRestroom2}
            onChange={(e) => setSelectedRestroom2(e.target.value)}
          >
                {availableRestrooms.map((restroom) => (
                  <option key={restroom.id} value={restroom.name}>{restroom.name}</option>
            ))}
          </select>
        </div>
        <textarea
              placeholder="Describe the incident in detail..."
              className="w-full border-2 border-gray-200 rounded-xl p-3 mb-4 bg-white focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all outline-none resize-none"
          rows={3}
          value={incidentDescription}
          onChange={(e) => setIncidentDescription(e.target.value)}
        />
        <button
              className="w-full bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-[1.02]"
          onClick={handleReportIncident}
        >
              🚨 Submit Incident
        </button>
          </div>
      </div>

        {/* Restroom Status Grid */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
            <span className="mr-2">📊</span>
            Restroom Status Overview
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {restrooms.map((restroom) => (
              <div
                key={restroom.id}
                className={`p-5 rounded-xl border-2 transition-all duration-200 ${
                  hasActiveIncident(restroom.name)
                    ? 'bg-red-50 border-red-300 shadow-md'
                    : 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 shadow-sm hover:shadow-md'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-lg text-gray-800">{restroom.name}</h3>
                  <span className="text-2xl">
                    {hasActiveIncident(restroom.name) ? '🚨' : '✅'}
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="text-gray-600 font-medium">Last checked:</span>
                    <p className="text-gray-800 font-semibold mt-1">
                      {getLastCheckTime(restroom.name) === 'Never checked' 
                        ? 'Never' 
                        : new Date(getLastCheckTime(restroom.name)).toLocaleDateString()}
                    </p>
                    {getLastCheckTime(restroom.name) !== 'Never checked' && (
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(getLastCheckTime(restroom.name)).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                  <div className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                    hasActiveIncident(restroom.name)
                      ? 'bg-red-200 text-red-800'
                      : 'bg-green-200 text-green-800'
                  }`}>
                    {hasActiveIncident(restroom.name) ? '⚠️ Active Incident' : '✓ All Clear'}
                  </div>
                </div>
              </div>
          ))}
          </div>
      </div>

        {/* Pending Incidents */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
            <span className="mr-2">⚠️</span>
            Pending Incidents
            {pendingIncidents.length > 0 && (
              <span className="ml-3 bg-red-500 text-white text-sm px-3 py-1 rounded-full">
                {pendingIncidents.length}
              </span>
            )}
          </h2>
        {pendingIncidents.length > 0 ? (
            <div className="space-y-4">
            {pendingIncidents.map((incident) => (
                <div
                  key={incident.id}
                  className="bg-red-50 border-l-4 border-red-500 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow duration-200"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <span className="text-2xl mr-2">🚨</span>
                        <h3 className="font-bold text-xl text-gray-800">{incident.restroom}</h3>
                      </div>
                      <p className="text-gray-700 mb-3 bg-white p-3 rounded-lg border border-red-200">
                        {incident.description}
                      </p>
                      <div className="flex flex-wrap gap-2 text-sm text-gray-600">
                        <span className="bg-white px-3 py-1 rounded-full border border-gray-200">
                          👤 {incident.custodian}
                        </span>
                        <span className="bg-white px-3 py-1 rounded-full border border-gray-200">
                          🕐 {new Date(incident.timestamp).toLocaleString()}
                        </span>
                        {incident.lastCheckedAt && (
                          <span className="bg-white px-3 py-1 rounded-full border border-gray-200">
                            Last checked: {new Date(incident.lastCheckedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                  </div>
                  {isAdmin && (
                    <button
                        className="ml-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 whitespace-nowrap"
                      onClick={() => handleResolveIncident(incident.id)}
                    >
                        ✓ Resolve
                    </button>
                  )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-green-50 rounded-xl border-2 border-green-200">
              <span className="text-5xl mb-4 block">✅</span>
              <p className="text-xl font-semibold text-gray-700">No pending incidents</p>
              <p className="text-gray-500 mt-2">All restrooms are clear!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
