"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n/context";
import { createClient } from "@/lib/supabase/client";
import {
  TreePine,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  Compass,
  Users2,
  Scroll,
  BookOpen,
} from "lucide-react";

interface NavigationProps {
  userEmail?: string | null;
  activeSpaceId?: string;
  activeSpaceName?: string;
}

export function Navigation({ userEmail, activeSpaceId, activeSpaceName }: NavigationProps) {
  const { language, setLanguage, t } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } catch (e) {
      console.error("Sign out error", e);
    }
  };

  const navLinks = [
    {
      href: "/dashboard",
      label: t.nav.dashboard,
      icon: Compass,
      show: true,
    },
    {
      href: activeSpaceId ? `/spaces/${activeSpaceId}/tree` : "#",
      label: t.nav.tree,
      icon: TreePine,
      show: !!activeSpaceId,
    },
    {
      href: activeSpaceId ? `/spaces/${activeSpaceId}/relatives` : "#",
      label: t.nav.directory,
      icon: Users2,
      show: !!activeSpaceId,
    },
    {
      href: activeSpaceId ? `/spaces/${activeSpaceId}/memories` : "#",
      label: t.nav.archive,
      icon: BookOpen,
      show: !!activeSpaceId,
    },
    {
      href: activeSpaceId ? `/spaces/${activeSpaceId}/admin` : "#",
      label: t.nav.admin,
      icon: ShieldCheck,
      show: !!activeSpaceId,
    },
  ];

  return (
    <header className="sticky top-0 z-50 bg-[#0c0f14]/85 backdrop-blur-md border-b border-[#d4af37]/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18">
          {/* Logo & Emblem */}
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#d4af37] via-[#b8860b] to-[#78350f] p-[1.5px] shadow-lg shadow-[#d4af37]/15">
              <div className="w-full h-full bg-[#0c0f14] rounded-[10px] flex items-center justify-center group-hover:bg-[#141923] transition-colors">
                <Scroll className="w-5 h-5 text-[#d4af37]" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-heritage text-lg font-bold tracking-wider text-slate-100 group-hover:text-[#d4af37] transition-colors">
                  {t.appName}
                </span>
                {activeSpaceName && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/30">
                    {activeSpaceName}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 font-light hidden sm:block">
                {t.appSubtitle}
              </p>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks
              .filter((item) => item.show)
              .map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? "bg-[#d4af37]/15 text-[#d4af37] border border-[#d4af37]/30 shadow-sm shadow-[#d4af37]/10"
                        : "text-slate-300 hover:text-white hover:bg-slate-800/50"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
          </nav>

          {/* Right Controls: Language & User */}
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

            {userEmail ? (
              <div className="hidden sm:flex items-center gap-3">
                <span className="text-xs text-slate-400 max-w-[140px] truncate">
                  {userEmail}
                </span>
                <button
                  onClick={handleSignOut}
                  title={t.nav.signOut}
                  className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="text-xs px-3.5 py-2 rounded-lg font-medium text-slate-950 bg-[#d4af37] hover:bg-[#e5c158] transition-colors"
              >
                {t.nav.signIn}
              </Link>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-slate-400 hover:text-white"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#0c0f14] border-b border-[#d4af37]/20 px-4 pt-2 pb-4 space-y-1">
          {navLinks
            .filter((item) => item.show)
            .map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-300 hover:bg-slate-800/60"
                >
                  <Icon className="w-5 h-5 text-[#d4af37]" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          {userEmail && (
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400">{userEmail}</span>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1.5 text-xs text-rose-400 hover:underline"
              >
                <LogOut className="w-3.5 h-3.5" />
                {t.nav.signOut}
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
