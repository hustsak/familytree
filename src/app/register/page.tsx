"use client";

import React from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/context";
import { Scroll, ShieldCheck, ArrowRight, Lock } from "lucide-react";

export default function RegisterPage() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className="min-h-screen bg-[#0c0f14] heritage-bg-pattern flex flex-col justify-between p-4 sm:p-6 lg:p-8 font-khmer">
      {/* Top Header Bar */}
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

      {/* Main Notice Card */}
      <div className="w-full max-w-lg mx-auto my-8">
        <div className="heritage-card-elevated p-8 sm:p-10 relative overflow-hidden text-center">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#d4af37] to-transparent" />

          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#d4af37]/10 border border-[#d4af37]/30 text-[#d4af37] mb-6">
            <Lock className="w-8 h-8" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold font-heritage tracking-tight text-white mb-3">
            {language === "km"
              ? "ដែនគ្រួសារឯកជន — ចូលរួមដោយការអញ្ជើញតែប៉ុណ្ណោះ"
              : "Private Family Sanctuary — Invitation Only"}
          </h1>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-6">
            {language === "km"
              ? "គេហទំព័រនេះត្រូវបានបង្កើតឡើងសម្រាប់តែសមាជិកគ្រួសារ និងបងប្អូនជីដូនមួយប៉ុណ្ណោះ។ ដើម្បីការពារភាពឯកជននៃពង្សាវតារ និងខ្សែស្រឡាយដូនតា ការចុះឈ្មោះជាសាធារណៈមិនត្រូវបានអនុញ្ញាតឡើយ។"
              : "This website is exclusively for our family members and cousins. To protect the privacy and sanctity of our lineage, public self-registration is closed."}
          </p>

          <div className="p-4 rounded-xl bg-slate-900/90 border border-[#d4af37]/30 text-left mb-8 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#d4af37]">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>
                {language === "km"
                  ? "តើត្រូវចូលរួមយ៉ាងដូចម្តេច?"
                  : "How to Join Our Family Tree:"}
              </span>
            </div>
            <ol className="text-xs text-slate-300 space-y-2 list-decimal list-inside leading-relaxed">
              <li>
                {language === "km"
                  ? "សុំតំណភ្ជាប់លិខិតអញ្ជើញ (Invitation Link) ពីអ្នកគ្រប់គ្រងគ្រួសារ ឬមេគ្រួសារ។"
                  : "Request a private invitation link from a family admin or elder."}
              </li>
              <li>
                {language === "km"
                  ? "បើកតំណភ្ជាប់លិខិតអញ្ជើញ ហើយបញ្ចូលឈ្មោះពិតរបស់អ្នក។"
                  : "Open the invitation link and enter your real full name."}
              </li>
              <li>
                {language === "km"
                  ? "ចូលរួមក្នុងដើមឈើគ្រួសារភ្លាមៗដោយមិនចាំបាច់ឆ្លងកាត់ទម្រង់វែងឆ្ងាយ។"
                  : "Enter the family tree immediately without tedious multi-step forms."}
              </li>
            </ol>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/dashboard"
              className="w-full sm:w-auto px-6 py-3 rounded-xl font-semibold text-xs text-slate-950 bg-gradient-to-r from-[#fef08a] via-[#d4af37] to-[#b45309] hover:opacity-95 transition-all flex items-center justify-center gap-2 shadow-md shadow-[#d4af37]/20"
            >
              <span>{language === "km" ? "ចូលទៅកាន់ដែនគ្រួសារ" : "Enter Family Space"}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/"
              className="w-full sm:w-auto px-6 py-3 rounded-xl font-medium text-xs text-slate-300 hover:text-white bg-slate-900 border border-slate-800 transition-all text-center"
            >
              {language === "km" ? "ត្រឡប់ទៅទំព័រដើម" : "Back to Home"}
            </Link>
          </div>
        </div>

        <div className="mt-6 text-center text-[11px] text-slate-500 max-w-sm mx-auto leading-relaxed">
          {t.auth.invitationOnlyNotice}
        </div>
      </div>

      <footer className="text-center text-[11px] text-slate-600 py-2">
        &copy; 2026 {t.appName}. {t.heritage.honorAncestors}
      </footer>
    </div>
  );
}
