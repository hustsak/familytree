"use client";

import React, { useState, useEffect, use, Suspense } from "react";
import Link from "next/link";
import { Navigation } from "@/components/Navigation";
import { useLanguage } from "@/lib/i18n/context";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertTriangle,
  Clock,
  History,
  Users2,
  Calendar,
  X,
  Send,
  TreePine,
} from "lucide-react";

interface ProposedPersonData {
  firstName?: string;
  lastName?: string;
  khmerName?: string | null;
  gender?: string;
  birthYear?: number | null;
  photoUrl?: string | null;
  biography?: string | null;
  duplicateWarning?: string;
  issue?: string;
}

interface ConnectionRequestItem {
  id: string;
  spaceId: string;
  userId: string;
  proposedPersonData: ProposedPersonData;
  anchorPersonId: string;
  relationType: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CLARIFICATION_NEEDED";
  adminNotes?: string | null;
  createdAt: string;
  user: {
    id: string;
    fullName: string;
    email: string;
  };
  reviewedBy?: {
    id: string;
    fullName: string;
  } | null;
}

interface AuditLogItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  actor: {
    id: string;
    fullName: string;
    email: string;
  };
  metadata?: Record<string, unknown> | null;
}

function AdminDashboardContent({ spaceId }: { spaceId: string }) {
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState<"requests" | "audit">("requests");
  const [statusFilter, setStatusFilter] = useState<string>("PENDING");
  const [requests, setRequests] = useState<ConnectionRequestItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Review Modal State
  const [selectedRequest, setSelectedRequest] = useState<ConnectionRequestItem | null>(null);
  const [reviewDecision, setReviewDecision] = useState<"APPROVE" | "REJECT" | "REQUEST_CLARIFICATION">("APPROVE");
  const [reviewNotes, setReviewNotes] = useState("");
  const [resolutionAction, setResolutionAction] = useState<"CREATE_NEW_PERSON" | "LINK_EXISTING_PERSON">("CREATE_NEW_PERSON");
  const [existingPersonIdToLink, setExistingPersonIdToLink] = useState("");
  const [explicitParentId, setExplicitParentId] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Load Requests
  useEffect(() => {
    async function loadRequests() {
      setLoading(true);
      setErrorMsg(null);
      try {
        const query = statusFilter && statusFilter !== "ALL" ? `?status=${statusFilter}` : "";
        const res = await fetch(`/api/spaces/${spaceId}/requests${query}`);
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to load requests");
        }
        const data = await res.json();
        setRequests(data.requests || []);
      } catch (err: unknown) {
        const e = err as Error;
        setErrorMsg(e.message || "Failed to load connection requests");
      } finally {
        setLoading(false);
      }
    }

    if (activeTab === "requests") {
      loadRequests();
    }
  }, [spaceId, statusFilter, activeTab]);

  // Load Audit Logs
  useEffect(() => {
    async function loadAuditLogs() {
      if (activeTab !== "audit") return;
      setLoading(true);
      try {
        const res = await fetch(`/api/spaces/${spaceId}/audit-logs`);
        if (res.ok) {
          const data = await res.json();
          setAuditLogs(data.auditLogs || []);
        }
      } catch (err) {
        console.error("Audit log error", err);
      } finally {
        setLoading(false);
      }
    }

    loadAuditLogs();
  }, [spaceId, activeTab]);

  const handleOpenReview = (request: ConnectionRequestItem) => {
    setSelectedRequest(request);
    setReviewDecision("APPROVE");
    setReviewNotes("");
    setResolutionAction("CREATE_NEW_PERSON");
    setExistingPersonIdToLink("");
    setExplicitParentId("");
    setReviewError(null);
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;

    setSubmittingReview(true);
    setReviewError(null);

    try {
      const res = await fetch(
        `/api/spaces/${spaceId}/requests/${selectedRequest.id}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision: reviewDecision,
            adminNotes: reviewNotes.trim() || undefined,
            resolutionAction: reviewDecision === "APPROVE" ? resolutionAction : undefined,
            existingPersonIdToLink:
              reviewDecision === "APPROVE" && resolutionAction === "LINK_EXISTING_PERSON"
                ? existingPersonIdToLink.trim()
                : undefined,
            explicitParentId:
              reviewDecision === "APPROVE" && explicitParentId.trim()
                ? explicitParentId.trim()
                : undefined,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to process review");
      }

      // Update local request state
      setRequests((prev) =>
        prev.map((r) =>
          r.id === selectedRequest.id
            ? {
                ...r,
                status:
                  reviewDecision === "APPROVE"
                    ? "APPROVED"
                    : reviewDecision === "REJECT"
                    ? "REJECTED"
                    : "CLARIFICATION_NEEDED",
                adminNotes: reviewNotes.trim() || r.adminNotes,
              }
            : r
        )
      );

      setSelectedRequest(null);
    } catch (err: unknown) {
      const e = err as Error;
      setReviewError(e.message || "An error occurred while submitting decision");
    } finally {
      setSubmittingReview(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Approved
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
            <XCircle className="w-3.5 h-3.5 text-rose-400" />
            Rejected
          </span>
        );
      case "CLARIFICATION_NEEDED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
            Clarification Needed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            Pending Review
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#0c0f14] heritage-bg-pattern flex flex-col">
      <Navigation activeSpaceId={spaceId} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-8 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#d4af37] mb-2">
              <ShieldCheck className="w-4 h-4" />
              <span>Lineage Council</span>
            </div>
            <h1 className="text-3xl font-bold font-heritage tracking-tight text-white mb-1">
              {t.adminDashboard.title}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
              {t.adminDashboard.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={`/spaces/${spaceId}/tree`}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-950 bg-[#d4af37] hover:bg-[#e5c158] transition-all flex items-center gap-1.5 shadow-sm shadow-[#d4af37]/20"
            >
              <TreePine className="w-3.5 h-3.5" />
              <span>{t.nav.tree}</span>
            </Link>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-2 mt-8 mb-6 border-b border-slate-800 pb-3">
          <button
            type="button"
            onClick={() => setActiveTab("requests")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === "requests"
                ? "bg-[#d4af37]/15 text-[#d4af37] border border-[#d4af37]/30 shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Users2 className="w-4 h-4" />
            <span>{t.adminDashboard.tabRequests}</span>
            {requests.filter((r) => r.status === "PENDING").length > 0 && (
              <span className="w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] flex items-center justify-center font-bold">
                {requests.filter((r) => r.status === "PENDING").length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("audit")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === "audit"
                ? "bg-[#d4af37]/15 text-[#d4af37] border border-[#d4af37]/30 shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <History className="w-4 h-4" />
            <span>{t.adminDashboard.tabAudit}</span>
          </button>
        </div>

        {/* Tab 1: Connection Requests */}
        {activeTab === "requests" && (
          <div>
            {/* Filter pills */}
            <div className="flex flex-wrap items-center gap-2 mb-6 text-xs">
              {[
                { label: t.adminDashboard.statusFilterPending, value: "PENDING" },
                { label: t.adminDashboard.statusFilterClarification, value: "CLARIFICATION_NEEDED" },
                { label: t.adminDashboard.statusFilterApproved, value: "APPROVED" },
                { label: t.adminDashboard.statusFilterRejected, value: "REJECTED" },
                { label: t.adminDashboard.statusFilterAll, value: "ALL" },
              ].map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setStatusFilter(filter.value)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    statusFilter === filter.value
                      ? "bg-slate-800 text-[#d4af37] border border-[#d4af37]/40"
                      : "bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {errorMsg && (
              <div className="mb-6 p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-200 text-xs">
                {errorMsg}
              </div>
            )}

            {loading ? (
              <div className="py-24 text-center">
                <div className="w-10 h-10 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-xs text-slate-400">{t.auth.loading}</p>
              </div>
            ) : requests.length === 0 ? (
              <div className="py-20 text-center heritage-card p-8">
                <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700 text-slate-400 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-[#d4af37]" />
                </div>
                <h3 className="text-lg font-bold font-heritage text-white mb-1">
                  {t.adminDashboard.noRequestsTitle}
                </h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                  {t.adminDashboard.noRequestsDesc}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {requests.map((request) => {
                  const proposed = request.proposedPersonData;
                  const isDuplicateFlagged = !!proposed.duplicateWarning;
                  const hasIssue = !!proposed.issue;

                  return (
                    <div
                      key={request.id}
                      className="heritage-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 gold-glow-hover transition-all"
                    >
                      <div className="space-y-3 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {getStatusBadge(request.status)}
                          {isDuplicateFlagged && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-950/60 text-rose-300 border border-rose-800">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                              {t.adminDashboard.duplicateWarning}
                            </span>
                          )}
                          {hasIssue && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-950/60 text-amber-300 border border-amber-800">
                              <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                              {proposed.issue}
                            </span>
                          )}
                        </div>

                        <div>
                          <h4 className="text-lg font-bold font-heritage text-white">
                            {proposed.firstName} {proposed.lastName}{" "}
                            {proposed.khmerName && (
                              <span className="text-slate-400 font-khmer text-sm">
                                ({proposed.khmerName})
                              </span>
                            )}
                          </h4>
                          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mt-1">
                            <span>
                              Claimed: <strong className="text-slate-200">{request.relationType}</strong>
                            </span>
                            <span>&bull;</span>
                            <span>
                              Anchor ID: <code className="text-slate-300 font-mono text-[11px]">{request.anchorPersonId}</code>
                            </span>
                            {proposed.birthYear && (
                              <>
                                <span>&bull;</span>
                                <span>Born: {proposed.birthYear}</span>
                              </>
                            )}
                          </div>
                        </div>

                        {proposed.duplicateWarning && (
                          <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-900/60 text-xs text-rose-200/90 leading-relaxed">
                            {proposed.duplicateWarning}
                          </div>
                        )}

                        {request.adminNotes && (
                          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300">
                            <span className="font-semibold text-slate-400 block mb-0.5">Council Notes:</span>
                            {request.adminNotes}
                          </div>
                        )}

                        <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-3 pt-1">
                          <span>
                            {t.adminDashboard.requestedBy}: <strong className="text-slate-400">{request.user.fullName}</strong> ({request.user.email})
                          </span>
                          <span>&bull;</span>
                          <span>
                            {t.adminDashboard.submittedOn}: {new Date(request.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {request.status === "PENDING" || request.status === "CLARIFICATION_NEEDED" ? (
                          <button
                            type="button"
                            onClick={() => handleOpenReview(request)}
                            className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-950 bg-[#d4af37] hover:bg-[#e5c158] transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-[#d4af37]/20"
                          >
                            <ShieldCheck className="w-4 h-4" />
                            <span>Review Decision</span>
                          </button>
                        ) : (
                          <span className="text-xs text-slate-500 italic">
                            Reviewed by {request.reviewedBy?.fullName || "Council"}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Lineage Audit Trail */}
        {activeTab === "audit" && (
          <div className="heritage-card p-6 sm:p-8">
            <h3 className="text-lg font-bold font-heritage text-white mb-6">
              {t.adminDashboard.auditTrailTitle}
            </h3>

            {loading ? (
              <div className="py-16 text-center">
                <div className="w-8 h-8 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-xs text-slate-400">{t.auth.loading}</p>
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                No audit log entries recorded yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80">
                {auditLogs.map((log) => (
                  <div key={log.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-200">
                          {log.action}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700">
                          {log.entityType}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        By <strong className="text-slate-300">{log.actor.fullName}</strong> ({log.actor.email}) &bull; Target ID: <code className="text-slate-400 font-mono">{log.entityId}</code>
                      </p>
                    </div>
                    <span className="text-[11px] text-slate-500 shrink-0 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Review Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="heritage-card-elevated max-w-lg w-full p-6 sm:p-8 relative max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setSelectedRequest(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-[#d4af37]/10 border border-[#d4af37]/30 text-[#d4af37] flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold font-heritage text-white">
                  {t.adminDashboard.reviewModalTitle}
                </h3>
                <p className="text-[11px] text-slate-400">
                  Request ID: <code className="text-slate-300 font-mono">{selectedRequest.id}</code>
                </p>
              </div>
            </div>

            <div className="my-4 p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 space-y-1">
              <div>
                Proposed Relative: <strong className="text-slate-100">{selectedRequest.proposedPersonData.firstName} {selectedRequest.proposedPersonData.lastName}</strong>
              </div>
              <div>
                Claimed Relation: <strong className="text-[#d4af37]">{selectedRequest.relationType}</strong>
              </div>
              <div>
                Anchor Person ID: <code className="text-slate-300 font-mono">{selectedRequest.anchorPersonId}</code>
              </div>
            </div>

            {reviewError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-950/50 border border-rose-800 text-rose-200 text-xs">
                {reviewError}
              </div>
            )}

            <form onSubmit={handleSubmitReview} className="space-y-5">
              {/* Decision Choice */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">
                  {t.adminDashboard.reviewDecisionPrompt}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setReviewDecision("APPROVE")}
                    className={`p-2.5 rounded-xl text-center border text-xs font-semibold transition-all ${
                      reviewDecision === "APPROVE"
                        ? "bg-[#d4af37]/20 border-[#d4af37] text-white"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    {t.adminDashboard.approveBtn}
                  </button>

                  <button
                    type="button"
                    onClick={() => setReviewDecision("REQUEST_CLARIFICATION")}
                    className={`p-2.5 rounded-xl text-center border text-xs font-semibold transition-all ${
                      reviewDecision === "REQUEST_CLARIFICATION"
                        ? "bg-amber-500/20 border-amber-500 text-amber-300"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    {t.adminDashboard.clarifyBtn}
                  </button>

                  <button
                    type="button"
                    onClick={() => setReviewDecision("REJECT")}
                    className={`p-2.5 rounded-xl text-center border text-xs font-semibold transition-all ${
                      reviewDecision === "REJECT"
                        ? "bg-rose-500/20 border-rose-500 text-rose-300"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    {t.adminDashboard.rejectBtn}
                  </button>
                </div>
              </div>

              {/* Duplicate Resolution Options (only shown if approving) */}
              {reviewDecision === "APPROVE" && (
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <label className="block text-xs font-medium text-slate-300">
                    {t.adminDashboard.resolutionActionLabel}
                  </label>
                  <div className="space-y-2 text-xs">
                    <label className="flex items-start gap-2 cursor-pointer text-slate-300">
                      <input
                        type="radio"
                        name="resolutionAction"
                        value="CREATE_NEW_PERSON"
                        checked={resolutionAction === "CREATE_NEW_PERSON"}
                        onChange={() => setResolutionAction("CREATE_NEW_PERSON")}
                        className="mt-0.5 text-[#d4af37] focus:ring-[#d4af37]"
                      />
                      <span>{t.adminDashboard.actionCreateNew}</span>
                    </label>

                    <label className="flex items-start gap-2 cursor-pointer text-slate-300">
                      <input
                        type="radio"
                        name="resolutionAction"
                        value="LINK_EXISTING_PERSON"
                        checked={resolutionAction === "LINK_EXISTING_PERSON"}
                        onChange={() => setResolutionAction("LINK_EXISTING_PERSON")}
                        className="mt-0.5 text-[#d4af37] focus:ring-[#d4af37]"
                      />
                      <span>{t.adminDashboard.actionLinkExisting}</span>
                    </label>
                  </div>

                  {resolutionAction === "LINK_EXISTING_PERSON" && (
                    <div className="pt-2">
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Existing Person Database ID to link:
                      </label>
                      <input
                        type="text"
                        required
                        value={existingPersonIdToLink}
                        onChange={(e) => setExistingPersonIdToLink(e.target.value)}
                        placeholder="e.g. clabc1234567890..."
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 font-mono focus:outline-none focus:border-[#d4af37]"
                      />
                    </div>
                  )}

                  {resolutionAction === "CREATE_NEW_PERSON" &&
                    (selectedRequest.relationType === "GRANDPARENT" ||
                      selectedRequest.relationType === "GREAT_GRANDPARENT") && (
                      <div className="pt-2">
                        <label className="block text-[11px] text-amber-300 mb-1">
                          {t.adminDashboard.explicitParentLabel}:
                        </label>
                        <input
                          type="text"
                          required
                          value={explicitParentId}
                          onChange={(e) => setExplicitParentId(e.target.value)}
                          placeholder="e.g. person_id of direct father/mother in tree"
                          className="w-full px-3 py-2 bg-slate-950 border border-amber-600/70 rounded-lg text-xs text-slate-100 font-mono focus:outline-none focus:border-[#d4af37]"
                        />
                      </div>
                    )}
                </div>
              )}

              {/* Admin Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Council Notes / Clarification Explanation
                </label>
                <textarea
                  rows={3}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder={t.adminDashboard.adminNotesPlaceholder}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#d4af37]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedRequest(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReview}
                  className="px-5 py-2 rounded-xl text-xs font-semibold text-slate-950 bg-[#d4af37] hover:bg-[#e5c158] transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {submittingReview ? (
                    <span>{t.auth.loading}</span>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Submit Council Decision</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminParamResolver({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = use(params);
  return <AdminDashboardContent spaceId={spaceId} />;
}

export default function AdminDashboardPage({
  params,
}: {
  params: Promise<{ spaceId: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0c0f14] flex items-center justify-center">
          <div className="w-10 h-10 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <AdminParamResolver params={params} />
    </Suspense>
  );
}
