import React, { useState, useEffect } from "react";
import { 
  FileSignature, CheckCircle2, History, ShieldAlert, BadgeInfo, Undo2 
} from "lucide-react";
import { Document, Checkout, User } from "../types";
import SignatureCanvas from "./SignatureCanvas";

interface CheckoutReturnProps {
  documents: Document[];
  checkouts: Checkout[];
  currentUser: User;
  onRefresh: () => void;
  selectedDocForCheckout: Document | null;
  onClearSelectedDoc: () => void;
  onNavigate: (tab: string) => void;
}

export default function CheckoutReturn({
  documents,
  checkouts,
  currentUser,
  onRefresh,
  selectedDocForCheckout,
  onClearSelectedDoc,
  onNavigate
}: CheckoutReturnProps) {
  
  // Checkout form state
  const [docId, setDocId] = useState("");
  const [docName, setDocName] = useState("");
  const [docDbId, setDocDbId] = useState("");
  
  // User Form fields
  const [empName, setEmpName] = useState(currentUser.name);
  const [empId, setEmpId] = useState("");
  const [empDesignation, setEmpDesignation] = useState("");
  
  // Checkout details
  const [destination, setDestination] = useState("");
  const [purpose, setPurpose] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [authority, setAuthority] = useState("");
  
  // Checkout signature
  const [signatureData, setSignatureData] = useState("");
  const [signatureType, setSignatureType] = useState<'drawn' | 'uploaded' | 'typed'>('drawn');

  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);

  // Return Document state
  const [activeReturnCheckout, setActiveReturnCheckout] = useState<Checkout | null>(null);
  const [returnCondition, setReturnCondition] = useState<'Perfect' | 'Good' | 'Damaged' | 'Missing Pages' | 'Digital Copy Only'>("Perfect");
  const [returnNotes, setReturnNotes] = useState("");
  const [returningEmployeeSig, setReturningEmployeeSig] = useState("");
  const [returnSuccess, setReturnSuccess] = useState(false);
  const [returnError, setReturnError] = useState("");

  // Sync selected document from repository triggering
  useEffect(() => {
    if (selectedDocForCheckout) {
      setDocDbId(selectedDocForCheckout.id);
      setDocId(selectedDocForCheckout.documentId);
      setDocName(selectedDocForCheckout.documentName);
    } else {
      // Pick first available doc that is not already checked out or pending as default
      const available = documents.find(d => d.status === "Available");
      if (available) {
        setDocDbId(available.id);
        setDocId(available.documentId);
        setDocName(available.documentName);
      }
    }
  }, [selectedDocForCheckout, documents]);

  const handleDocChange = (dbId: string) => {
    const matched = documents.find(d => d.id === dbId);
    if (matched) {
      setDocDbId(matched.id);
      setDocId(matched.documentId);
      setDocName(matched.documentName);
    }
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckoutError("");
    setCheckoutSuccess(false);

    if (!docDbId || !empId || !empName || !destination || !returnDate || !purpose) {
      setCheckoutError("Please fill in all mandatory fields before logging checkout.");
      return;
    }

    if (!signatureData) {
      setCheckoutError("Security Lock: Digital verification signature is mandatory. Please draw or type signature below.");
      return;
    }

    // Direct checkout log (Immediate checkout for all roles)
    try {
      const response = await fetch("/api/checkouts", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Operator-Name": currentUser.name,
          "X-Operator-Role": currentUser.role
        },
        body: JSON.stringify({
          documentDbId: docDbId,
          employeeName: empName,
          employeeId: empId,
          designation: empDesignation,
          destination,
          purpose,
          expectedReturnDate: returnDate,
          approvalAuthority: authority || "Direct Checkout Log",
          signature: signatureData,
          signatureType
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Registration of checkout record rejected.");

      setCheckoutSuccess(true);
      // Reset details and form inputs
      setDestination(""); setPurpose(""); setReturnDate(""); setSignatureData("");
      setEmpId(""); setEmpDesignation(""); setAuthority("");
      onClearSelectedDoc();
      onRefresh();
    } catch (err: any) {
      setCheckoutError(err.message || "Connection failure.");
    }
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReturnError("");
    setReturnSuccess(false);

    if (!activeReturnCheckout) {
      setReturnError("Please select a checked-out document log target from the drop-down.");
      return;
    }

    if (!returningEmployeeSig) {
      setReturnError("Audit block: A digital signature from the returning employee is mandatory!");
      return;
    }

    try {
      const response = await fetch(`/api/checkouts/${activeReturnCheckout.id}/return`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Operator-Name": currentUser.name,
          "X-Operator-Role": currentUser.role
        },
        body: JSON.stringify({
          condition: returnCondition,
          notes: returnNotes,
          returningEmployeeSignature: returningEmployeeSig,
          returningEmployeeName: activeReturnCheckout.employeeName
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Verification of returned artifact failed.");

      setReturnSuccess(true);
      setReturnNotes("");
      setReturningEmployeeSig("");
      setReturnCondition("Perfect");
      setActiveReturnCheckout(null);
      onRefresh();
    } catch (err: any) {
      setReturnError(err.message || "Network return validation failure.");
    }
  };

  const activeCheckouts = checkouts.filter(c => c.status === "Checked Out");

  return (
    <div id="checkout-returns-panel" className="grid grid-cols-1 lg:grid-cols-12 gap-6 leading-relaxed font-sans">
      
      {/* LEFT FORM MODULE: CHECK OUT LOG ENTRY (7 COLUMNS) */}
      <div className="lg:col-span-7 bg-white p-5 border border-slate-200 rounded-2xl shadow-sm space-y-4">
        <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
          <div>
            <h2 className="text-base font-bold font-display text-slate-900 flex items-center gap-1.5">
              <FileSignature className="text-amber-500 w-5 h-5 stroke-[1.5]" /> Secure Repository Checkout Log
            </h2>
            <p className="text-xs text-slate-500">Record offsite document travel paths securely</p>
          </div>
          
          {selectedDocForCheckout && (
            <button
              onClick={onClearSelectedDoc}
              className="px-2.5 py-1 bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-600 rounded-lg text-[10px] uppercase font-bold tracking-wider flex items-center gap-1 transition-all cursor-pointer"
            >
              <Undo2 className="w-3 h-3" /> Clear Select
            </button>
          )}
        </div>

        {checkoutSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3.5 rounded-xl flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <p className="font-semibold">Checkout Log cataloged successfully.</p>
              <p className="text-[11px] text-emerald-600">The document state has been locked as Checked Out in the repository.</p>
            </div>
          </div>
        )}

        {checkoutError && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3.5 rounded-xl flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{checkoutError}</span>
          </div>
        )}

        <form onSubmit={handleCheckoutSubmit} className="space-y-4">
          
          {/* SECTION A: Vault Document Select */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest flex items-center gap-1">
              <span className="text-amber-500 font-serif">₿</span> A. Vault Document Select
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1">Target Document *</label>
                <select
                  id="checkout-doc-select"
                  value={docDbId}
                  onChange={(e) => handleDocChange(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                >
                  <option value="" disabled>Select Document...</option>
                  {documents.map(d => (
                    <option 
                      key={d.id} 
                      value={d.id}
                      disabled={d.status === "Checked Out"}
                    >
                      {d.documentId} - {d.documentName.substring(0, 45)}... {d.status === "Checked Out" ? "[OUT]" : ""}
                    </option>
                  ))}
                </select>
                {selectedDocForCheckout && (
                  <p className="text-[10px] text-amber-600 font-bold mt-1">✓ Pin-locked from Repository explorer.</p>
                )}
              </div>
              
              <div className="grid grid-cols-1 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-mono">Document ID</span>
                  <span className="font-mono font-bold text-slate-900 block truncate">{docId || "Unselected"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION B: LOGGING EMPLOYEE CREDENTIALS */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest">B. Employee Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1">Employee Name *</label>
                <input
                  type="text"
                  value={empName}
                  onChange={(e) => setEmpName(e.target.value)}
                  required
                  placeholder="e.g., Sarah Jenkins"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1">Employee ID *</label>
                <input
                  type="text"
                  value={empId}
                  onChange={(e) => setEmpId(e.target.value)}
                  required
                  placeholder="e.g., EMP-2026-001"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1">Designation</label>
                <input
                  type="text"
                  value={empDesignation}
                  onChange={(e) => setEmpDesignation(e.target.value)}
                  placeholder="e.g., Operations Lead"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                />
              </div>
            </div>
          </div>

          {/* SECTION C: LOGISTICS PATH & REMOVAL PURPOSE */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest">C. Out-of-Office Travel Coordinates</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1">Target Travel Destination *</label>
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  required
                  placeholder="e.g., Central SEC Meeting Room/Branch Office 2"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1">Expected Return Date *</label>
                <input
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1">Approving Security Authority</label>
                <input
                  type="text"
                  value={authority}
                  onChange={(e) => setAuthority(e.target.value)}
                  placeholder="e.g., SEC-OFFICER-JENKINS"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1">Removal Purpose Statement *</label>
                <textarea
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  required
                  rows={2}
                  placeholder="Must record detailed purpose justification..."
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                />
              </div>
            </div>
          </div>

          {/* SECTION D: DIGITAL SIGNATURE FOR AUTHENTICATION */}
          <div className="space-y-2">
            <SignatureCanvas 
              onSave={(data, type) => {
                setSignatureData(data);
                setSignatureType(type);
              }} 
            />
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <button
              type="submit"
              className="px-5 py-2.5 bg-slate-900 border border-transparent rounded-xl text-xs font-semibold text-white hover:bg-slate-800 transition-all cursor-pointer shadow-sm ml-auto"
            >
              Sign & Register Document Checkout
            </button>
          </div>
        </form>
      </div>

      {/* RIGHT COLUMN: SECURE CHECK-IN / RETURN PORTAL (5 COLUMNS) */}
      <div className="lg:col-span-5 space-y-4">
        <div className="bg-slate-900 text-white p-5 border border-slate-800 rounded-2xl shadow-sm space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold font-display flex items-center gap-1.5 text-slate-100">
              <History className="text-emerald-400 w-5 h-5 stroke-[1.5]" /> Secure Document Check-In / Return
            </h2>
            <p className="text-xs text-slate-400">Process returned physical documents back inside vaults</p>
          </div>

          {returnSuccess && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-3.5 rounded-xl text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <p className="font-semibold">Document return logged & verified.</p>
                <p className="text-[10px] mt-0.5 text-slate-400">Lock restored. Index state updated back to Approved.</p>
              </div>
            </div>
          )}

          {returnError && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3 rounded-xl text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{returnError}</span>
            </div>
          )}

          <form onSubmit={handleReturnSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Select Checked-Out Log *</label>
              <select
                id="return-select-checkout"
                value={activeReturnCheckout?.id || ""}
                onChange={(e) => {
                  const matched = activeCheckouts.find(c => c.id === e.target.value);
                  if (matched) setActiveReturnCheckout(matched);
                }}
                className="w-full px-2.5 py-2.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="">Choose active checkout file...</option>
                {activeCheckouts.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.documentId} - {c.employeeName} ({c.destination.substring(0, 20)}...)
                  </option>
                ))}
              </select>

              {activeReturnCheckout && (
                <div className="mt-2 text-[11px] bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5 font-mono text-slate-400">
                  <p className="text-slate-200 font-bold mb-1 uppercase text-xs">Checkout Tracking</p>
                  <p>• Employee: <b className="text-white">{activeReturnCheckout.employeeName} ({activeReturnCheckout.employeeId})</b></p>
                  <p>• Out Since: <span className="text-amber-400">{new Date(activeReturnCheckout.checkoutDate).toLocaleDateString()}</span></p>
                  <p>• Expected Return: <span className="text-indigo-400 font-bold">{activeReturnCheckout.expectedReturnDate}</span></p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">State Condition of Document *</label>
              <select
                value={returnCondition}
                onChange={(e) => setReturnCondition(e.target.value as any)}
                className="w-full px-2.5 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white"
              >
                <option value="Perfect">Perfect / Pristine state</option>
                <option value="Good">Good / Standard Office Wear</option>
                <option value="Damaged">Damaged / Needs repair (Audit required)</option>
                <option value="Missing Pages">Missing Pages (Security alert!)</option>
                <option value="Digital Copy Only">Returned as Digital Scan Copy</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Verification Notes</label>
              <textarea
                value={returnNotes}
                onChange={(e) => setReturnNotes(e.target.value)}
                rows={2}
                placeholder="Notes regarding dual return check..."
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none"
              />
            </div>

            {/* EMPLOYEE SECURITY SIGNATURE REQUIREMENT */}
            <div className="border-t border-slate-800 pt-3.5 space-y-4">
              <h4 className="text-xs font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-1">
                <BadgeInfo className="w-4 h-4 text-emerald-500" /> Returning Employee Signature Required
              </h4>

              {/* Returning Employee Signature */}
              <div className="space-y-1.5">
                <span className="block text-[10px] font-semibold text-slate-400 uppercase">Employee Sign *</span>
                <SignatureCanvas 
                  onSave={(data, type) => {
                    setReturningEmployeeSig(data);
                  }} 
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={!activeReturnCheckout}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 rounded-xl text-xs font-semibold text-white transition-all cursor-pointer shadow-md"
              >
                Validate Employee Return Check
              </button>
            </div>
          </form>
        </div>
      </div>

    </div>
  );
}
