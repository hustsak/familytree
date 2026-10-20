"use client";

import React, { useState, useEffect, use, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n/context";
import { createClient } from "@/lib/supabase/client";
import {
  Scroll,
  ShieldCheck,
  Crown,
  Users2,
  Calendar,
  ArrowRight,
  AlertCircle,
  Lock,
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
}

function InviteAcceptContent({ token }: { token: string }) {
  const { language, setLanguage, t } = useLanguage();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    async function checkAuthAndInvite() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        setIsLoggedIn(!!user);

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

  const handleAccept = async () => {
    if (!isLoggedIn) {
      router.push(`/login?redirectedFrom=/invite/${token}`);
      return;
    }

    setAccepting(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/invitations/${token}/accept`, {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to accept invitation");
      }

      router.push(`/spaces/${data.space.id}/onboarding`);
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message);
      setAccepting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0c0f14] heritage-bg-pattern flex flex-col justify-between p-4 sm:p-6 lg:p-8">
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
            onClick={() => setLanguage("en")}
            className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
              language === "en"
                ? "bg-[#d4af37] text-slate-950 font-semibold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            English
          </button>
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
        </div>
      </div>

      {/* Main Invitation Card */}
      <div className="w-full max-w-lg mx-auto my-8">
        <div className="heritage-card-elevated p-8 sm:p-10 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#d4af37] to-transparent" />

          {loading ? (
            <div className="py-16 text-center">
              <div className="w-10 h-10 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-xs text-slate-400">{t.auth.loading}</p>
            </div>
          ) : errorMsg && !invite ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-2xl bg-rose-950/40 border border-rose-800/60 text-rose-400 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold font-heritage text-white mb-2">
                {t.invitations.invalidTitle}
              </h2>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mb-6 leading-relaxed">
                {errorMsg}
              </p>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-950 bg-[#d4af37] hover:bg-[#e5c158] transition-all"
              >
                Return to Sanctuary
              </Link>
            </div>
          ) : invite ? (
            <div>
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#d4af37]/10 border border-[#d4af37]/30 text-[#d4af37] mb-4">
                  <ShieldCheck className="w-7 h-7" />
                </div>
                <h1 className="text-2xl font-bold font-heritage tracking-tight text-white mb-2">
                  {t.invitations.title}
                </h1>
                <p className="text-xs text-slate-400 leading-relaxed max-w-md mx-auto">
                  {t.invitations.subtitle}
                </p>
              </div>

              {errorMsg && (
                <div className="mb-6 p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 flex items-start gap-3 text-rose-200 text-xs">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Onboarding Journey Flow Banner */}
              <div className="mb-6 p-4 rounded-xl bg-slate-950/70 border border-[#d4af37]/25 text-xs">
                <span className="text-[10px] text-[#d4af37] uppercase tracking-wider font-semibold block mb-2 text-center">
                  {language === "km" ? "ដំណើរការចូលរួមគ្រួសារ ៦ ជំហានងាយៗ" : "6-Step Easy Family Onboarding"}
                </span>
                <div className="flex items-center justify-between gap-1 text-[10px] text-slate-400 overflow-x-auto pb-1">
                  <div className="flex flex-col items-center shrink-0 text-[#d4af37] font-semibold">
                    <span className="w-5 h-5 rounded-full bg-[#d4af37] text-slate-950 flex items-center justify-center text-[10px] mb-1">1</span>
                    <span>{language === "km" ? "បើកតំណ" : "Invite"}</span>
                  </div>
                  <span className="text-slate-600">→</span>
                  <div className="flex flex-col items-center shrink-0">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-[10px] mb-1">2</span>
                    <span>{language === "km" ? "ចូលគណនី" : "Sign In"}</span>
                  </div>
                  <span className="text-slate-600">→</span>
                  <div className="flex flex-col items-center shrink-0">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-[10px] mb-1">3</span>
                    <span>{language === "km" ? "ឈ្មោះពិត" : "Real Name"}</span>
                  </div>
                  <span className="text-slate-600">→</span>
                  <div className="flex flex-col items-center shrink-0">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-[10px] mb-1">4</span>
                    <span>{language === "km" ? "រើសឪពុកម្តាយ" : "Parent"}</span>
                  </div>
                  <span className="text-slate-600">→</span>
                  <div className="flex flex-col items-center shrink-0">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-[10px] mb-1">5</span>
                    <span>{language === "km" ? "បញ្ជាក់សាខា" : "Branch"}</span>
                  </div>
                  <span className="text-slate-600">→</span>
                  <div className="flex flex-col items-center shrink-0">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-[10px] mb-1">6</span>
                    <span>{language === "km" ? "ដើមឈើ" : "Tree"}</span>
                  </div>
                </div>
              </div>

              {/* Family Sanctuary Preview Card */}
              <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-4 mb-8">
                <div>
                  <span className="text-[11px] text-[#d4af37] uppercase tracking-wider font-semibold block mb-1">
                    {language === "km" ? "ជម្រកគ្រួសារដែលអ្នកកំពុងចូលរួម" : "Family Sanctuary You Are Joining"}
                  </span>
                  <h3 className="text-xl font-bold font-heritage text-white">
                    {invite.space.name}
                  </h3>
                  {invite.space.description && (
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      {invite.space.description}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-800/80 text-xs text-slate-300">
                  <div>
                    <span className="text-slate-500 block text-[10px] mb-0.5">
                      {language === "km" ? "អញ្ជើញដោយសាច់ញាតិ" : t.invitations.invitedBy}
                    </span>
                    <span className="font-semibold text-slate-100 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#d4af37]" />
                      {invite.inviterName}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[10px] mb-0.5">
                      {t.invitations.roleOffered}
                    </span>
                    <span className="inline-flex items-center gap-1 font-medium text-[#d4af37]">
                      {invite.role === "ADMIN" ? (
                        <>
                          <Crown className="w-3.5 h-3.5" />
                          <span>Admin Guardian</span>
                        </>
                      ) : (
                        <>
                          <Users2 className="w-3.5 h-3.5" />
                          <span>Family Member</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>

                <div className="pt-2 text-[11px] text-slate-500 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>
                    {t.invitations.expiresIn}{" "}
                    {new Date(invite.expiresAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Action */}
              {isLoggedIn ? (
                <button
                  type="button"
                  onClick={handleAccept}
                  disabled={accepting}
                  className="w-full py-3.5 px-4 rounded-xl font-semibold text-sm text-slate-950 bg-gradient-to-r from-[#fef08a] via-[#d4af37] to-[#b45309] hover:opacity-95 transition-all shadow-md shadow-[#d4af37]/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {accepting ? (
                    <span>{t.auth.loading}</span>
                  ) : (
                    <>
                      <span>{t.invitations.acceptBtn}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              ) : (
                <div className="space-y-3">
                  <Link
                    href={`/register?redirectedFrom=/invite/${token}`}
                    className="w-full py-3.5 px-4 rounded-xl font-semibold text-sm text-slate-950 bg-gradient-to-r from-[#fef08a] via-[#d4af37] to-[#b45309] hover:opacity-95 transition-all shadow-md shadow-[#d4af37]/20 flex items-center justify-center gap-2"
                  >
                    <span>Create Account & Accept</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    href={`/login?redirectedFrom=/invite/${token}`}
                    className="w-full py-2.5 px-4 rounded-xl font-medium text-xs text-slate-300 hover:text-white bg-slate-900 border border-slate-700/80 transition-all flex items-center justify-center"
                  >
                    Already have an account? Sign In
                  </Link>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Private Notice */}
        <div className="mt-6 text-center text-[11px] text-slate-500 max-w-sm mx-auto leading-relaxed flex items-center justify-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-emerald-500" />
          <span>{t.auth.invitationOnlyNotice}</span>
        </div>
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

export default function InviteAcceptPage({
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
