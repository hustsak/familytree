"use client";

import React, { useState, useEffect, use, Suspense, useTransition } from "react";
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
  User,
  ShieldCheck,
  ChevronLeft,
  RotateCcw,
} from "lucide-react";

interface RelativeCandidate {
  id: string;
  firstName: string;
  lastName: string;
  khmerName?: string | null;
  birthYear?: number | null;
  photoUrl?: string | null;
}

interface OnboardingDraft {
  step: number;
  firstName: string;
  lastName: string;
  khmerName: string;
  gender: "MALE" | "FEMALE" | "OTHER" | "UNKNOWN";
  birthYear: string;
  relationToAnchor: "PARENT" | "GRANDPARENT" | "GREAT_GRANDPARENT" | "FOUNDING_ROOT";
  selectedAnchorId?: string;
  selectedAnchorName?: string;
}

function OnboardingContent({ spaceId }: { spaceId: string }) {
  const { t, language } = useLanguage();
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Wizard active step: 1 (Name) -> 2 (Select Parent / Anchor) -> 3 (Confirm Branch) -> 4 (Join Tree / Success)
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Form State
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [khmerName, setKhmerName] = useState("");
  const [gender, setGender] = useState<"MALE" | "FEMALE" | "OTHER" | "UNKNOWN">("UNKNOWN");
  const [birthYear, setBirthYear] = useState<string>("");
  const [relationToAnchor, setRelationToAnchor] = useState<
    "PARENT" | "GRANDPARENT" | "GREAT_GRANDPARENT" | "FOUNDING_ROOT"
  >("PARENT");
  const [showGrandparentOption, setShowGrandparentOption] = useState(false);

  // Ancestor Search & Selection State
  const [searchQuery, setSearchQuery] = useState("");
  const [relatives, setRelatives] = useState<RelativeCandidate[]>([]);
  const [selectedAnchor, setSelectedAnchor] = useState<RelativeCandidate | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isEmptyTree, setIsEmptyTree] = useState(false);
  const [draftLoadedNotice, setDraftLoadedNotice] = useState(false);

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
    personId?: string;
  } | null>(null);

  const storageKey = `familytree_onboarding_draft_${spaceId}`;

  // Restore draft from localStorage on initial mount asynchronously
  useEffect(() => {
    let mounted = true;
    const timer = setTimeout(() => {
      if (!mounted) return;
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed: OnboardingDraft = JSON.parse(saved);
          if (parsed.firstName) setFirstName(parsed.firstName);
          if (parsed.lastName) setLastName(parsed.lastName);
          if (parsed.khmerName) setKhmerName(parsed.khmerName);
          if (parsed.gender) setGender(parsed.gender);
          if (parsed.birthYear) setBirthYear(parsed.birthYear);
          if (parsed.relationToAnchor) {
            setRelationToAnchor(parsed.relationToAnchor);
            if (
              parsed.relationToAnchor === "GRANDPARENT" ||
              parsed.relationToAnchor === "GREAT_GRANDPARENT"
            ) {
              setShowGrandparentOption(true);
            }
          }
          if (parsed.step && parsed.step >= 1 && parsed.step <= 3) {
            setCurrentStep(parsed.step);
          }
          setDraftLoadedNotice(true);
        }
      } catch (err) {
        console.warn("Unable to restore draft from localStorage", err);
      }
    }, 0);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [storageKey]);

  // Auto-save draft changes to localStorage
  useEffect(() => {
    // Only save if user has entered at least a first name or selected an anchor
    if (!firstName && !lastName && !selectedAnchor) return;

    try {
      const draft: OnboardingDraft = {
        step: currentStep,
        firstName,
        lastName,
        khmerName,
        gender,
        birthYear,
        relationToAnchor,
        selectedAnchorId: selectedAnchor?.id,
        selectedAnchorName: selectedAnchor ? `${selectedAnchor.firstName} ${selectedAnchor.lastName}` : undefined,
      };
      localStorage.setItem(storageKey, JSON.stringify(draft));
    } catch (err) {
      console.warn("Unable to save draft to localStorage", err);
    }
  }, [currentStep, firstName, lastName, khmerName, gender, birthYear, relationToAnchor, selectedAnchor, storageKey]);

  // Check if tree is empty and pre-load initial relatives
  useEffect(() => {
    async function checkSpaceRelatives() {
      try {
        const res = await fetch(`/api/spaces/${spaceId}/people/search?q=`);
        if (res.ok) {
          const data = await res.json();
          const list: RelativeCandidate[] = data.relatives || [];
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

  // Live search relatives with debounce
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

  // Clear draft
  const handleClearDraft = () => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
    setFirstName("");
    setLastName("");
    setKhmerName("");
    setGender("UNKNOWN");
    setBirthYear("");
    setSelectedAnchor(null);
    setCurrentStep(1);
    setDraftLoadedNotice(false);
  };

  // Step 1 Validation -> Proceed to Step 2
  const handleProceedToStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!firstName.trim() || !lastName.trim()) {
      setErrorMsg(
        language === "km"
          ? "សូមបញ្ចូលនាមខ្លួន និងនាមត្រកូលពិតរបស់អ្នក។"
          : "Please enter your real legal first and last name."
      );
      return;
    }
    if (isEmptyTree) {
      // Root founding ancestor skips directly to Step 3 (Confirm & Join)
      setCurrentStep(3);
    } else {
      setCurrentStep(2);
    }
  };

  // Step 2 Validation -> Proceed to Step 3
  const handleProceedToStep3 = () => {
    setErrorMsg(null);
    if (!selectedAnchor) {
      setErrorMsg(
        language === "km"
          ? "សូមជ្រើសរើសសាច់ញាតិបង្គោល (ឪពុក ឬម្តាយ) ពីដើមឈើគ្រួសារ។"
          : "Please select an existing relative in the tree as your ancestral anchor."
      );
      return;
    }
    setCurrentStep(3);
  };

  // Final Submission to Join Tree
  const handleSubmit = async () => {
    setErrorMsg(null);
    setSubmitting(true);

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

      // Clear local storage draft upon success
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // ignore
      }

      if (result.status === "CONFIRMED") {
        setSuccessResult({
          status: "CONFIRMED",
          message: result.message,
          personId: result.personId,
        });
        setCurrentStep(4);
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
        setCurrentStep(4);
      } else if (result.status === "QUEUED_FOR_APPROVAL") {
        setSuccessResult({
          status: "QUEUED_FOR_APPROVAL",
          message: result.message,
        });
        setCurrentStep(4);
      }
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message || "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0c0f14] heritage-bg-pattern flex flex-col font-khmer">
      <Navigation activeSpaceId={spaceId} />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Header Banner */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/30 text-[#d4af37] text-xs font-semibold uppercase tracking-widest mb-3">
            <TreePine className="w-3.5 h-3.5" />
            <span>{t.onboarding.title}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-heritage tracking-tight text-white mb-2">
            {language === "km" ? "ភ្ជាប់ខ្លួនអ្នកទៅក្នុងពង្សាវតារគ្រួសារ" : "Weave Yourself Into The Lineage"}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
            {t.onboarding.subtitle}
          </p>

          {/* Draft Restored Pill */}
          {draftLoadedNotice && !successResult && (
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-700/80 text-[11px] text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{t.onboarding.draftRestored}</span>
              <button
                type="button"
                onClick={handleClearDraft}
                className="text-slate-500 hover:text-slate-300 ml-1 underline flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{language === "km" ? "សម្អាត" : "Reset"}</span>
              </button>
            </div>
          )}
        </div>

        {/* 4-Step Visual Wizard Progress Bar */}
        {!successResult && (
          <div className="mb-8">
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              {/* Step 1 */}
              <div
                className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${
                  currentStep === 1
                    ? "bg-[#d4af37]/15 border-[#d4af37] text-[#d4af37] font-semibold"
                    : currentStep > 1
                    ? "bg-slate-900/80 border-slate-700 text-emerald-400"
                    : "bg-slate-900/30 border-slate-800 text-slate-500"
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                    currentStep > 1
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : currentStep === 1
                      ? "bg-[#d4af37] text-slate-950"
                      : "bg-slate-800 text-slate-500"
                  }`}
                >
                  {currentStep > 1 ? "✓" : "1"}
                </div>
                <span className="text-[10px] sm:text-xs truncate w-full">
                  {language === "km" ? "ឈ្មោះពិត" : "Real Name"}
                </span>
              </div>

              {/* Step 2 */}
              <div
                className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${
                  currentStep === 2
                    ? "bg-[#d4af37]/15 border-[#d4af37] text-[#d4af37] font-semibold"
                    : currentStep > 2
                    ? "bg-slate-900/80 border-slate-700 text-emerald-400"
                    : "bg-slate-900/30 border-slate-800 text-slate-500"
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                    currentStep > 2
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : currentStep === 2
                      ? "bg-[#d4af37] text-slate-950"
                      : "bg-slate-800 text-slate-500"
                  }`}
                >
                  {currentStep > 2 ? "✓" : "2"}
                </div>
                <span className="text-[10px] sm:text-xs truncate w-full">
                  {language === "km" ? "ជ្រើសរើសឪពុកម្តាយ" : "Select Parent"}
                </span>
              </div>

              {/* Step 3 */}
              <div
                className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${
                  currentStep === 3
                    ? "bg-[#d4af37]/15 border-[#d4af37] text-[#d4af37] font-semibold"
                    : currentStep > 3
                    ? "bg-slate-900/80 border-slate-700 text-emerald-400"
                    : "bg-slate-900/30 border-slate-800 text-slate-500"
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                    currentStep > 3
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : currentStep === 3
                      ? "bg-[#d4af37] text-slate-950"
                      : "bg-slate-800 text-slate-500"
                  }`}
                >
                  {currentStep > 3 ? "✓" : "3"}
                </div>
                <span className="text-[10px] sm:text-xs truncate w-full">
                  {language === "km" ? "ផ្ទៀងផ្ទាត់សាខា" : "Confirm Branch"}
                </span>
              </div>

              {/* Step 4 */}
              <div
                className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${
                  currentStep === 4
                    ? "bg-[#d4af37]/15 border-[#d4af37] text-[#d4af37] font-semibold"
                    : "bg-slate-900/30 border-slate-800 text-slate-500"
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                    currentStep === 4 ? "bg-[#d4af37] text-slate-950" : "bg-slate-800 text-slate-500"
                  }`}
                >
                  4
                </div>
                <span className="text-[10px] sm:text-xs truncate w-full">
                  {language === "km" ? "ចូលរួមដើមឈើ" : "Join Tree"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Global Error Banner */}
        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 flex items-start gap-3 text-rose-200 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Step 4: Success View */}
        {successResult ? (
          <div className="heritage-card-elevated p-8 sm:p-10 text-center max-w-xl mx-auto animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold font-heritage text-white mb-3">
              {successResult.status === "CONFIRMED"
                ? t.onboarding.successTitle
                : language === "km"
                ? "បានបញ្ជូនទៅកាន់ក្រុមប្រឹក្សាគ្រួសារពិនិត្យ"
                : "Submitted For Council Review"}
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed mb-8 max-w-md mx-auto">
              {successResult.message}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => {
                  startTransition(() => {
                    const targetUrl = successResult.personId
                      ? `/spaces/${spaceId}/tree?focusPersonId=${encodeURIComponent(successResult.personId)}`
                      : `/spaces/${spaceId}/tree`;
                    router.push(targetUrl);
                  });
                }}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl font-semibold text-xs text-slate-950 bg-gradient-to-r from-[#fef08a] via-[#d4af37] to-[#b45309] hover:opacity-95 transition-all flex items-center justify-center gap-2 shadow-md shadow-[#d4af37]/20 cursor-pointer"
              >
                <span>{t.onboarding.viewTreeBtn}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <Link
                href="/dashboard"
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl font-medium text-xs text-slate-300 hover:text-white bg-slate-900 border border-slate-800 transition-all text-center"
              >
                {language === "km" ? "ត្រឡប់ទៅដែនគ្រួសារ" : "Return to Dashboard"}
              </Link>
            </div>
          </div>
        ) : (
          <div>
            {/* STEP 1: Enter Real Name & Identity */}
            {currentStep === 1 && (
              <form onSubmit={handleProceedToStep2} className="space-y-6">
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
                        {language === "km"
                          ? "សូមបញ្ចូលឈ្មោះពិតប្រាកដរបស់អ្នក។ ហាមប្រើឈ្មោះហៅក្រៅ ឬឈ្មោះក្លែងក្លាយ។"
                          : "Enter your real legal name. Never use aliases or test names."}
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
                        placeholder={language === "km" ? "ឧ. សិរី" : "e.g. Serey"}
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
                        placeholder={language === "km" ? "ឧ. វឌ្ឍនា" : "e.g. Vathana"}
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
                        placeholder="ឧ. សិរី វឌ្ឍនា"
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
                        placeholder="e.g. 1995"
                        className="w-full sm:w-1/2 px-3.5 py-2.5 bg-slate-900/90 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#d4af37]"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <Link
                    href="/dashboard"
                    className="px-4 py-2.5 text-xs text-slate-400 hover:text-white"
                  >
                    {language === "km" ? "បោះបង់" : "Cancel"}
                  </Link>

                  <button
                    type="submit"
                    className="px-6 py-3 rounded-xl font-semibold text-xs text-slate-950 bg-gradient-to-r from-[#fef08a] via-[#d4af37] to-[#b45309] hover:opacity-95 transition-all shadow-md shadow-[#d4af37]/20 flex items-center gap-2 cursor-pointer"
                  >
                    <span>{language === "km" ? "បន្តទៅជ្រើសរើសឪពុកម្តាយ" : "Continue to Select Parent"}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            )}

            {/* STEP 2: Select Parent / Ancestor */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="heritage-card p-6 sm:p-8">
                  <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#d4af37]/10 border border-[#d4af37]/30 text-[#d4af37] flex items-center justify-center font-bold text-xs">
                        2
                      </div>
                      <div>
                        <h3 className="text-base font-bold font-heritage text-white">
                          {t.onboarding.selectParentPrompt}
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          {language === "km"
                            ? "ជ្រើសរើសឪពុក ឬម្តាយរបស់អ្នកពីក្នុងបញ្ជីសាច់ញាតិដែលមានស្រាប់។"
                            : "Search and choose your biological or legal parent registered in the tree."}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowGrandparentOption(!showGrandparentOption)}
                      className="text-[11px] text-[#d4af37] hover:underline"
                    >
                      {showGrandparentOption
                        ? language === "km" ? "ត្រឡប់ទៅជ្រើសរើសឪពុកម្តាយ" : "Back to direct parent"
                        : language === "km" ? "ឪពុកម្តាយមិនទាន់មានក្នុងដើមឈើ?" : "Parent not listed yet?"}
                    </button>
                  </div>

                  {/* Optional Switch for Grandparent / Great-Grandparent */}
                  {showGrandparentOption && (
                    <div className="mb-6 p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
                      <p className="text-xs text-slate-300">
                        {t.onboarding.connectViaGrandparentNotice}
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setRelationToAnchor("GRANDPARENT")}
                          className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                            relationToAnchor === "GRANDPARENT"
                              ? "bg-[#d4af37]/20 border-[#d4af37] text-white"
                              : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                          }`}
                        >
                          {t.onboarding.relationGrandparent}
                        </button>
                        <button
                          type="button"
                          onClick={() => setRelationToAnchor("GREAT_GRANDPARENT")}
                          className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                            relationToAnchor === "GREAT_GRANDPARENT"
                              ? "bg-[#d4af37]/20 border-[#d4af37] text-white"
                              : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                          }`}
                        >
                          {t.onboarding.relationGreatGrandparent}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Search Box */}
                  <div className="relative mb-4">
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

                  {/* Relative Cards with Profile Photos */}
                  <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                    {isSearching ? (
                      <div className="p-6 text-center text-xs text-slate-500">
                        {language === "km" ? "កំពុងស្វែងរកក្នុងពង្សាវតារ..." : "Searching lineage records..."}
                      </div>
                    ) : relatives.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500">
                        {t.onboarding.noRelativesFound}
                      </div>
                    ) : (
                      relatives.map((person) => {
                        const isSelected = selectedAnchor?.id === person.id;
                        return (
                          <div
                            key={person.id}
                            onClick={() => {
                              setSelectedAnchor(person);
                              setClarificationCandidates([]);
                              setSelectedParentBranchId("");
                            }}
                            className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                              isSelected
                                ? "bg-[#d4af37]/15 border-[#d4af37] shadow-sm shadow-[#d4af37]/20"
                                : "bg-slate-900/60 border-slate-800 hover:bg-slate-900 hover:border-slate-700"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {/* Avatar Profile Photo */}
                              <div className="w-10 h-10 rounded-full border border-[#d4af37]/40 overflow-hidden bg-slate-950 flex items-center justify-center shrink-0">
                                {person.photoUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={person.photoUrl}
                                    alt={`${person.firstName} ${person.lastName}`}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <User className="w-5 h-5 text-[#d4af37]" />
                                )}
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-slate-100">
                                  {person.firstName} {person.lastName}
                                </h4>
                                {person.khmerName && (
                                  <p className="text-[11px] text-slate-400 font-khmer">
                                    {person.khmerName}
                                  </p>
                                )}
                                <span className="text-[10px] text-slate-500">
                                  {person.birthYear ? `b. ${person.birthYear}` : "Year unrecorded"}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {isSelected ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#d4af37] text-slate-950 text-[10px] font-bold">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>{language === "km" ? "បានជ្រើសរើស" : "Selected"}</span>
                                </span>
                              ) : (
                                <span className="text-xs text-slate-500 group-hover:text-slate-300">
                                  {language === "km" ? "ជ្រើសរើស" : "Select"}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Back / Next Buttons */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white flex items-center gap-1.5"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>{language === "km" ? "ថយក្រោយ" : "Back"}</span>
                  </button>

                  <button
                    type="button"
                    disabled={!selectedAnchor}
                    onClick={handleProceedToStep3}
                    className="px-6 py-3 rounded-xl font-semibold text-xs text-slate-950 bg-gradient-to-r from-[#fef08a] via-[#d4af37] to-[#b45309] hover:opacity-95 transition-all shadow-md shadow-[#d4af37]/20 flex items-center gap-2 cursor-pointer disabled:opacity-40"
                  >
                    <span>{language === "km" ? "បន្តទៅផ្ទៀងផ្ទាត់សាខា" : "Confirm Branch"}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Confirm Family Branch & Clarification */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="heritage-card p-6 sm:p-8">
                  <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
                    <div className="w-8 h-8 rounded-lg bg-[#d4af37]/10 border border-[#d4af37]/30 text-[#d4af37] flex items-center justify-center font-bold text-xs">
                      3
                    </div>
                    <div>
                      <h3 className="text-base font-bold font-heritage text-white">
                        {t.onboarding.confirmBranch}
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        {language === "km"
                          ? "សូមពិនិត្យព័ត៌មានខាងក្រោមមុននឹងតភ្ជាប់ចូលក្នុងដើមឈើគ្រួសារ។"
                          : "Review your lineage connection before weaving yourself into the interactive tree."}
                      </p>
                    </div>
                  </div>

                  {/* Summary Overview */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">
                        {language === "km" ? "អត្តសញ្ញាណរបស់អ្នក" : "Your Identity"}
                      </span>
                      <h4 className="text-sm font-bold text-white">
                        {firstName} {lastName}
                      </h4>
                      {khmerName && <p className="text-xs text-slate-400 font-khmer">{khmerName}</p>}
                      <p className="text-[11px] text-slate-500 mt-1">
                        {birthYear ? `Born: ${birthYear}` : "Birth year not set"}
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">
                        {language === "km" ? "សាច់ញាតិបង្គោលតភ្ជាប់" : "Connecting To Anchor"}
                      </span>
                      {selectedAnchor ? (
                        <>
                          <h4 className="text-sm font-bold text-white">
                            {selectedAnchor.firstName} {selectedAnchor.lastName}
                          </h4>
                          {selectedAnchor.khmerName && (
                            <p className="text-xs text-slate-400 font-khmer">
                              {selectedAnchor.khmerName}
                            </p>
                          )}
                          <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-[#d4af37]/15 text-[#d4af37] border border-[#d4af37]/30">
                            {relationToAnchor === "PARENT"
                              ? language === "km" ? "ជាកូន (Child)" : "Child of"
                              : relationToAnchor}
                          </span>
                        </>
                      ) : (
                        <p className="text-xs text-[#d4af37]">
                          {language === "km"
                            ? "ដូនតាដើម ឬមេគ្រួសារដំបូង (Root)"
                            : "Founding Patriarch/Matriarch of Space"}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Clarification Box if triggered by backend */}
                  {(clarificationMsg || clarificationCandidates.length > 0) && (
                    <div className="mb-6 p-4 rounded-xl border border-amber-500/40 bg-amber-950/20">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                          <HelpCircle className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-white">
                            {t.onboarding.clarificationTitle}
                          </h4>
                          <p className="text-[11px] text-amber-200/80">{clarificationMsg}</p>
                        </div>
                      </div>

                      {clarificationCandidates.length > 0 && (
                        <div className="space-y-2 mt-3">
                          <label className="block text-xs font-medium text-slate-300">
                            {t.onboarding.clarificationPrompt}
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-3 text-xs text-slate-400">
                    <ShieldCheck className="w-4 h-4 text-[#d4af37] shrink-0" />
                    <span>
                      {language === "km"
                        ? "ពង្សាវតារនេះប្រើប្រាស់តែទំនាក់ទំនងពិតប្រាកដដែលបានផ្ទៀងផ្ទាត់ប៉ុណ្ណោះ។ មិនមានការស្មានឡើយ។"
                        : "Only verified database relationships are recorded. We never invent or guess ancestry."}
                    </span>
                  </div>
                </div>

                {/* Back / Join Action */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(isEmptyTree ? 1 : 2)}
                    className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white flex items-center gap-1.5"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>{language === "km" ? "ថយក្រោយ" : "Back"}</span>
                  </button>

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleSubmit}
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
              </div>
            )}
          </div>
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
