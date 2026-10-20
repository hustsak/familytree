"use client";

import React, { useState, useEffect, use, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navigation } from "@/components/Navigation";
import { useLanguage } from "@/lib/i18n/context";
import {
  TreePine,
  Search,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  GitBranch,
} from "lucide-react";

interface RelativeCandidate {
  id: string;
  firstName: string;
  lastName: string;
  khmerName?: string | null;
  birthYear?: number | null;
}

function OnboardingContent({ spaceId }: { spaceId: string }) {
  const { t } = useLanguage();
  const router = useRouter();

  // Form State
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [khmerName, setKhmerName] = useState("");
  const [gender, setGender] = useState<"MALE" | "FEMALE" | "OTHER" | "UNKNOWN">("UNKNOWN");
  const [birthYear, setBirthYear] = useState<string>("");
  const [relationToAnchor, setRelationToAnchor] = useState<
    "PARENT" | "GRANDPARENT" | "GREAT_GRANDPARENT" | "FOUNDING_ROOT"
  >("PARENT");

  // Ancestor Search & Selection State
  const [searchQuery, setSearchQuery] = useState("");
  const [relatives, setRelatives] = useState<RelativeCandidate[]>([]);
  const [selectedAnchor, setSelectedAnchor] = useState<RelativeCandidate | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isEmptyTree, setIsEmptyTree] = useState(false);

  // Ambiguity / Clarification State
  const [clarificationCandidates, setClarificationCandidates] = useState<RelativeCandidate[]>([]);
  const [selectedParentBranchId, setSelectedParentBranchId] = useState<string>("");
  const [clarificationMsg, setClarificationMsg] = useState<string | null>(null);

  // Status & Submission State
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    status: string;
    message: string;
  } | null>(null);

  // Check if tree is empty and pre-load initial relatives
  useEffect(() => {
    async function checkSpaceRelatives() {
      try {
        const res = await fetch(`/api/spaces/${spaceId}/people/search?q=`);
        if (res.ok) {
          const data = await res.json();
          const list = data.relatives || [];
          setRelatives(list);
          if (list.length === 0) {
            setIsEmptyTree(true);
            setRelationToAnchor("FOUNDING_ROOT");
          }
        }
      } catch (err) {
        console.error("Failed to load relatives", err);
      }
    }

    checkSpaceRelatives();
  }, [spaceId]);

  // Live search relatives
  useEffect(() => {
    if (isEmptyTree) return;

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `/api/spaces/${spaceId}/people/search?q=${encodeURIComponent(searchQuery)}`
        );
        if (res.ok) {
          const data = await res.json();
          setRelatives(data.relatives || []);
        }
      } catch (err) {
        console.error("Search error", err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, spaceId, isEmptyTree]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    if (!isEmptyTree && relationToAnchor !== "FOUNDING_ROOT" && !selectedAnchor) {
      setErrorMsg("Please select an ancestral anchor relative from the tree.");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch(`/api/spaces/${spaceId}/onboarding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          khmerName: khmerName.trim() || undefined,
          gender,
          birthYear: birthYear ? parseInt(birthYear, 10) : undefined,
          relationToAnchor,
          anchorPersonId: selectedAnchor?.id || undefined,
          intermediateParentId: selectedParentBranchId || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to complete onboarding");
      }

      const result = data.result;

      if (result.status === "CONFIRMED") {
        setSuccessResult({
          status: "CONFIRMED",
          message: result.message,
        });
      } else if (result.status === "CLARIFICATION_NEEDED") {
        setClarificationMsg(result.message);
        if (result.candidates && result.candidates.length > 0) {
          setClarificationCandidates(result.candidates);
        }
      } else if (result.status === "DUPLICATE_FLAGGED") {
        setSuccessResult({
          status: "DUPLICATE_FLAGGED",
          message: result.message,
        });
      } else if (result.status === "QUEUED_FOR_APPROVAL") {
        setSuccessResult({
          status: "QUEUED_FOR_APPROVAL",
          message: result.message,
        });
      }
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message || "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0c0f14] heritage-bg-pattern flex flex-col">
      <Navigation activeSpaceId={spaceId} />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/30 text-[#d4af37] text-xs font-semibold uppercase tracking-widest mb-3">
            <TreePine className="w-3.5 h-3.5" />
            <span>{t.onboarding.title}</span>
          </div>
          <h1 className="text-3xl font-bold font-heritage tracking-tight text-white mb-2">
            Weave Yourself Into The Lineage
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
            {t.onboarding.subtitle}
          </p>
        </div>

        {/* Success Card */}
        {successResult ? (
          <div className="heritage-card-elevated p-8 sm:p-10 text-center max-w-xl mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold font-heritage text-white mb-3">
              {successResult.status === "CONFIRMED"
                ? t.onboarding.successTitle
                : "Submitted For Council Review"}
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed mb-8 max-w-md mx-auto">
              {successResult.message}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => router.push(`/spaces/${spaceId}/tree`)}
                className="w-full sm:w-auto px-6 py-3 rounded-xl font-semibold text-xs text-slate-950 bg-[#d4af37] hover:bg-[#e5c158] transition-all flex items-center justify-center gap-2 shadow-md shadow-[#d4af37]/20"
              >
                <span>{t.onboarding.viewTreeBtn}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <Link
                href="/dashboard"
                className="w-full sm:w-auto px-6 py-3 rounded-xl font-medium text-xs text-slate-300 hover:text-white bg-slate-900 border border-slate-800 transition-all text-center"
              >
                Return to Dashboard
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-8">
            {errorMsg && (
              <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 flex items-start gap-3 text-rose-200 text-xs">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Step 1: Real Identity */}
            <div className="heritage-card p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
                <div className="w-8 h-8 rounded-lg bg-[#d4af37]/10 border border-[#d4af37]/30 text-[#d4af37] flex items-center justify-center font-bold text-xs">
                  1
                </div>
                <div>
                  <h3 className="text-base font-bold font-heritage text-white">
                    {t.onboarding.step1}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Enter your real legal name. Never use aliases or test names.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {t.onboarding.firstNameLabel} <span className="text-[#d4af37]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="e.g. Serey"
                    className="w-full px-3.5 py-2.5 bg-slate-900/90 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#d4af37]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {t.onboarding.lastNameLabel} <span className="text-[#d4af37]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="e.g. Vathana"
                    className="w-full px-3.5 py-2.5 bg-slate-900/90 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#d4af37]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {t.onboarding.khmerNameLabel}
                  </label>
                  <input
                    type="text"
                    value={khmerName}
                    onChange={(e) => setKhmerName(e.target.value)}
                    placeholder="e.g. សិរី វឌ្ឍនា"
                    className="w-full px-3.5 py-2.5 bg-slate-900/90 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 font-khmer focus:outline-none focus:border-[#d4af37]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {t.onboarding.genderLabel}
                  </label>
                  <select
                    value={gender}
                    onChange={(e) =>
                      setGender(e.target.value as "MALE" | "FEMALE" | "OTHER" | "UNKNOWN")
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-900/90 border border-slate-700/80 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-[#d4af37]"
                  >
                    <option value="MALE">{t.onboarding.genderMale}</option>
                    <option value="FEMALE">{t.onboarding.genderFemale}</option>
                    <option value="OTHER">{t.onboarding.genderOther}</option>
                    <option value="UNKNOWN">Unspecified</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {t.onboarding.birthYearLabel}
                  </label>
                  <input
                    type="number"
                    min="1900"
                    max="2026"
                    value={birthYear}
                    onChange={(e) => setBirthYear(e.target.value)}
                    placeholder="e.g. 1988"
                    className="w-full sm:w-1/2 px-3.5 py-2.5 bg-slate-900/90 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#d4af37]"
                  />
                </div>
              </div>
            </div>

            {/* Step 2: Ancestral Anchor Selection */}
            <div className="heritage-card p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
                <div className="w-8 h-8 rounded-lg bg-[#d4af37]/10 border border-[#d4af37]/30 text-[#d4af37] flex items-center justify-center font-bold text-xs">
                  2
                </div>
                <div>
                  <h3 className="text-base font-bold font-heritage text-white">
                    {t.onboarding.step2}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Connect yourself to an existing generation in this private space.
                  </p>
                </div>
              </div>

              {isEmptyTree ? (
                <div className="p-4 rounded-xl bg-[#d4af37]/10 border border-[#d4af37]/30 text-slate-200 text-xs">
                  <div className="flex items-center gap-2 text-[#d4af37] font-semibold mb-1">
                    <TreePine className="w-4 h-4" />
                    <span>Establishing Initial Tree Root</span>
                  </div>
                  This family space has no recorded relatives yet. You will be registered as the
                  founding patriarch/matriarch of this tree.
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Anchor Relation Selection */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-2">
                      {t.onboarding.relationPrompt}
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setRelationToAnchor("PARENT");
                          setClarificationCandidates([]);
                          setSelectedParentBranchId("");
                        }}
                        className={`p-3.5 rounded-xl text-left border transition-all text-xs ${
                          relationToAnchor === "PARENT"
                            ? "bg-[#d4af37]/15 border-[#d4af37] text-white font-medium"
                            : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700"
                        }`}
                      >
                        <span className="block font-semibold text-slate-200 mb-0.5">
                          {t.onboarding.relationParent}
                        </span>
                        <span className="text-[10px] text-slate-500">Direct generation above</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setRelationToAnchor("GRANDPARENT");
                          setClarificationCandidates([]);
                          setSelectedParentBranchId("");
                        }}
                        className={`p-3.5 rounded-xl text-left border transition-all text-xs ${
                          relationToAnchor === "GRANDPARENT"
                            ? "bg-[#d4af37]/15 border-[#d4af37] text-white font-medium"
                            : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700"
                        }`}
                      >
                        <span className="block font-semibold text-slate-200 mb-0.5">
                          {t.onboarding.relationGrandparent}
                        </span>
                        <span className="text-[10px] text-slate-500">2 generations above</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setRelationToAnchor("GREAT_GRANDPARENT");
                          setClarificationCandidates([]);
                          setSelectedParentBranchId("");
                        }}
                        className={`p-3.5 rounded-xl text-left border transition-all text-xs ${
                          relationToAnchor === "GREAT_GRANDPARENT"
                            ? "bg-[#d4af37]/15 border-[#d4af37] text-white font-medium"
                            : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700"
                        }`}
                      >
                        <span className="block font-semibold text-slate-200 mb-0.5">
                          {t.onboarding.relationGreatGrandparent}
                        </span>
                        <span className="text-[10px] text-slate-500">3 generations above</span>
                      </button>
                    </div>
                  </div>

                  {/* Relative Search Box */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Search & Select Anchor Relative
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                        <Search className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t.onboarding.searchRelativePlaceholder}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#d4af37]"
                      />
                    </div>

                    {/* Results dropdown list */}
                    <div className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 divide-y divide-slate-800/80">
                      {isSearching ? (
                        <div className="p-4 text-center text-xs text-slate-500">
                          Searching lineage records...
                        </div>
                      ) : relatives.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-500">
                          {t.onboarding.noRelativesFound}
                        </div>
                      ) : (
                        relatives.map((person) => {
                          const isSelected = selectedAnchor?.id === person.id;
                          return (
                            <button
                              key={person.id}
                              type="button"
                              onClick={() => {
                                setSelectedAnchor(person);
                                setClarificationCandidates([]);
                                setSelectedParentBranchId("");
                              }}
                              className={`w-full p-3 text-left flex items-center justify-between text-xs transition-colors ${
                                isSelected
                                  ? "bg-[#d4af37]/20 text-white font-medium"
                                  : "hover:bg-slate-900 text-slate-300"
                              }`}
                            >
                              <div>
                                <span className="font-semibold text-slate-100">
                                  {person.firstName} {person.lastName}
                                </span>
                                {person.khmerName && (
                                  <span className="ml-2 text-slate-400 font-khmer">
                                    ({person.khmerName})
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-500">
                                {person.birthYear ? `b. ${person.birthYear}` : "Year unknown"}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {selectedAnchor && (
                    <div className="p-3.5 rounded-xl bg-slate-900 border border-[#d4af37]/40 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#d4af37]/10 text-[#d4af37] flex items-center justify-center">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
                            {t.onboarding.selectedAnchor}
                          </span>
                          <span className="text-xs font-semibold text-slate-100">
                            {selectedAnchor.firstName} {selectedAnchor.lastName}
                          </span>
                        </div>
                      </div>
                      <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#d4af37]/15 text-[#d4af37] border border-[#d4af37]/30">
                        {relationToAnchor}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Step 3: Ambiguity Clarification (Rendered conditionally if candidates exist) */}
            {(clarificationMsg || clarificationCandidates.length > 0) && (
              <div className="heritage-card p-6 sm:p-8 border-amber-500/40 bg-amber-950/20">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <HelpCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold font-heritage text-white">
                      {t.onboarding.clarificationTitle}
                    </h3>
                    <p className="text-xs text-amber-200/80">{clarificationMsg}</p>
                  </div>
                </div>

                {clarificationCandidates.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <label className="block text-xs font-medium text-slate-300">
                      {t.onboarding.clarificationPrompt}
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {clarificationCandidates.map((candidate) => {
                        const isSelected = selectedParentBranchId === candidate.id;
                        return (
                          <button
                            key={candidate.id}
                            type="button"
                            onClick={() => setSelectedParentBranchId(candidate.id)}
                            className={`p-3 rounded-xl text-left border text-xs transition-all ${
                              isSelected
                                ? "bg-[#d4af37]/20 border-[#d4af37] text-white font-semibold"
                                : "bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700"
                            }`}
                          >
                            <span className="block font-semibold">
                              {candidate.firstName} {candidate.lastName}
                            </span>
                            {candidate.khmerName && (
                              <span className="text-[10px] text-slate-400 font-khmer block">
                                {candidate.khmerName}
                              </span>
                            )}
                            {candidate.birthYear && (
                              <span className="text-[10px] text-slate-500 block mt-0.5">
                                Born: {candidate.birthYear}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Submit Action */}
            <div className="flex items-center justify-end gap-4 pt-4">
              <Link
                href="/dashboard"
                className="px-5 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={submitting}
                className="px-8 py-3.5 rounded-xl font-semibold text-xs text-slate-950 bg-gradient-to-r from-[#fef08a] via-[#d4af37] to-[#b45309] hover:opacity-95 transition-all shadow-md shadow-[#d4af37]/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <span>{t.onboarding.submitting}</span>
                ) : (
                  <>
                    <GitBranch className="w-4 h-4" />
                    <span>{t.onboarding.submitBtn}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}

function OnboardingParamResolver({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = use(params);
  return <OnboardingContent spaceId={spaceId} />;
}

export default function OnboardingPage({
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
      <OnboardingParamResolver params={params} />
    </Suspense>
  );
}
