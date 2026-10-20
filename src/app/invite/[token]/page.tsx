"use client";

import React, { useState, useEffect, use, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n/context";
import { createClient } from "@/lib/supabase/client";
import {
  Scroll,
  ShieldCheck,
  TreePine,
  ArrowRight,
  AlertCircle,
  Sparkles,
  GitBranch,
} from "lucide-react";

interface InviteData {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  space: {
    id: string;
    name: string;
    description: string | null;
  };
  inviterName: string;
  suggestedPerson?: {
    id: string;
    name: string;
    khmerName?: string | null;
  } | null;
}

function InviteAcceptContent({ token }: { token: string }) {
  const { language, setLanguage, t } = useLanguage();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 1-Step joining form fields (Real name only)
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [khmerName, setKhmerName] = useState("");

  useEffect(() => {
    async function checkAuthAndInvite() {
      try {
        try {
          const supabase = createClient();
          const { data } = await supabase.auth.getUser();
          if (data?.user?.user_metadata?.full_name) {
            const parts = (data.user.user_metadata.full_name as string).split(" ");
            if (parts.length > 1) {
              setLastName(parts[0]);
              setFirstName(parts.slice(1).join(" "));
            } else {
              setFirstName(data.user.user_metadata.full_name as string);
            }
          }
        } catch {
          // offline or unauthenticated
        }

        const res = await fetch(`/api/invitations/${token}`);
        const data = await res.json();

        if (!res.ok || !data.valid) {
          setErrorMsg(data.error || t.invitations.invalidSubtitle);
        } else {
          setInvite(data.invitation);
        }
      } catch {
        setErrorMsg(t.invitations.invalidSubtitle);
      } finally {
        setLoading(false);
      }
    }

    checkAuthAndInvite();
  }, [token, t.invitations.invalidSubtitle]);

  // Handle Simple Join Form Submission
  const handleJoinFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();

    if (!cleanFirst || !cleanLast) {
      setErrorMsg(
        language === "km"
          ? "សូមបញ្ចូលនាមត្រកូល និងនាមខ្លួនពិតរបស់អ្នក។"
          : "Please enter your real first and last name."
      );
      return;
    }

    setSubmitting(true);

    try {
      // Accept the invitation directly with real name details
      const res = await fetch(`/api/invitations/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personDetails: {
            firstName: cleanFirst,
            lastName: cleanLast,
            khmerName: khmerName.trim() || undefined,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to join family space.");
      }

      // Open family tree immediately!
      const targetPersonId = data.personId;
      const targetUrl = targetPersonId
        ? `/spaces/${data.spaceId || invite?.space.id}/tree?focusPersonId=${encodeURIComponent(targetPersonId)}`
        : `/spaces/${data.spaceId || invite?.space.id}/tree`;

      router.push(targetUrl);
      router.refresh();
    } catch (err: unknown) {
      const e = err as Error;
      if (e.message?.includes("fetch") || e.message === "Failed to fetch") {
        setErrorMsg(
          language === "km"
            ? "មិនអាចតភ្ជាប់ទៅសេវាផ្ទៀងផ្ទាត់បានទេ។ សូមពិនិត្យការកំណត់ក្នុង .env.local។"
            : "Unable to connect to authentication service. Please check .env.local configuration."
        );
      } else {
        setErrorMsg(e.message || "An unexpected error occurred while joining.");
      }
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0c0f14] heritage-bg-pattern flex flex-col justify-between p-4 sm:p-6 lg:p-8 font-khmer">
      {/* Top Header */}
      <div className="max-w-7xl w-full mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#d4af37] via-[#b8860b] to-[#78350f] p-[1px] shadow-lg shadow-[#d4af37]/20">
            <div className="w-full h-full bg-[#0c0f14] rounded-[11px] flex items-center justify-center">
              <Scroll className="w-5 h-5 text-[#d4af37]" />
            </div>
          </div>
          <div>
            <span className="font-heritage text-lg font-bold tracking-wider text-slate-100">
              {t.appName}
            </span>
            <span className="block text-[10px] text-slate-400 font-light">
              {t.appSubtitle}
            </span>
          </div>
        </Link>

        {/* Language Switcher */}
        <div className="flex items-center bg-slate-900/90 rounded-lg p-1 border border-slate-700/60">
          <button
            type="button"
            onClick={() => setLanguage("km")}
            className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
              language === "km"
                ? "bg-[#d4af37] text-slate-950 font-semibold font-khmer"
                : "text-slate-400 hover:text-white font-khmer"
            }`}
          >
            ភាសាខ្មែរ
          </button>
          <button
            type="button"
            onClick={() => setLanguage("en")}
            className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
              language === "en"
                ? "bg-[#d4af37] text-slate-950 font-semibold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            English
          </button>
        </div>
      </div>

      {/* Main Join Container */}
      <div className="w-full max-w-lg mx-auto my-6 sm:my-10">
        {loading ? (
          <div className="heritage-card p-12 text-center">
            <div className="w-10 h-10 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-xs text-slate-400">
              {language === "km"
                ? "កំពុងផ្ទៀងផ្ទាត់លិខិតអញ្ជើញ..."
                : "Verifying private invitation..."}
            </p>
          </div>
        ) : errorMsg && !invite ? (
          <div className="heritage-card p-8 sm:p-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold font-heritage text-white mb-2">
              {t.invitations.invalidTitle}
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              {errorMsg}
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-xs text-slate-950 bg-[#d4af37] hover:bg-[#e5c158] transition-all"
            >
              <span>{language === "km" ? "ត្រឡប់ទៅទំព័រដើម" : "Return to Home"}</span>
            </Link>
          </div>
        ) : invite ? (
          <div className="heritage-card-elevated p-6 sm:p-8 relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#d4af37] to-transparent" />

            {/* Header: Family Space & Inviter */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/30 text-[#d4af37] text-xs font-semibold mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{t.invitations.title}</span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold font-heritage text-white tracking-tight mb-1">
                {invite.space.name}
              </h1>

              <p className="text-xs text-slate-400">
                {language === "km" ? "អញ្ជើញដោយ៖" : "Invited by:"}{" "}
                <span className="text-slate-200 font-semibold">{invite.inviterName}</span>
              </p>
            </div>

            {/* Obvious Branch Banner (if specified by inviter) */}
            {invite.suggestedPerson ? (
              <div className="mb-6 p-4 rounded-xl bg-[#d4af37]/10 border border-[#d4af37]/40 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#d4af37]/20 text-[#d4af37] flex items-center justify-center shrink-0">
                  <GitBranch className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#d4af37] tracking-wider block">
                    {language === "km" ? "សាខាគ្រួសារផ្ទៀងផ្ទាត់រួច" : "Verified Family Branch"}
                  </span>
                  <span className="text-xs font-semibold text-white block">
                    {language === "km"
                      ? `កូនរបស់៖ ${invite.suggestedPerson.name}`
                      : `Connecting as child of: ${invite.suggestedPerson.name}`}
                    {invite.suggestedPerson.khmerName && (
                      <span className="text-slate-300 ml-1">
                        ({invite.suggestedPerson.khmerName})
                      </span>
                    )}
                  </span>
                </div>
              </div>
            ) : (
              <div className="mb-6 p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-2.5 text-xs text-slate-400">
                <ShieldCheck className="w-4 h-4 text-[#d4af37] shrink-0" />
                <span>
                  {language === "km"
                    ? "ចូលរួមរួច អ្នកគ្រប់គ្រងគ្រួសារនឹងភ្ជាប់អ្នកទៅកាន់មែកធាងពិតប្រាកដ។"
                    : "After joining, the family admin will verify and link your exact branch."}
                </span>
              </div>
            )}

            {/* Error Message */}
            {errorMsg && (
              <div className="mb-6 p-3.5 rounded-xl bg-rose-950/40 border border-rose-800 flex items-start gap-2.5 text-rose-200 text-xs">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* 1-Step Form: Real Name & Join */}
            <form onSubmit={handleJoinFamily} className="space-y-4">
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



              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-4 py-3.5 px-6 rounded-xl font-semibold text-xs text-slate-950 bg-gradient-to-r from-[#fef08a] via-[#d4af37] to-[#b45309] hover:opacity-95 transition-all shadow-lg shadow-[#d4af37]/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <span>
                    {language === "km" ? "កំពុងចូលរួម..." : "Joining Family..."}
                  </span>
                ) : (
                  <>
                    <TreePine className="w-4 h-4" />
                    <span>
                      {language === "km" ? "ចូលរួមពង្សាវតារគ្រួសារ" : "Join Family Tree"}
                    </span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-4 border-t border-slate-800/80 text-center text-[11px] text-slate-500">
              <ShieldCheck className="w-3.5 h-3.5 text-[#d4af37] inline mr-1" />
              <span>
                {language === "km"
                  ? "លិខិតអញ្ជើញនេះមានសុពលភាពសម្រាប់ប្រើតែម្តងគត់ និងការពារដោយសុវត្ថិភាព។"
                  : "This invitation is single-use and cryptographically secured."}
              </span>
            </div>
          </div>
        ) : null}
      </div>

      <footer className="text-center text-[11px] text-slate-600 py-2">
        &copy; 2026 {t.appName}. {t.heritage.honorAncestors}
      </footer>
    </div>
  );
}

function InviteParamResolver({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  return <InviteAcceptContent token={token} />;
}

export default function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0c0f14] flex items-center justify-center">
          <div className="w-10 h-10 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <InviteParamResolver params={params} />
    </Suspense>
  );
}
