"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Navigation } from "@/components/Navigation";
import { useLanguage } from "@/lib/i18n/context";
import { createClient } from "@/lib/supabase/client";
import {
  Plus,
  Users2,
  TreePine,
  ShieldCheck,
  Crown,
  Lock,
  ArrowRight,
  Sparkles,
  BookOpen,
  UserPlus,
  Copy,
  Check,
  X,
} from "lucide-react";

interface FamilySpaceItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  role: "OWNER" | "ADMIN" | "MEMBER";
  memberCount: number;
  peopleCount: number;
  linkedPerson: {
    id: string;
    firstName: string;
    lastName: string;
    photoUrl: string | null;
  } | null;
}

export default function DashboardPage() {
  const { t } = useLanguage();
  const [spaces, setSpaces] = useState<FamilySpaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // New Space Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState("");
  const [newSpaceDesc, setNewSpaceDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Invite Relative Modal State
  const [inviteSpace, setInviteSpace] = useState<FamilySpaceItem | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [inviteResultUrl, setInviteResultUrl] = useState<string | null>(null);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadUserAndSpaces() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          setUserEmail(user.email ?? null);
        }

        const res = await fetch("/api/spaces");
        if (res.ok) {
          const data = await res.json();
          setSpaces(data.spaces || []);
        }
      } catch (err) {
        console.error("Failed to load spaces", err);
      } finally {
        setLoading(false);
      }
    }

    loadUserAndSpaces();
  }, []);

  const handleCreateSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSpaceName.trim()) return;

    setCreating(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newSpaceName.trim(),
          description: newSpaceDesc.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to create space");
      }

      const { space } = await res.json();
      setSpaces((prev) => [
        {
          id: space.id,
          name: space.name,
          slug: space.slug,
          description: space.description,
          role: "OWNER",
          memberCount: 1,
          peopleCount: 0,
          linkedPerson: null,
        },
        ...prev,
      ]);

      setNewSpaceName("");
      setNewSpaceDesc("");
      setShowCreateModal(false);
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message || "Failed to create family space");
    } finally {
      setCreating(false);
    }
  };

  const handleGenerateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteSpace || !inviteEmail.trim()) return;

    setGeneratingInvite(true);
    setInviteError(null);
    setInviteResultUrl(null);
    setCopied(false);

    try {
      const res = await fetch(`/api/spaces/${inviteSpace.id}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
          expiresInDays: 7,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create invitation");
      }

      setInviteResultUrl(data.inviteUrl);
      setInviteEmail("");
    } catch (err: unknown) {
      const e = err as Error;
      setInviteError(e.message || "Failed to create invitation");
    } finally {
      setGeneratingInvite(false);
    }
  };

  const handleCopyLink = () => {
    if (!inviteResultUrl) return;
    navigator.clipboard.writeText(inviteResultUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "OWNER":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <Crown className="w-3 h-3 text-[#d4af37]" />
            {t.spaces.roleOwner}
          </span>
        );
      case "ADMIN":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
            <ShieldCheck className="w-3 h-3 text-blue-400" />
            {t.spaces.roleAdmin}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
            <Users2 className="w-3 h-3 text-slate-400" />
            {t.spaces.roleMember}
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#0c0f14] heritage-bg-pattern flex flex-col">
      <Navigation userEmail={userEmail} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Hero Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#d4af37] mb-2">
              <Sparkles className="w-4 h-4" />
              <span>{t.heritage.sacredBonds}</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold font-heritage tracking-tight text-white mb-2">
              {t.spaces.mySpaces}
            </h1>
            <p className="text-sm text-slate-400 max-w-2xl leading-relaxed">
              {t.tagline}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="self-start md:self-auto inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-950 bg-gradient-to-r from-[#fef08a] via-[#d4af37] to-[#b45309] hover:opacity-95 shadow-md shadow-[#d4af37]/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t.spaces.createSpace}</span>
          </button>
        </div>

        {/* Space List or Empty State */}
        {loading ? (
          <div className="py-24 text-center">
            <div className="w-10 h-10 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-slate-400">{t.auth.loading}</p>
          </div>
        ) : spaces.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-20 h-20 rounded-3xl bg-[#d4af37]/10 border border-[#d4af37]/30 flex items-center justify-center mx-auto mb-6 text-[#d4af37]">
              <TreePine className="w-10 h-10" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">{t.spaces.noSpaces}</h2>
            <p className="text-sm text-slate-400 max-w-md mx-auto mb-8 leading-relaxed">
              {t.spaces.noSpacesDesc}
            </p>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-slate-950 bg-[#d4af37] hover:bg-[#e5c158] transition-all cursor-pointer shadow-lg shadow-[#d4af37]/20"
            >
              <Plus className="w-4 h-4" />
              <span>{t.spaces.createSpaceBtn}</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-8">
            {spaces.map((space) => {
              const canInvite = space.role === "OWNER" || space.role === "ADMIN";
              return (
                <div
                  key={space.id}
                  className="heritage-card p-6 flex flex-col justify-between gold-glow-hover transition-all group"
                >
                  <div>
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-slate-800/90 border border-slate-700/80 flex items-center justify-center text-[#d4af37] group-hover:border-[#d4af37]/50 transition-colors">
                        <BookOpen className="w-6 h-6" />
                      </div>
                      {getRoleBadge(space.role)}
                    </div>

                    <h3 className="text-xl font-bold font-heritage text-white mb-2 group-hover:text-[#d4af37] transition-colors">
                      {space.name}
                    </h3>

                    <p className="text-xs text-slate-400 line-clamp-2 mb-6 min-h-[32px]">
                      {space.description || t.heritage.preserveLegacy}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-slate-800/80 space-y-4">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Users2 className="w-4 h-4 text-slate-500" />
                        {space.memberCount} {t.spaces.membersCount}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <TreePine className="w-4 h-4 text-[#d4af37]" />
                        {space.peopleCount} relatives in tree
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Link
                        href={space.linkedPerson ? `/spaces/${space.id}/tree` : `/spaces/${space.id}/onboarding`}
                        className="py-2.5 px-3 rounded-xl text-xs font-semibold text-slate-200 bg-slate-800/90 hover:bg-[#d4af37] hover:text-slate-950 transition-all flex items-center justify-center gap-1.5 border border-slate-700/60 hover:border-transparent text-center"
                      >
                        <span>{space.linkedPerson ? t.spaces.enterSpace : "Onboard"}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>

                      {canInvite ? (
                        <button
                          type="button"
                          onClick={() => {
                            setInviteSpace(space);
                            setInviteRole("MEMBER");
                            setInviteResultUrl(null);
                            setInviteError(null);
                          }}
                          className="py-2.5 px-3 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-slate-900 border border-slate-700/80 hover:border-[#d4af37]/50 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <UserPlus className="w-3.5 h-3.5 text-[#d4af37]" />
                          <span>Invite</span>
                        </button>
                      ) : (
                        <Link
                          href={`/spaces/${space.id}/onboarding`}
                          className="py-2.5 px-3 rounded-xl text-xs font-medium text-slate-400 hover:text-white bg-slate-900 border border-slate-800 transition-all text-center"
                        >
                          My Lineage
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Security & Lineage Assurance Banner */}
        <div className="mt-16 heritage-card p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">
                {t.spaces.privateBadge}
              </h4>
              <p className="text-xs text-slate-400 mt-1 max-w-xl">
                {t.auth.invitationOnlyNotice}
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Modal: Create Space */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="heritage-card-elevated max-w-md w-full p-6 sm:p-8 relative">
            <h3 className="text-xl font-bold font-heritage text-white mb-2">
              {t.spaces.createSpace}
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              Establish a protected family space for your lineage.
            </p>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-lg bg-rose-950/50 border border-rose-800 text-rose-200 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateSpace} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  {t.spaces.spaceName}
                </label>
                <input
                  type="text"
                  required
                  value={newSpaceName}
                  onChange={(e) => setNewSpaceName(e.target.value)}
                  placeholder="e.g. Ly Family Heritage / ខ្សែស្រឡាយត្រកូលលី"
                  className="w-full px-3.5 py-2.5 bg-slate-900/90 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#d4af37]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  {t.spaces.spaceDesc}
                </label>
                <textarea
                  rows={3}
                  value={newSpaceDesc}
                  onChange={(e) => setNewSpaceDesc(e.target.value)}
                  placeholder="e.g. Tracing ancestors from Battambang and Phnom Penh across 5 generations."
                  className="w-full px-3.5 py-2 bg-slate-900/90 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#d4af37]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 rounded-xl text-xs font-semibold text-slate-950 bg-[#d4af37] hover:bg-[#e5c158] transition-all disabled:opacity-50"
                >
                  {creating ? t.auth.loading : t.spaces.createSpaceBtn}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Invite Relative */}
      {inviteSpace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="heritage-card-elevated max-w-md w-full p-6 sm:p-8 relative">
            <button
              type="button"
              onClick={() => {
                setInviteSpace(null);
                setInviteResultUrl(null);
              }}
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-bold font-heritage text-white mb-1">
              {t.invitations.inviteModalTitle}
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              {t.invitations.inviteModalSubtitle} ({inviteSpace.name})
            </p>

            {inviteError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-950/50 border border-rose-800 text-rose-200 text-xs">
                {inviteError}
              </div>
            )}

            {inviteResultUrl ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-200">
                  <div className="flex items-center gap-2 font-semibold mb-1 text-emerald-300">
                    <Check className="w-4 h-4" />
                    <span>{t.invitations.inviteGenerated}</span>
                  </div>
                  Share this single-use link with your relative. It will expire in 7 days.
                </div>

                <div className="relative">
                  <input
                    type="text"
                    readOnly
                    value={inviteResultUrl}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 font-mono pr-24"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="absolute right-1.5 top-1.5 bottom-1.5 px-3 rounded-lg bg-[#d4af37] text-slate-950 text-xs font-semibold hover:bg-[#e5c158] transition-colors flex items-center gap-1.5"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="pt-4 border-t border-slate-800 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setInviteSpace(null);
                      setInviteResultUrl(null);
                    }}
                    className="px-5 py-2 rounded-xl text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleGenerateInvite} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Relative Email Address <span className="text-[#d4af37]">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder={t.invitations.emailPlaceholder}
                    className="w-full px-3.5 py-2.5 bg-slate-900/90 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#d4af37]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    {t.invitations.roleOffered}
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as "ADMIN" | "MEMBER")}
                    disabled={inviteSpace.role !== "OWNER"}
                    className="w-full px-3.5 py-2.5 bg-slate-900/90 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-[#d4af37]"
                  >
                    <option value="MEMBER">Family Member</option>
                    {inviteSpace.role === "OWNER" && (
                      <option value="ADMIN">Council Guardian (Admin)</option>
                    )}
                  </select>
                  {inviteSpace.role !== "OWNER" && (
                    <span className="text-[10px] text-slate-500 block mt-1">
                      Admins can invite Family Members. Only the Space Owner can invite new Admins.
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setInviteSpace(null)}
                    className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={generatingInvite}
                    className="px-5 py-2 rounded-xl text-xs font-semibold text-slate-950 bg-[#d4af37] hover:bg-[#e5c158] transition-all disabled:opacity-50"
                  >
                    {generatingInvite ? t.auth.loading : t.invitations.sendInviteBtn}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
