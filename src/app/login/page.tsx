"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLanguage } from "@/lib/i18n/context";
import {
  TreePine,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";

function FamilyPasscodeGateContent() {
  const { language, setLanguage } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectedFrom = searchParams.get("redirectedFrom") || "/";
  const reason = searchParams.get("reason");

  const [passcode, setPasscode] = useState("");
  const [showPasscode, setShowPasscode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) {
      setErrorMsg(
        language === "km"
          ? "សូមបញ្ចូលលេខកូដសម្ងាត់គ្រួសារ"
          : "Please enter the family passcode"
      );
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/family-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: passcode.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(
          data.error ||
            (language === "km"
              ? "លេខកូដសម្ងាត់គ្រួសារមិនត្រឹមត្រូវទេ"
              : "Invalid family passcode")
        );
        setSubmitting(false);
        return;
      }

      const target =
        redirectedFrom &&
        redirectedFrom.startsWith("/") &&
        !redirectedFrom.startsWith("/login")
          ? redirectedFrom
          : "/";
      router.replace(target);
      router.refresh();
    } catch {
      setErrorMsg(
        language === "km"
          ? "មានបញ្ហាក្នុងការតភ្ជាប់ សូមព្យាយាមម្តងទៀត"
          : "Connection error, please try again"
      );
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f0f7ff] via-[#e6f1fe] to-[#eef9f6] flex flex-col justify-between p-4 sm:p-6 lg:p-8 font-khmer text-[#1c2e48]">
      {/* Top Header Bar */}
      <div className="max-w-5xl w-full mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2f7de1] to-[#1c57b8] flex items-center justify-center text-white shadow-md shadow-blue-600/20">
            <TreePine className="w-5 h-5" />
          </div>
          <div>
            <span className="text-sm sm:text-base font-extrabold text-[#1c2e48] leading-relaxed block">
              កូនចៅត្រកូល ទៀង
            </span>
            <span className="block text-[10.5px] text-[#5b718a] font-medium">
              {language === "km"
                ? "ដែនពង្សាវតារគ្រួសារឯកជន"
                : "Private Family Lineage"}
            </span>
          </div>
        </div>

        {/* Language Switcher */}
        <div className="flex items-center bg-white rounded-xl p-1 border border-[#cbdcf0] shadow-2xs">
          <button
            type="button"
            onClick={() => setLanguage("km")}
            className={`px-3 py-1 text-xs rounded-lg font-bold transition-colors cursor-pointer ${
              language === "km"
                ? "bg-[#2f7de1] text-white"
                : "text-[#5b718a] hover:text-[#1c2e48]"
            }`}
          >
            ភាសាខ្មែរ
          </button>
          <button
            type="button"
            onClick={() => setLanguage("en")}
            className={`px-3 py-1 text-xs rounded-lg font-bold transition-colors cursor-pointer ${
              language === "en"
                ? "bg-[#2f7de1] text-white"
                : "text-[#5b718a] hover:text-[#1c2e48]"
            }`}
          >
            English
          </button>
        </div>
      </div>

      {/* Main Family Passcode Card */}
      <div className="max-w-md w-full mx-auto my-8">
        <div className="bg-white rounded-3xl border border-[#cbdcf0] p-6 sm:p-8 shadow-2xl shadow-blue-900/10">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[#f0f6ff] border border-[#bfd8f5] flex items-center justify-center text-[#2f7de1] shadow-inner">
            <Lock className="w-7 h-7" />
          </div>

          <div className="text-center mb-6">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold mb-2 leading-relaxed">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>
                {language === "km"
                  ? "ការពារឯកជនភាពគ្រួសារ"
                  : "Protected Family Privacy"}
              </span>
            </span>
            <h1 className="text-lg sm:text-xl font-extrabold text-[#1c2e48] leading-relaxed">
              {language === "km"
                ? "កូនចៅត្រកូល ទៀង"
                : "Tieng Family Tree"}
            </h1>
            <p className="text-xs text-[#5b718a] leading-relaxed mt-1">
              {language === "km"
                ? "ទិន្នន័យគ្រួសារត្រូវបានរក្សាទុកជាឯកជន។ សូមបញ្ចូលលេខកូដសម្ងាត់គ្រួសារ ដើម្បីចូលមើល និងបន្ថែមសមាជិក។"
                : "This family tree is private. Please enter the family passcode to view and manage family members."}
            </p>
          </div>

          {reason === "link_used" && !errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold flex items-center gap-2 leading-relaxed">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>
                {language === "km"
                  ? "លីងអញ្ជើញនេះត្រូវបានប្រើប្រាស់រួចហើយ។ សូមបញ្ចូលលេខកូដសម្ងាត់គ្រួសារដើម្បីចូលមើល។"
                  : "This shared invite link has already been used. Please enter the family passcode to access."}
              </span>
            </div>
          )}

          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2 leading-relaxed">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleUnlock} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#1c2e48] mb-1.5 leading-relaxed">
                {language === "km"
                  ? "លេខកូដសម្ងាត់គ្រួសារ (Family Passcode)"
                  : "Family Passcode"}
              </label>
              <div className="relative">
                <input
                  type={showPasscode ? "text" : "password"}
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder={
                    language === "km"
                      ? "បញ្ចូលលេខកូដសម្ងាត់គ្រួសារ..."
                      : "Enter family passcode..."
                  }
                  autoFocus
                  className="w-full pl-4 pr-11 py-3 rounded-xl bg-[#f8fbff] border border-[#cbdcf0] text-sm font-bold text-[#1c2e48] placeholder:text-slate-400 focus:outline-none focus:border-[#2f7de1] focus:bg-white transition-all leading-relaxed"
                />
                <button
                  type="button"
                  onClick={() => setShowPasscode((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-[#1c2e48] cursor-pointer"
                  title={showPasscode ? "Hide passcode" : "Show passcode"}
                >
                  {showPasscode ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-[#2f7de1] to-[#1c57b8] hover:from-[#256ac2] hover:to-[#164899] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 transition-all cursor-pointer disabled:opacity-60 leading-relaxed"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>
                    {language === "km" ? "កំពុងផ្ទៀងផ្ទាត់..." : "Verifying..."}
                  </span>
                </>
              ) : (
                <>
                  <span>
                    {language === "km"
                      ? "ចូលទៅកាន់មែកធាងគ្រួសារ"
                      : "Unlock Family Tree"}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-5xl w-full mx-auto text-center text-xs text-[#6a7f99]">
        <p>
          {language === "km"
            ? "សម្រាប់តែសមាជិកគ្រួសារ ទៀង ប៉ុណ្ណោះ • មិនបង្ហាញលើប្រព័ន្ធស្វែងរកសាធារណៈ"
            : "Exclusively for Tieng Family Members • Hidden from public search engines"}
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f0f7ff] flex items-center justify-center text-[#2f7de1]">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      }
    >
      <FamilyPasscodeGateContent />
    </Suspense>
  );
}
