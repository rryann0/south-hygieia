import React, { useState, useEffect, useMemo } from "react";
import api from "./api";

// Restroom gender mapping
const femaleRestrooms = [
  "Girls' Locker Room",
  "H Wing",
  "J Wing",
  "C Wing",
  "E Wing",
  "M Wing",
];
const maleRestrooms = [
  "Boys' Locker Room",
  "G Wing",
  "D Wing",
  "L Wing",
  "N Wing",
];

function App() {
  const [restrooms, setRestrooms] = useState([]);
  const [custodians, setCustodians] = useState([]);
  const [logs, setLogs] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustodian, setSelectedCustodian] = useState("");
  const [selectedRestroom, setSelectedRestroom] = useState("");
  const [selectedRestroom2, setSelectedRestroom2] = useState("");
  const [incidentDescription, setIncidentDescription] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLoginScreen, setShowLoginScreen] = useState(false); // Start as false, will be set after auth check
  const [loginPassword, setLoginPassword] = useState("");
  const [checkingAuth, setCheckingAuth] = useState(true); // Track if we're checking auth
  const [demoEmailInput, setDemoEmailInput] = useState(""); //demo only
  const [demoEmail, setDemoEmail] = useState(""); //demo only

  // Load data on mount - always check auth status first
  useEffect(() => {
    // Check auth status without resetting state first
    checkAuthStatus();
  }, []);

  // Load data after authentication
  useEffect(() => {
    if (isAuthenticated) {
      loadData();
      checkAdminStatus();
    }
  }, [isAuthenticated]);

  // SSE: refetch when server pushes a data-changed event
  useEffect(() => {
    if (!isAuthenticated) return;
    const url = api.getEventsUrl();
    const es = new EventSource(url);
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "data-changed") {
          loadData(false).catch((err) =>
            console.error("SSE refresh error:", err),
          );
          checkAdminStatus();
        }
      } catch (_) {}
    };
    es.onerror = () => es.close();
    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Check authentication status
  const checkAuthStatus = async () => {
    setCheckingAuth(true);
    try {
      const response = await api.checkAuthStatus();
      if (response.isAuthenticated === true) {
        setIsAuthenticated(true);
        setShowLoginScreen(false);
        setIsAdmin(response.isAdmin || false);
        loadData();
        checkAdminStatus();
      } else {
        setIsAuthenticated(false);
        setShowLoginScreen(true);
      }
    } catch (error) {
      if (error.response?.status === 401) {
        setIsAuthenticated(false);
        setShowLoginScreen(true);
      } else {
        // Backend unavailable - show login screen with error
        console.error("Auth check failed:", error);
        setIsAuthenticated(false);
        setShowLoginScreen(true);
      }
    } finally {
      setCheckingAuth(false);
    }
  };

  // Check admin status from server
  const checkAdminStatus = async () => {
    try {
      const response = await api.checkAdminStatus();
      const admin = response.isAdmin || false;
      setIsAdmin(admin);
      if (admin) setSelectedCustodian("Admin");
    } catch (error) {
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
        setLoginPassword("");
        await loadData();
        await checkAdminStatus();
      }
    } catch (error) {
      let errorMsg = "Invalid password";
      if (error.response?.data?.error) {
        errorMsg = error.response.data.error;
      } else if (error.message && !error.message.includes("Network")) {
        errorMsg = error.message;
      } else if (error.code === "ERR_NETWORK") {
        errorMsg = "Network error. Please check your connection.";
      }
      alert(errorMsg);
      setLoginPassword("");
    }
  };

  const loadData = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const [restroomsData, custodiansData, checksData, incidentsData] =
        await Promise.all([
          api.getRestrooms(),
          api.getCustodians(),
          api.getChecks(),
          api.getIncidents(),
        ]);

      setRestrooms(restroomsData);
      setCustodians(custodiansData);
      setLogs(checksData);
      setIncidents(incidentsData);

      if (custodiansData.length > 0 && !selectedCustodian) {
        const firstStaff =
          custodiansData.find((c) => c.name !== "Admin") || custodiansData[0];
        setSelectedCustodian(firstStaff.name);
      }
      if (restroomsData.length > 0 && !selectedRestroom) {
        setSelectedRestroom(restroomsData[0].name);
        setSelectedRestroom2(restroomsData[0].name);
      }
    } catch (error) {
      console.error("Failed to load data from API:", error);
      let errorMsg =
        "Failed to load data from server. Please check your connection and refresh.";
      if (error.response?.status === 401) {
        // Authentication error - don't show alert, auth check will handle it
        setIsAuthenticated(false);
        setShowLoginScreen(true);
        return;
      } else if (error.message) {
        errorMsg = error.message;
      } else if (error.code === "ERR_NETWORK") {
        errorMsg = "Network error. Please check your connection.";
      }
      // Only show alert if not an auth error
      if (error.response?.status !== 401) {
        alert(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  // Get available restrooms based on custodian gender (Admin sees all)
  const getAvailableRestrooms = (custodianName) => {
    if (custodianName === "Admin") return restrooms;
    const custodian = custodians.find((c) => c.name === custodianName);
    if (!custodian || !custodian.gender) {
      return restrooms; // Fallback to all restrooms if gender not found
    }
    if (custodian.gender.toLowerCase() === "female") {
      return restrooms.filter((r) => femaleRestrooms.includes(r.name));
    } else if (custodian.gender.toLowerCase() === "male") {
      return restrooms.filter((r) => maleRestrooms.includes(r.name));
    }
    return restrooms;
  };

  const availableRestrooms = useMemo(
    () => getAvailableRestrooms(selectedCustodian),
    [selectedCustodian, custodians, restrooms],
  );

  // Update selected restrooms when custodian changes
  useEffect(() => {
    const available = getAvailableRestrooms(selectedCustodian);
    if (available.length > 0) {
      if (!available.find((r) => r.name === selectedRestroom)) {
        setSelectedRestroom(available[0].name);
      }
      if (!available.find((r) => r.name === selectedRestroom2)) {
        setSelectedRestroom2(available[0].name);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustodian, custodians, restrooms]);

  // Memoize last check times and who checked
  const lastCheckTimes = useMemo(() => {
    const times = {};
    restrooms.forEach((restroom) => {
      const logsForRestroom = logs.filter((l) => l.restroom === restroom.name);
      if (logsForRestroom.length === 0) {
        times[restroom.name] = null;
      } else {
        const lastLog = logsForRestroom.reduce((latest, current) =>
          new Date(current.timestamp) > new Date(latest.timestamp)
            ? current
            : latest,
        );
        times[restroom.name] = new Date(lastLog.timestamp);
      }
    });
    return times;
  }, [logs, restrooms]);

  const lastCheckBy = useMemo(() => {
    const by = {};
    restrooms.forEach((restroom) => {
      const logsForRestroom = logs.filter((l) => l.restroom === restroom.name);
      if (logsForRestroom.length === 0) {
        by[restroom.name] = null;
      } else {
        const lastLog = logsForRestroom.reduce((latest, current) =>
          new Date(current.timestamp) > new Date(latest.timestamp)
            ? current
            : latest,
        );
        by[restroom.name] = lastLog.custodian || null;
      }
    });
    return by;
  }, [logs, restrooms]);

  // Helper to get the last check time for a restroom
  const getLastCheckTime = (restroomName) => {
    const time = lastCheckTimes[restroomName];
    if (!time) return "Never checked";
    return time.toLocaleString();
  };

  // Helper to determine if a restroom has an active incident
  const hasActiveIncident = (restroomName) => {
    return incidents.some(
      (i) =>
        i.restroom === restroomName && (i.pending === 1 || i.pending === true),
    );
  };

  const handleLogCheck = async () => {
    if (hasActiveIncident(selectedRestroom)) {
      alert(
        "Cannot check this restroom. There is an active incident reported.",
      );
      return;
    }

    try {
      const custodian =
        selectedCustodian === "Admin"
          ? custodians.find((c) => c.name === "Admin")
          : custodians.find((c) => c.name === selectedCustodian);
      const restroom = restrooms.find((r) => r.name === selectedRestroom);

      if (!custodian || !restroom) {
        alert("Invalid custodian or restroom selection");
        return;
      }

      await api.logCheck(custodian.id, restroom.id);
      await loadData();
      alert("Check logged successfully!");
    } catch (error) {
      console.error("Failed to log check:", error);
      let msg = "Failed to log check. Please try again.";
      if (error.response?.data?.error) {
        msg = error.response.data.error;
      } else if (error.message) {
        msg = error.message;
      } else if (error.code === "ECONNABORTED") {
        msg = "Request timed out. Please try again.";
      } else if (error.code === "ERR_NETWORK") {
        msg = "Network error. Please check your connection.";
      }
      alert(msg);
    }
  };

  // Demo only: save where incident alert emails should go
  const handleSaveDemoEmail = async () => {
    try {
      const result = await api.saveDemoEmail(demoEmailInput);
      setDemoEmail(result.email);
    } catch (error) {
      alert(
        error.response?.data?.error ||
          "Could not save that email. Please try again.",
      );
    }
  };

  const handleReportIncident = async () => {
    if (!incidentDescription.trim()) {
      alert("Please describe the incident");
      return;
    }

    try {
      const custodian =
        selectedCustodian === "Admin"
          ? custodians.find((c) => c.name === "Admin")
          : custodians.find((c) => c.name === selectedCustodian);
      const restroom = restrooms.find((r) => r.name === selectedRestroom2);

      if (!custodian || !restroom) {
        alert("Invalid custodian or restroom selection");
        return;
      }

      const result = await api.reportIncident(
        custodian.id,
        restroom.id,
        incidentDescription,
      );
      await loadData();
      setIncidentDescription("");
      if (
        import.meta.env.VITE_DEMO_MODE === "true" &&
        result?.emailStatus === "sent"
      ) {
        alert("Incident reported! Check your inbox for the alert email.");
      } else if (result?.emailStatus === "limit") {
        alert(
          "Incident reported! The demo email limit was reached, so no email was sent.",
        );
      } else {
        alert("Incident reported successfully!");
      }
    } catch (error) {
      console.error("Failed to report incident:", error);
      let msg = "Failed to report incident. Please try again.";
      if (error.response?.data?.error) {
        msg = error.response.data.error;
      } else if (error.message) {
        msg = error.message;
      } else if (error.code === "ECONNABORTED") {
        msg = "Request timed out. Please try again.";
      } else if (error.code === "ERR_NETWORK") {
        msg = "Network error. Please check your connection.";
      }
      alert(msg);
    }
  };

  const handleResolveIncident = async (incidentId) => {
    try {
      await api.resolveIncident(incidentId);
      await loadData();
      alert("Incident resolved!");
    } catch (error) {
      console.error("Failed to resolve incident:", error);
      let errorMsg = "Unknown error";
      if (error.response?.data?.error) {
        errorMsg = error.response.data.error;
      } else if (error.message) {
        errorMsg = error.message;
      } else if (error.code === "ECONNABORTED") {
        errorMsg = "Request timed out. Please try again.";
      } else if (error.code === "ERR_NETWORK") {
        errorMsg = "Network error. Please check your connection.";
      }
      if (error.response?.status === 403) {
        alert(
          "Admin access required to resolve incidents. Please log in as admin.",
        );
      } else {
        alert(`Failed to resolve incident: ${errorMsg}`);
      }
    }
  };

  const handleAdminLogin = async () => {
    try {
      const response = await api.adminLogin(passwordInput);
      if (response.success) {
        setIsAdmin(true);
        setSelectedCustodian("Admin");
        setShowPasswordPrompt(false);
        setPasswordInput("");
        alert("Admin access granted!");
      }
    } catch (error) {
      let errorMsg = "Invalid password";
      if (error.response?.data?.error) {
        errorMsg = error.response.data.error;
      } else if (error.message && !error.message.includes("Network")) {
        errorMsg = error.message;
      } else if (error.code === "ERR_NETWORK") {
        errorMsg = "Network error. Please check your connection.";
      }
      alert(errorMsg);
      setPasswordInput("");
    }
  };

  const handleAdminLogout = async () => {
    const firstStaff =
      custodians.find((c) => c.name !== "Admin") || custodians[0];
    try {
      await api.adminLogout();
      setIsAdmin(false);
      setSelectedCustodian(firstStaff?.name || "");
      alert("Logged out of admin mode");
    } catch (error) {
      console.error("Failed to logout:", error);
      setIsAdmin(false);
      setSelectedCustodian(firstStaff?.name || "");
    }
  };

  const pendingIncidents = incidents.filter(
    (i) => i.pending === 1 || i.pending === true,
  );

  // Show loading screen while checking auth
  if (checkingAuth) {
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
  if (showLoginScreen) {
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
          {import.meta.env.VITE_DEMO_MODE === "true" && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 mb-4 text-sm">
              <strong>Public demo:</strong> the staff password is{" "}
              <code>{import.meta.env.VITE_DEMO_USER_PASSWORD}</code>
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="block mb-2 font-semibold text-gray-700">
                Password:
              </label>
              <input
                type="password"
                className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
                placeholder="Enter password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
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
        {/* Demo only: choose where incident alert emails go */}
        {import.meta.env.VITE_DEMO_MODE === "true" && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="font-semibold text-amber-800">
              Public demo: get the incident alert by email
            </p>
            <p className="text-sm text-amber-700 mb-3">
              Enter your email, then report an incident to receive the same
              alert the Dean gets. Limit: 3 emails per day.
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                className="flex-1 border-2 border-amber-200 rounded-xl p-2 outline-none focus:border-amber-400"
                placeholder="you@example.com"
                value={demoEmailInput}
                onChange={(e) => setDemoEmailInput(e.target.value)}
              />
              <button
                className="bg-amber-500 hover:bg-amber-600 text-white px-4 rounded-xl font-semibold"
                onClick={handleSaveDemoEmail}
              >
                Save
              </button>
            </div>
            {demoEmail && (
              <p className="text-sm text-amber-800 mt-2">
                Alerts will go to {demoEmail}
              </p>
            )}
          </div>
        )}
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
                🧹 Restroom Management System
              </h1>
            </div>
            <button
              className={`px-6 py-3 rounded-xl font-semibold transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 ${
                isAdmin
                  ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white"
                  : "bg-gradient-to-r from-gray-400 to-gray-500 text-white"
              }`}
              onClick={() => {
                if (isAdmin) {
                  handleAdminLogout();
                } else {
                  setShowPasswordPrompt(true);
                }
              }}
            >
              {isAdmin ? "👤 Admin Mode" : "👤 User Mode"}
            </button>
          </div>

          {/* Password Prompt Modal */}
          {showPasswordPrompt && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-4">
                <h3 className="text-2xl font-bold text-gray-800 mb-4">
                  Enter Admin Password
                </h3>
                {import.meta.env.VITE_DEMO_MODE === "true" && (
                  <p className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 mb-4 text-sm">
                    <strong>Public demo:</strong> the admin password is{" "}
                    <code>{import.meta.env.VITE_DEMO_ADMIN_PASSWORD}</code>
                  </p>
                )}
                <input
                  type="password"
                  className="w-full border-2 border-gray-200 rounded-xl p-3 mb-4 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
                  placeholder="Admin password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
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
                      setPasswordInput("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4">
            <label className="block mb-2 font-semibold text-gray-700">
              {isAdmin ? "Logged in as" : "Select Your Name:"}
            </label>
            <select
              className="w-full border-2 border-gray-200 rounded-xl p-3 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none font-medium"
              value={selectedCustodian}
              onChange={(e) => setSelectedCustodian(e.target.value)}
            >
              {isAdmin ? (
                <option value="Admin">Admin</option>
              ) : (
                custodians
                  .filter((c) => c.name !== "Admin")
                  .map((custodian) => (
                    <option key={custodian.id} value={custodian.name}>
                      {custodian.name}
                    </option>
                  ))
              )}
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
              <h2 className="text-2xl font-bold text-gray-800">
                Log Restroom Check
              </h2>
            </div>
            <div className="mb-4">
              <label className="block mb-2 font-semibold text-gray-700">
                Select Restroom:
              </label>
              <select
                className="w-full border-2 border-gray-200 rounded-xl p-3 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
                value={selectedRestroom}
                onChange={(e) => setSelectedRestroom(e.target.value)}
              >
                {availableRestrooms.map((restroom) => (
                  <option key={restroom.id} value={restroom.name}>
                    {restroom.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              className={`w-full px-6 py-3 rounded-xl font-semibold transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-[1.02] ${
                hasActiveIncident(selectedRestroom)
                  ? "bg-gray-300 cursor-not-allowed text-gray-500"
                  : "bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white"
              }`}
              onClick={handleLogCheck}
              disabled={hasActiveIncident(selectedRestroom)}
            >
              {hasActiveIncident(selectedRestroom)
                ? "⚠️ Cannot Check - Active Incident"
                : "✓ Log Check"}
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
              <h2 className="text-2xl font-bold text-gray-800">
                Report Incident
              </h2>
            </div>
            <div className="mb-4">
              <label className="block mb-2 font-semibold text-gray-700">
                Select Restroom:
              </label>
              <select
                className="w-full border-2 border-gray-200 rounded-xl p-3 bg-white focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all outline-none"
                value={selectedRestroom2}
                onChange={(e) => setSelectedRestroom2(e.target.value)}
              >
                {availableRestrooms.map((restroom) => (
                  <option key={restroom.id} value={restroom.name}>
                    {restroom.name}
                  </option>
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
                    ? "bg-red-50 border-red-300 shadow-md"
                    : "bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 shadow-sm hover:shadow-md"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-lg text-gray-800">
                    {restroom.name}
                  </h3>
                  <span className="text-2xl">
                    {hasActiveIncident(restroom.name) ? "🚨" : "✅"}
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="text-gray-600 font-medium">
                      Last checked:
                    </span>
                    {lastCheckTimes[restroom.name] ? (
                      <>
                        <p className="text-gray-800 font-semibold mt-1">
                          {lastCheckTimes[restroom.name].toLocaleDateString()}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {lastCheckTimes[restroom.name].toLocaleTimeString()}
                          {lastCheckBy[restroom.name] &&
                            ` by ${lastCheckBy[restroom.name]}`}
                        </p>
                      </>
                    ) : (
                      <p className="text-gray-800 font-semibold mt-1">Never</p>
                    )}
                  </div>
                  <div
                    className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                      hasActiveIncident(restroom.name)
                        ? "bg-red-200 text-red-800"
                        : "bg-green-200 text-green-800"
                    }`}
                  >
                    {hasActiveIncident(restroom.name)
                      ? "⚠️ Active Incident"
                      : "✓ All Clear"}
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
                        <h3 className="font-bold text-xl text-gray-800">
                          {incident.restroom}
                        </h3>
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
                            Last checked:{" "}
                            {new Date(
                              incident.lastCheckedAt,
                            ).toLocaleDateString()}
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
              <p className="text-xl font-semibold text-gray-700">
                No pending incidents
              </p>
              <p className="text-gray-500 mt-2">All restrooms are clear!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
