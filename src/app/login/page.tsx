"use client";

import React, { useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLanguage } from "@/lib/i18n/context";
import { Scroll, ArrowRight, Loader2, Sparkles } from "lucide-react";

function LoginRedirectContent() {
  const { language, setLanguage, t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectedFrom = searchParams.get("redirectedFrom") || "/dashboard";

  useEffect(() => {
    // Automatically redirect directly to the family dashboard
    const target = redirectedFrom.startsWith("/login") ? "/dashboard" : redirectedFrom;
    router.replace(target);
  }, [router, redirectedFrom]);

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

      {/* Main Direct Family Access Card */}
      <div className="max-w-md w-full mx-auto my-12">
        <div className="heritage-card-elevated p-8 relative overflow-hidden shadow-2xl text-center">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#d4af37] to-transparent" />

          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[#d4af37]/10 border border-[#d4af37]/30 flex items-center justify-center text-[#d4af37] shadow-lg shadow-[#d4af37]/10">
            <Sparkles className="w-7 h-7" />
          </div>

          <h1 className="text-xl sm:text-2xl font-bold font-heritage text-white tracking-tight mb-2">
            {language === "km" ? "កំពុងចូលទៅកាន់ដែនគ្រួសារ..." : "Accessing Family Space..."}
          </h1>

          <p className="text-xs text-slate-400 leading-relaxed mb-6">
            {language === "km"
              ? "គេហទំព័រនេះសម្រាប់តែសមាជិកគ្រួសារ និងបងប្អូនជីដូនមួយប៉ុណ្ណោះ។ មិនទាមទារពាក្យសម្ងាត់ទេ ប្រព័ន្ធកំពុងនាំលោកអ្នកទៅកាន់មែកធាងគ្រួសារដោយស្វ័យប្រវត្តិ។"
              : "This space is dedicated exclusively to our family and relatives. No password needed, redirecting directly to the family tree."}
          </p>

          <div className="flex justify-center items-center gap-2 mb-6 text-sm text-[#d4af37]">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-xs font-medium">
              {language === "km" ? "កំពុងរៀបចំការតភ្ជាប់..." : "Connecting..."}
            </span>
          </div>

          <Link
            href="/dashboard"
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#fef08a] via-[#d4af37] to-[#b45309] text-slate-950 text-xs font-semibold hover:opacity-95 transition-all shadow-md shadow-[#d4af37]/20"
          >
            <span>{language === "km" ? "ចូលទៅកាន់ដែនគ្រួសារឥឡូវនេះ" : "Open Family Space Now"}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-7xl w-full mx-auto text-center text-xs text-slate-400">
        <p>
          {t.heritage.sacredBonds} • {t.appSubtitle}
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0c0f14] flex items-center justify-center text-[#d4af37]">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      }
    >
      <LoginRedirectContent />
    </Suspense>
  );
}
