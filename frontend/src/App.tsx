import React, { useState, useEffect } from "react";
import { io } from "socket.io-client";
import {
  FileText, ShieldAlert, LogOut, LayoutDashboard, FolderOpen,
  RefreshCw, ClipboardCheck, History, Sliders, Database, FileBarChart, Bell, FileDigit
} from "lucide-react";
import { User, Document, Checkout, Notification, SecurityPolicy, ReturnRecord } from "./types";
import LoginPage from "./components/LoginPage";
import Dashboard from "./components/Dashboard";
import RepoManager from "./components/RepoManager";
import CheckoutReturn from "./components/CheckoutReturn";
import UserManager from "./components/UserManager";
import ReportModule from "./components/ReportModule";
import BackupRestore from "./components/BackupRestore";
import NotificationCenter from "./components/NotificationCenter";

export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem("bcd_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem("bcd_token");
  });
  const [activeTab, setActiveTab] = useState<string>(() => {
    return localStorage.getItem("bcd_active_tab") || "dashboard";
  });

  useEffect(() => {
    if (activeTab) {
      localStorage.setItem("bcd_active_tab", activeTab);
    }
  }, [activeTab]);

  // Database synchronist state
  const [documents, setDocuments] = useState<Document[]>([]);
  const [checkouts, setCheckouts] = useState<Checkout[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [policies, setPolicies] = useState<SecurityPolicy | null>(null);

  // Cross tab selectors state
  const [selectedDocForCheckout, setSelectedDocForCheckout] = useState<Document | null>(null);

  // Interval synchronization flag
  const [syncing, setSyncing] = useState(false);

  // Fetch full dataset core
  const fetchAllData = async () => {
    if (!token) return;
    setSyncing(true);
    try {
      const headers = {
        "Authorization": `Bearer ${token}`,
        "X-Operator-Name": user?.name || "System",
        "X-Operator-Role": user?.role || "user"
      };

      const [docsRes, checksRes, usersRes, retRes, notRes, polRes] = await Promise.all([
        fetch("/api/documents", { headers }),
        fetch("/api/checkouts", { headers }),
        fetch("/api/users", { headers }),
        fetch("/api/returns", { headers }),
        fetch("/api/notifications", { headers }),
        fetch("/api/policies", { headers })
      ]);

      const [docs, checks, userItems, returnItems, notifyItems, policyData] = await Promise.all([
        docsRes.json(),
        checksRes.json(),
        usersRes.json(),
        retRes.json(),
        notRes.json(),
        polRes.json()
      ]);

      if (docsRes.ok) setDocuments(docs);
      if (checksRes.ok) setCheckouts(checks);
      if (usersRes.ok) setUsers(userItems);
      if (retRes.ok) setReturns(returnItems);
      if (notRes.ok) setNotifications(notifyItems);
      if (polRes.ok) setPolicies(policyData);

    } catch (error) {
      console.error("Error synchronization indices:", error);
    } finally {
      setSyncing(false);
    }
  };

  // Sync data on startup + tab switch + poller
  useEffect(() => {
    if (token) {
      fetchAllData();
      // Setup live poller to mimic websockets real-time ticker
      const poller = setInterval(fetchAllData, 8000);

      // Connect to Socket.IO Server
      const socket = io(window.location.origin || "http://localhost:5000", {
        auth: { token }
      });

      socket.on("connect", () => {
        console.log("Socket.IO connected to BCD-FSS Node");
      });

      socket.on("notification:new", (newNot: Notification) => {
        // Prepend new notification to state
        setNotifications(prev => [newNot, ...prev]);
        // Also sync all details since checkouts/documents statuses changed!
        fetchAllData();
      });

      return () => {
        clearInterval(poller);
        socket.disconnect();
      };
    }
  }, [token]);

  const handleLoginSuccess = (authenticatedUser: User, authenticatedToken: string) => {
    setUser(authenticatedUser);
    setToken(authenticatedToken);
    localStorage.setItem("bcd_user", JSON.stringify(authenticatedUser));
    localStorage.setItem("bcd_token", authenticatedToken);
    setActiveTab("dashboard");
  };

  const handleLogout = async () => {
    if (!window.confirm("Verify: Are you sure you want to sign out of BCD-FSS Secure Vault?")) return;
    setUser(null);
    setToken(null);
    localStorage.removeItem("bcd_user");
    localStorage.removeItem("bcd_token");
    localStorage.removeItem("bcd_active_tab");
  };

  const notifyMarkRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "PUT" });
      fetchAllData();
    } catch (e) {
      console.error(e);
    }
  };

  const notifyClearAll = async () => {
    try {
      await fetch("/api/notifications/clear-all", { method: "POST" });
      fetchAllData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectDocForCheckout = (doc: Document) => {
    setSelectedDocForCheckout(doc);
    setActiveTab("checkouts");
  };

  // If unauthenticated, redirect direct to secure login screen
  if (!user || !token) {
    return (
      <LoginPage
        onSuccess={handleLoginSuccess}
        mfaDefaultSetting={policies?.requireMfa || true}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800 antialiased selection:bg-amber-500/20">

      {/* GLOBAL ENTERPRISE TOP HEADER BAR */}
      <header className="bg-slate-900 text-white shadow-xl px-4 sm:px-6 lg:px-8 border-b border-slate-800 shrink-0 select-none">
        <div className="max-w-7xl mx-auto flex justify-between h-16 items-center">

          {/* LOGO AREA */}
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-amber-500 to-amber-600 p-1.5 rounded-lg shadow-md shrink-0">
              <FileDigit className="w-5.5 h-5.5 text-white stroke-[1.5]" />
            </div>
            <div>
              <span className="font-bold text-lg font-display tracking-tight text-white flex items-center gap-1 leading-none">
                BCD-FSS <span className="text-amber-500 font-serif font-extrabold">₿</span>
              </span>
              <p className="text-[9px] text-slate-400 font-semibold tracking-wider uppercase">Secure Credential Digital Storage</p>
            </div>
          </div>

          {/* PRIVILEGED USER INFO PROFILE & NOTIFICATIONS & LOGOUT */}
          <div className="flex items-center gap-4 text-xs font-medium">

            {/* Real-time sync ticker */}
            <button
              onClick={fetchAllData}
              disabled={syncing}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 hidden sm:flex items-center gap-1 transition-all"
              title="Manual refresh server indexes"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin text-amber-400" : ""}`} />
            </button>

            {/* Notification drop-down center component */}
            <NotificationCenter
              notifications={notifications}
              onMarkRead={notifyMarkRead}
              onClearAll={notifyClearAll}
            />

            {/* User session Profile Box */}
            <div className="hidden md:flex flex-col items-end border-l border-slate-800 pl-4 h-9 justify-center">
              <span className="text-slate-100 font-bold leading-tight">{user.name}</span>
              <span className={`text-[9px] uppercase font-bold text-right px-1.5 py-0.2 rounded mt-0.5 ${user.role === "super-admin" ? "bg-amber-500 text-slate-950" :
                  user.role === "admin" ? "bg-blue-600/10 text-blue-400" :
                    user.role === "developer" ? "bg-purple-600/10 text-purple-400" :
                      "bg-slate-700 text-slate-300"
                }`}>
                {user.role === "super-admin" ? "🔑 Super Admin Override" : user.role}
              </span>
            </div>

            {/* Force Sign-Out */}
            <button
              onClick={handleLogout}
              className="px-3 py-2 bg-slate-800 hover:bg-rose-950 hover:text-rose-200 border border-slate-700/50 hover:border-rose-900 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-slate-400"
              title="Terminate Secure Session"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Terminate Session</span>
            </button>

          </div>
        </div>
      </header>

      {/* CORE NAVIGATION SLIDER BAR */}
      <nav className="bg-white border-b border-slate-200 shadow-xs px-4 sm:px-6 select-none shrink-0 overflow-x-auto">
        <div className="max-w-7xl mx-auto flex gap-1.5 h-12 items-center text-xs font-semibold uppercase scrollbar-none">

          <button
            onClick={() => setActiveTab("dashboard")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${activeTab === "dashboard" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              }`}
          >
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            <span>Core Dashboard</span>
          </button>

          <button
            onClick={() => setActiveTab("repo")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${activeTab === "repo" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              }`}
          >
            <FolderOpen className="w-4 h-4 shrink-0" />
            <span>Vault Repository</span>
          </button>

          <button
            onClick={() => setActiveTab("checkouts")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${activeTab === "checkouts" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              }`}
          >
            <History className="w-4 h-4 shrink-0" />
            <span>Checkouts & Returns</span>
          </button>



          <button
            onClick={() => setActiveTab("users")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${activeTab === "users" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              }`}
          >
            <Sliders className="w-4 h-4 shrink-0" />
            <span>Roles & Security custom</span>
          </button>

          <button
            onClick={() => setActiveTab("reports")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${activeTab === "reports" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              }`}
          >
            <FileBarChart className="w-4 h-4 shrink-0" />
            <span>Compliance Reports</span>
          </button>

          {(user.role === "developer" || user.role === "super-admin") && (
            <button
              onClick={() => setActiveTab("recovery")}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${activeTab === "recovery" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                }`}
            >
              <Database className="w-4 h-4 shrink-0" />
              <span>Recovery panel DB</span>
            </button>
          )}

        </div>
      </nav>

      {/* CORE WORKSPACE INNER CONTENT MOUNT */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 overflow-y-auto">

        {activeTab === "dashboard" && (
          <Dashboard
            documents={documents}
            checkouts={checkouts}
            users={users}
            onNavigate={setActiveTab}
          />
        )}

        {activeTab === "repo" && (
          <RepoManager
            documents={documents}
            currentUser={user}
            onRefresh={fetchAllData}
            onSelectForCheckout={handleSelectDocForCheckout}
          />
        )}

        {activeTab === "checkouts" && (
          <CheckoutReturn
            documents={documents}
            checkouts={checkouts}
            currentUser={user}
            onRefresh={fetchAllData}
            selectedDocForCheckout={selectedDocForCheckout}
            onClearSelectedDoc={() => setSelectedDocForCheckout(null)}
            onNavigate={setActiveTab}
          />
        )}



        {activeTab === "users" && (
          <UserManager
            users={users}
            currentUser={user}
            onRefresh={fetchAllData}
            policies={policies || {
              passwordMinLength: 8,
              requireMfa: true,
              sessionTimeoutMinutes: 30,
              allowedUploadFormats: ["pdf", "docx"],
              autoRejectExpiredCheckouts: false,
              maxCheckoutDurationDays: 30
            }}
            onRefreshPolicies={fetchAllData}
          />
        )}

        {activeTab === "reports" && (
          <ReportModule
            documents={documents}
            checkouts={checkouts}
            users={users}
            returns={returns}
          />
        )}

        {activeTab === "recovery" && (
          <BackupRestore
            currentUser={user}
            onRefreshAll={fetchAllData}
          />
        )}

      </main>

      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-200 py-3 text-center text-[10px] text-slate-400 select-none shrink-0 font-mono">
        © 2026 Bitcoin Credential Digital File Storage System (BCD-FSS). Secure Node Status: Active & Official
      </footer>

    </div>
  );
}
