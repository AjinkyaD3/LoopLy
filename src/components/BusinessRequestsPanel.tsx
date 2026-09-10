"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  RefreshCw,
  Receipt,
  FileCheck,
  Award,
} from "lucide-react";

interface VRCustomer {
  id: string;
  name: string | null;
  mobileNumber: string;
}

interface VRMembership {
  id: string;
  currentVisits: number;
  totalVisits: number;
}

interface VisitRequest {
  id: string;
  method: "VISIT_CONFIRMATION" | "BILL";
  status: "PENDING" | "APPROVED" | "REJECTED";
  billImagePath: string | null;
  signedBillUrl?: string | null;
  rejectionReason: string | null;
  enteredName: string | null;
  createdAt: string;
  reviewedAt: string | null;
  customer: VRCustomer;
  membership: VRMembership;
  visit: { id: string; visitedAt: string } | null;
}

interface BusinessRequestsPanelProps {
  businessName: string;
  requiredVisits: number;
}

export default function BusinessRequestsPanel({
  businessName,
  requiredVisits,
}: BusinessRequestsPanelProps) {
  const router = useRouter();
  const [status, setStatus] = useState<"PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [requests, setRequests] = useState<VisitRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ id: string; type: "success" | "error"; msg: string } | null>(null);
  const [rejectReason, setRejectReason] = useState<{ [id: string]: string }>({});

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/business/requests?status=${status}`);
      const data = await res.json();
      if (res.ok) setRequests(data.requests ?? []);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  async function handleAction(requestId: string, decision: "APPROVED" | "REJECTED") {
    setActionLoading(requestId);
    setFeedback(null);

    const body: { status: string; rejectionReason?: string } = { status: decision };
    if (decision === "REJECTED" && rejectReason[requestId]?.trim()) {
      body.rejectionReason = rejectReason[requestId].trim();
    }

    try {
      const res = await fetch(`/api/business/requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        setFeedback({ id: requestId, type: "error", msg: data.error || "Failed to process request." });
      } else {
        const msg =
          decision === "APPROVED"
            ? data.rewardEarned
              ? `✅ Approved! Reward earned. Claim Code: ${data.claimCode}`
              : `✅ Approved! ${data.membershipCurrentVisits}/${requiredVisits} visits.`
            : "❌ Request rejected.";
        setFeedback({ id: requestId, type: "success", msg });
        fetchRequests();
        router.refresh();
      }
    } catch {
      setFeedback({ id: requestId, type: "error", msg: "Network error. Please try again." });
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* Filter tabs */}
      <div className="flex items-center gap-2">
        {(["PENDING", "APPROVED", "REJECTED"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              status === s
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
        <button
          type="button"
          onClick={fetchRequests}
          className="ml-auto p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-400 text-xs gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading requests…
        </div>
      ) : requests.length === 0 ? (
        <div className="py-10 text-center text-xs text-slate-400">
          No {status.toLowerCase()} requests for {businessName}.
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-xs">
              {/* Request header */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-bold text-slate-900">{r.enteredName || r.customer.name || "Unknown Customer"}</p>
                  <p className="text-[11px] text-slate-500">{r.customer.mobileNumber}</p>
                  <p className="text-[11px] text-slate-400">
                    {new Date(r.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric", month: "short", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-1.5">
                  {/* Method badge */}
                  <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center gap-1">
                    {r.method === "BILL" ? <Receipt className="w-2.5 h-2.5" /> : <FileCheck className="w-2.5 h-2.5" />}
                    {r.method === "BILL" ? "Bill Upload" : "Visit Conf."}
                  </span>
                  {/* Status badge */}
                  {r.status === "PENDING" && (
                    <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" /> Pending
                    </span>
                  )}
                  {r.status === "APPROVED" && (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-2.5 h-2.5" /> Approved
                    </span>
                  )}
                  {r.status === "REJECTED" && (
                    <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 text-[10px] font-bold flex items-center gap-1">
                      <XCircle className="w-2.5 h-2.5" /> Rejected
                    </span>
                  )}
                </div>
              </div>

              {/* Membership progress info */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                <span className="flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-indigo-500" />
                  Visits toward reward
                </span>
                <span className="font-bold text-slate-800">
                  {r.membership.currentVisits}/{requiredVisits}
                </span>
              </div>

              {/* Bill image preview link */}
              {r.billImagePath && (
                <div className="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-center justify-between gap-2">
                  <span className="truncate">📎 Bill receipt: <span className="font-mono text-slate-500">{r.billImagePath}</span></span>
                  {r.signedBillUrl && (
                    <a
                      href={r.signedBillUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 rounded bg-indigo-50 text-indigo-700 font-semibold hover:bg-indigo-100 whitespace-nowrap"
                    >
                      View Bill →
                    </a>
                  )}
                </div>
              )}

              {/* Rejection reason */}
              {r.rejectionReason && (
                <p className="text-[11px] text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-100">
                  Rejection reason: {r.rejectionReason}
                </p>
              )}

              {/* Feedback */}
              {feedback?.id === r.id && (
                <p className={`text-xs font-semibold ${feedback.type === "success" ? "text-emerald-700" : "text-rose-600"}`}>
                  {feedback.msg}
                </p>
              )}

              {/* Actions for PENDING */}
              {r.status === "PENDING" && (
                <div className="space-y-3 pt-1 border-t border-slate-100">
                  <input
                    type="text"
                    placeholder="Rejection reason (optional)"
                    value={rejectReason[r.id] ?? ""}
                    onChange={(e) => setRejectReason((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={actionLoading === r.id}
                      onClick={() => handleAction(r.id, "APPROVED")}
                      className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {actionLoading === r.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      Approve Visit
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading === r.id}
                      onClick={() => handleAction(r.id, "REJECTED")}
                      className="flex-1 py-2.5 px-3 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Reject
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
