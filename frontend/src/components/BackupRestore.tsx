import React, { useState } from "react";
import { 
  Database, RefreshCw, ArrowDownToLine, Upload, CheckCircle2, ShieldAlert, FileCode 
} from "lucide-react";
import { User, UserRole } from "../types";

interface BackupRestoreProps {
  currentUser: User;
  onRefreshAll: () => void;
}

export default function BackupRestore({ currentUser, onRefreshAll }: BackupRestoreProps) {
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const isDeveloperOrAdmin = currentUser.role === "developer" || currentUser.role === "super-admin";

  const handleBackupDownload = async () => {
    setLoading(true);
    setSuccessMsg("");
    setErrorMsg("");

    try {
      const res = await fetch("/api/backup", {
        headers: {
          "X-Operator-Name": currentUser.name,
          "X-Operator-Role": currentUser.role
        }
      });
      if (!res.ok) throw new Error("Failed to export backup stream.");
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `BCD_FSS_BACKUP_STATE_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setSuccessMsg("System indices compiled and downloaded successfully on physical machine!");
    } catch (err: any) {
      setErrorMsg(err.message || "Backup export failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleUploadBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setSuccessMsg("");
    setErrorMsg("");

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        const res = await fetch("/api/backup/restore", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Operator-Name": currentUser.name,
            "X-Operator-Role": currentUser.role
          },
          body: JSON.stringify({ backupPayload: parsed })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to commit backup rebuild.");

        setSuccessMsg("RELATIONAL STORAGE COMMUTED SUCCESSFULLY! All dynamic indicators have been restored to targeted frames.");
        onRefreshAll();
      } catch (err: any) {
        setErrorMsg(err.message || "Parsing or restore commit failed. Format code structure match required.");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div id="backup-restore-panel" className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm space-y-6 leading-relaxed font-sans max-w-2xl mx-auto">
      <div className="border-b border-slate-100 pb-3">
        <h2 className="text-base font-bold font-display text-slate-900 flex items-center gap-1.5">
          <Database className="text-indigo-600 w-5 h-5 stroke-[1.5]" /> Relational Database Recovery & Replication
        </h2>
        <p className="text-xs text-slate-500 font-medium">Export simulated PostgreSQL database states of files, audits, checkouts, and key rings on-the-fly</p>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-xl text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-xl text-xs flex items-center gap-2">
          <ShieldAlert className="w-4.5 h-4.5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {isDeveloperOrAdmin ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* BACKUP EXPORT */}
          <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/50 flex flex-col justify-between space-y-4">
            <div className="space-y-1.5 text-xs">
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest block">Stage 1</span>
              <h3 className="font-bold text-slate-900 flex items-center gap-1"><FileCode className="w-4 h-4 text-slate-400" /> Export System State Backup</h3>
              <p className="text-slate-500 leading-normal">Compiles all core database indexes (user lists, document logs, validation signatures, approvals queues, notifications, and immutable compliance audit logs) into a single, structured backup JSON payload.</p>
            </div>
            <button
              onClick={handleBackupDownload}
              disabled={loading}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <ArrowDownToLine className="w-4 h-4" /> {loading ? "Generating backup payload..." : "Download JSON database Backup"}
            </button>
          </div>

          {/* BACKUP RESTORE */}
          <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/50 flex flex-col justify-between space-y-4">
            <div className="space-y-1.5 text-xs">
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest block">Stage 2</span>
              <h3 className="font-bold text-slate-900 flex items-center gap-1"><RefreshCw className="w-4 h-4 text-slate-400" /> State Recovery Import</h3>
              <p className="text-slate-500 leading-normal">Rebuilds active system tables on demand by parsing an exported BCD-FSS database backup payload. Instantly synchronizes and matches active items, logs, and notification tickers.</p>
            </div>
            
            <label className="w-full py-2.5 bg-white border border-slate-250 hover:bg-slate-55 hover:border-slate-400 text-slate-800 font-semibold rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 border-dashed shadow-xs">
              <Upload className="w-4 h-4 text-slate-500" />
              <span>{loading ? "Parsing state files..." : "Upload Backup JSON"}</span>
              <input
                id="backup-state-uploader"
                type="file"
                accept=".json"
                onChange={handleUploadBackup}
                disabled={loading}
                className="hidden"
              />
            </label>
          </div>

        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl text-xs leading-relaxed">
          <p className="font-bold uppercase tracking-wider flex items-center gap-1">🔒 TECHNICAL DEVEL CLEARANCE OUT</p>
          <p className="mt-1">Only users possessing elevated developer or super administrator tokens are authorized to access DB recovery operations or backup replications in this workspace.</p>
        </div>
      )}
    </div>
  );
}
