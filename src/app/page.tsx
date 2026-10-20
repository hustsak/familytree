"use client";

import React from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/context";
import {
  Scroll,
  ShieldCheck,
  Lock,
  ArrowRight,
  Sparkles,
  GitFork,
} from "lucide-react";

export default function HomePage() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className="min-h-screen bg-[#0c0f14] heritage-bg-pattern flex flex-col justify-between">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 bg-[#0c0f14]/85 backdrop-blur-md border-b border-[#d4af37]/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <div className="flex items-center gap-3">
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
          </div>

          <div className="flex items-center gap-3">
            {/* Language Switcher */}
            <div className="flex items-center bg-slate-900/90 rounded-lg p-1 border border-slate-700/60">
              <button
                type="button"
                onClick={() => setLanguage("en")}
                className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                  language === "en"
                    ? "bg-[#d4af37] text-slate-950 font-semibold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLanguage("km")}
                className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                  language === "km"
                    ? "bg-[#d4af37] text-slate-950 font-semibold font-khmer"
                    : "text-slate-400 hover:text-white font-khmer"
                }`}
              >
                ខ្មែរ
              </button>
            </div>

            <Link
              href="/login"
              className="text-xs px-3.5 py-2 rounded-lg font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              {t.nav.signIn}
            </Link>

            <Link
              href="/register"
              className="text-xs px-4 py-2 rounded-lg font-semibold text-slate-950 bg-[#d4af37] hover:bg-[#e5c158] transition-all shadow-sm shadow-[#d4af37]/20"
            >
              {t.nav.register}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/30 text-[#d4af37] text-xs font-semibold uppercase tracking-widest mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{t.heritage.sacredBonds}</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-bold font-heritage tracking-tight text-white max-w-4xl leading-[1.15] mb-6">
          <span className="block">{t.appName}</span>
          <span className="gold-gradient-text text-3xl sm:text-5xl mt-2 block font-normal">
            {t.heritage.honorAncestors}
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-300 max-w-2xl leading-relaxed mb-10">
          {t.tagline}
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 mb-20">
          <Link
            href="/register"
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-semibold text-sm text-slate-950 bg-gradient-to-r from-[#fef08a] via-[#d4af37] to-[#b45309] hover:opacity-95 shadow-lg shadow-[#d4af37]/25 transition-all flex items-center justify-center gap-2"
          >
            <span>{t.spaces.createSpace}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-medium text-sm text-slate-200 bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 transition-all"
          >
            {t.nav.signIn}
          </Link>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl text-left">
          <div className="heritage-card p-6 gold-glow-hover transition-all">
            <div className="w-12 h-12 rounded-xl bg-[#d4af37]/10 border border-[#d4af37]/30 flex items-center justify-center text-[#d4af37] mb-4">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold font-heritage text-white mb-2">
              Private Family Spaces
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Every family space is private and strictly invitation-only. Your living relatives and ancestral records remain isolated from public web indexing.
            </p>
          </div>

          <div className="heritage-card p-6 gold-glow-hover transition-all">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-4">
              <GitFork className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold font-heritage text-white mb-2">
              DAG Lineage & Cycle Prevention
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Strict mathematical graph integrity using database IDs. Never invents relationships, prevents generational cycles, and enforces 2 biological parents maximum.
            </p>
          </div>

          <div className="heritage-card p-6 gold-glow-hover transition-all">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold font-heritage text-white mb-2">
              Council Approval & Audit Trail
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Ambiguous links, duplicate person proposals, and unverified ties require elder or admin council approval before being woven into the family tree.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-8 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>
            &copy; 2026 {t.appName}. {t.heritage.honorAncestors}
          </p>
          <div className="flex items-center gap-6 text-slate-400 text-xs">
            <span>Khmer & English Bilingual</span>
            <span>&bull;</span>
            <span>PostgreSQL & Prisma</span>
            <span>&bull;</span>
            <span>Supabase Auth</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
