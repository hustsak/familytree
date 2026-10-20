"use client";

import React, { useState, useEffect, use, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Navigation } from "@/components/Navigation";
import { useLanguage } from "@/lib/i18n/context";
import {
  TreePine,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  GitBranch,
} from "lucide-react";

interface RelativeOption {
  id: string;
  firstName: string;
  lastName: string;
  khmerName?: string | null;
}

function SimpleOnboardingContent({ spaceId }: { spaceId: string }) {
  const { t, language } = useLanguage();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [khmerName, setKhmerName] = useState("");
  const [selectedParentId, setSelectedParentId] = useState<string>("");
  const [relatives, setRelatives] = useState<RelativeOption[]>([]);
  const [isEmptyTree, setIsEmptyTree] = useState(false);

  useEffect(() => {
    async function checkMembershipAndLoadTree() {
      try {
        const res = await fetch(`/api/spaces/${spaceId}/tree`);
        if (res.ok) {
          const data = await res.json();
          // If already linked to a person in the tree, open the tree directly!
          if (data.linkedPersonId) {
            router.replace(`/spaces/${spaceId}/tree?focusPersonId=${encodeURIComponent(data.linkedPersonId)}`);
            return;
          }

          const treePeople: RelativeOption[] = (data.people || []).map((p: RelativeOption) => ({
            id: p.id,
            firstName: p.firstName,
            lastName: p.lastName,
            khmerName: p.khmerName,
          }));

          setRelatives(treePeople);
          setIsEmptyTree(treePeople.length === 0);
        }
      } catch (err) {
        console.error("Failed to load space tree", err);
      } finally {
        setLoading(false);
      }
    }

    checkMembershipAndLoadTree();
  }, [spaceId, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();

    if (!cleanFirst || !cleanLast) {
      setErrorMsg(
        language === "km"
          ? "សូមបញ្ចូលនាមត្រកូល និងនាមខ្លួនពិតរបស់អ្នក។"
          : "Please enter your real legal first and last name."
      );
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(`/api/spaces/${spaceId}/onboarding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: cleanFirst,
          lastName: cleanLast,
          khmerName: khmerName.trim() || undefined,
          relationToAnchor: isEmptyTree ? "FOUNDING_ROOT" : "PARENT",
          anchorPersonId: selectedParentId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to complete onboarding");
      }

      const personId = data.result?.personId;
      const targetUrl = personId
        ? `/spaces/${spaceId}/tree?focusPersonId=${encodeURIComponent(personId)}`
        : `/spaces/${spaceId}/tree`;

      router.push(targetUrl);
      router.refresh();
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message || "An unexpected error occurred.");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0c0f14] flex items-center justify-center font-khmer">
        <div className="w-10 h-10 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0c0f14] heritage-bg-pattern flex flex-col font-khmer">
      <Navigation activeSpaceId={spaceId} />

      <main className="flex-1 max-w-xl w-full mx-auto px-4 py-8 sm:py-12">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/30 text-[#d4af37] text-xs font-semibold mb-3">
            <TreePine className="w-3.5 h-3.5" />
            <span>{t.onboarding.title}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-heritage text-white tracking-tight mb-2">
            {language === "km" ? "ចូលរួមពង្សាវតារគ្រួសារ" : "Join The Family Tree"}
          </h1>
          <p className="text-xs text-slate-400">
            {language === "km"
              ? "សូមបញ្ចូលឈ្មោះពិតរបស់អ្នក ដើម្បីបង្ហាញក្នុងដើមឈើគ្រួសារអន្តរកម្ម។"
              : "Enter your real name to be displayed in our interactive family tree."}
          </p>
        </div>

        <div className="heritage-card-elevated p-6 sm:p-8 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#d4af37] to-transparent" />

          {errorMsg && (
            <div className="mb-6 p-3.5 rounded-xl bg-rose-950/40 border border-rose-800 flex items-start gap-2.5 text-rose-200 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {language === "km" ? "នាមត្រកូល *" : "Last Name *"}
                </label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder={language === "km" ? "ឧ. សុខ" : "e.g. Chan"}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#d4af37]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {language === "km" ? "នាមខ្លួន *" : "First Name *"}
                </label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder={language === "km" ? "ឧ. វីរៈ" : "e.g. Vireak"}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#d4af37]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                {language === "km" ? "ឈ្មោះជាភាសាខ្មែរ (ស្រេចចិត្ត)" : "Khmer Name (Optional)"}
              </label>
              <input
                type="text"
                value={khmerName}
                onChange={(e) => setKhmerName(e.target.value)}
                placeholder={language === "km" ? "ឧ. ចាន់ វីរៈ" : "e.g. ចាន់ វីរៈ"}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#d4af37]"
              />
            </div>

            {/* Parent Branch Selection */}
            {!isEmptyTree && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {language === "km" ? "ឪពុក ឬម្តាយក្នុងដើមឈើគ្រួសារ" : "Parent in the Family Tree"}
                </label>
                <select
                  value={selectedParentId}
                  onChange={(e) => setSelectedParentId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-[#d4af37]"
                >
                  <option value="">
                    {language === "km"
                      ? "-- មិនទាន់ប្រាកដ (ឱ្យអ្នកគ្រប់គ្រងអនុម័តមែកធាង) --"
                      : "-- Not sure (Let family admin connect branch) --"}
                  </option>
                  {relatives.map((rel) => (
                    <option key={rel.id} value={rel.id}>
                      {rel.firstName} {rel.lastName} {rel.khmerName ? `(${rel.khmerName})` : ""}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  {language === "km"
                    ? "ប្រសិនបើមិនទាន់ប្រាកដ សូមទុកចន្លោះ។ អ្នកគ្រប់គ្រងនឹងភ្ជាប់អ្នកទៅកាន់សាខាត្រឹមត្រូវ។"
                    : "If uncertain, leave as 'Not sure'. The admin will approve and link your exact branch."}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-4 py-3.5 px-6 rounded-xl font-semibold text-xs text-slate-950 bg-gradient-to-r from-[#fef08a] via-[#d4af37] to-[#b45309] hover:opacity-95 transition-all shadow-lg shadow-[#d4af37]/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <span>{language === "km" ? "កំពុងតភ្ជាប់..." : "Connecting..."}</span>
              ) : (
                <>
                  <GitBranch className="w-4 h-4" />
                  <span>{language === "km" ? "ចូលរួមដើមឈើគ្រួសារ" : "Open Family Tree"}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-center gap-2 text-[11px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-[#d4af37]" />
            <span>
              {language === "km"
                ? "ព័ត៌មានរបស់អ្នកត្រូវបានការពារក្នុងដែនឯកជននៃគ្រួសារយើង។"
                : "Your information is protected inside our private family domain."}
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}

function OnboardingParamResolver({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = use(params);
  return <SimpleOnboardingContent spaceId={spaceId} />;
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
