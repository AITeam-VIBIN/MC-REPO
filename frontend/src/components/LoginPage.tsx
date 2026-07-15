import React, { useState } from "react";
import { KeyRound, Mail, ShieldAlert, ArrowRight, Sparkles, LogIn, Laptop, FileDigit } from "lucide-react";
import { User, UserRole } from "../types";

interface LoginPageProps {
  onSuccess: (user: User, token: string) => void;
  mfaDefaultSetting: boolean;
}

export default function LoginPage({ onSuccess, mfaDefaultSetting }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quick Account Select list matching specs
  const demoAccounts = [
    { name: "Sarah Jenkins", email: "super1@bitcoin-credentials.org", role: "super-admin", label: "Super Admin [Full Access]" },
    { name: "Michael Chang", email: "admin1@bitcoin-credentials.org", role: "admin", label: "Admin [Approvals & Logs]" },
    { name: "Robert Downey", email: "user1@bitcoin-credentials.org", role: "user", label: "Standard Employee" },
    { name: "Satoshi Nakamoto", email: "dev1@bitcoin-credentials.org", role: "developer", label: "Developer [API & Backup]" },
  ];

  const handleQuickChoose = (account: typeof demoAccounts[0]) => {
    setEmail(account.email);
    setPassword("password123");
    setError(null);
  };

  const handleInitialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Please key in your organizational email address.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to match user records.");
      }

      onSuccess(data.user, data.token);
    } catch (err: any) {
      setError(err.message || "Network Error accessing BCD-FSS Node.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="login-container" className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      {/* Dynamic Background Accents */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,rgba(249,115,22,0.08),transparent_50%),radial-gradient(ellipse_at_bottom_left,rgba(59,130,246,0.08),transparent_50%)] pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative">
        <div className="flex justify-center items-center gap-3">
          <div className="bg-gradient-to-tr from-amber-500 to-orange-600 p-2.5 rounded-xl shadow-[0_0_20px_rgba(245,158,11,0.2)]">
            <FileDigit className="w-8 h-8 text-white stroke-[1.5]" />
          </div>
          <span className="text-2xl font-bold font-display tracking-tight text-white">
            BCD-FSS <span className="text-amber-500 font-extrabold font-serif">₿</span>
          </span>
        </div>
        <h2 className="mt-6 text-center text-3xl font-display font-bold tracking-tight text-white">
          Secure Core Repository
        </h2>
        <p className="mt-2 text-center text-sm text-slate-400">
          Bitcoin Credential Digital File Storage System
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative">
        <div className="bg-slate-800/80 backdrop-blur-md py-8 px-4 shadow-xl border border-slate-700/50 rounded-2xl sm:px-10">
          
          {error && (
            <div className="mb-4 bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3 rounded-xl text-xs flex items-center gap-2.5">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleInitialSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Organizational Work Email
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-slate-500" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="name@bitcoin-credentials.org"
                  className="block w-full pl-10 pr-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Access Key Passcode
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <KeyRound className="h-4 w-4 text-slate-500" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••••••"
                  className="block w-full pl-10 pr-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-xl text-sm font-semibold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-orange-500 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 transition-all cursor-pointer font-display shadow-lg shadow-amber-500/10"
              >
                {loading ? "Decrypting Session..." : "Authorize Access"}
                {!loading && <ArrowRight className="ml-2 w-4 h-4" />}
              </button>
            </div>
          </form>

          {/* QUICK CHOOSE PANEL FOR PREVIEWING */}
          <div className="mt-8 pt-6 border-t border-slate-700/50">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-3.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Organizational Role Bypass
            </h3>
            <div className="grid grid-cols-1 gap-2">
              {demoAccounts.map((acct) => (
                <button
                  key={acct.email}
                  type="button"
                  onClick={() => handleQuickChoose(acct)}
                  className={`w-full text-left p-2.5 bg-slate-900/60 hover:bg-slate-900 hover:border-slate-600 rounded-xl border text-xs transition-all flex items-center justify-between ${
                    email === acct.email ? "border-amber-500 bg-slate-900" : "border-slate-800"
                  }`}
                >
                  <div>
                    <p className="font-semibold text-slate-200">{acct.name}</p>
                    <p className="text-[10px] text-slate-500 font-mono">{acct.email}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                    acct.role === "super-admin" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                    acct.role === "admin" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" :
                    acct.role === "developer" ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" :
                    "bg-slate-500/10 text-slate-400 border border-slate-800"
                  }`}>
                    {acct.role}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-3.5 text-[10px] text-slate-600 text-center flex items-center justify-center gap-1">
              <Laptop className="w-3 h-3" /> Audit log will trace your physical coordinates automatically.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
