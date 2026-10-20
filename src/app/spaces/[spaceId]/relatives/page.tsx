"use client";

import React, { useState, useEffect, use, Suspense } from "react";
import Link from "next/link";
import { Navigation } from "@/components/Navigation";
import { useLanguage } from "@/lib/i18n/context";
import { TreePerson } from "@/lib/tree-layout";
import {
  Users2,
  Search,
  TreePine,
  User,
  Calendar,
  ArrowRight,
} from "lucide-react";

function RelativesDirectoryContent({ spaceId }: { spaceId: string }) {
  const { t } = useLanguage();

  const [people, setPeople] = useState<TreePerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterLiving, setFilterLiving] = useState<"ALL" | "LIVING" | "DECEASED">("ALL");

  useEffect(() => {
    async function loadDirectory() {
      try {
        setLoading(true);
        const res = await fetch(`/api/spaces/${spaceId}/tree`);
        if (res.ok) {
          const data = await res.json();
          setPeople(data.people || []);
        }
      } catch (err) {
        console.error("Directory error", err);
      } finally {
        setLoading(false);
      }
    }

    loadDirectory();
  }, [spaceId]);

  const filteredPeople = people.filter((p) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      p.firstName.toLowerCase().includes(q) ||
      p.lastName.toLowerCase().includes(q) ||
      (p.khmerName && p.khmerName.includes(q));

    const matchesLiving =
      filterLiving === "ALL" ||
      (filterLiving === "LIVING" && p.isLiving) ||
      (filterLiving === "DECEASED" && !p.isLiving);

    return matchesSearch && matchesLiving;
  });

  return (
    <div className="min-h-screen bg-[#0c0f14] heritage-bg-pattern flex flex-col">
      <Navigation activeSpaceId={spaceId} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-8 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#d4af37] mb-2">
              <Users2 className="w-4 h-4" />
              <span>{t.nav.directory}</span>
            </div>
            <h1 className="text-3xl font-bold font-heritage tracking-tight text-white mb-1">
              Family Relatives Registry
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Browse, search, and navigate across all verified individuals in this lineage.
            </p>
          </div>

          <Link
            href={`/spaces/${spaceId}/tree`}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-950 bg-[#d4af37] hover:bg-[#e5c158] transition-all flex items-center gap-2 shadow-md shadow-[#d4af37]/20 shrink-0 self-start sm:self-auto"
          >
            <TreePine className="w-4 h-4" />
            <span>Open Interactive Tree</span>
          </Link>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="my-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search relatives by Latin or Khmer name..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#d4af37]"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-900/90 rounded-xl p-1 border border-slate-800 self-stretch sm:self-auto justify-center">
            {(["ALL", "LIVING", "DECEASED"] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setFilterLiving(filter)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filterLiving === filter
                    ? "bg-[#d4af37] text-slate-950 font-semibold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {filter === "ALL" ? "All Relatives" : filter === "LIVING" ? "Living" : "Ancestors"}
              </button>
            ))}
          </div>
        </div>

        {/* Directory Grid */}
        {loading ? (
          <div className="py-24 text-center">
            <div className="w-10 h-10 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-xs text-slate-400">{t.auth.loading}</p>
          </div>
        ) : filteredPeople.length === 0 ? (
          <div className="py-20 text-center heritage-card p-8">
            <Users2 className="w-12 h-12 text-slate-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white mb-1">No Relatives Found</h3>
            <p className="text-xs text-slate-400">
              No individuals match your current search or status filter.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPeople.map((person) => (
              <div
                key={person.id}
                className="heritage-card p-5 gold-glow-hover transition-all flex flex-col justify-between"
              >
                <div className="flex items-start gap-3.5 mb-4">
                  <div className="w-12 h-12 rounded-full border-2 border-[#d4af37]/30 overflow-hidden bg-slate-900 flex items-center justify-center shrink-0">
                    {person.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={person.photoUrl}
                        alt={person.firstName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-6 h-6 text-[#d4af37]" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold font-heritage text-white truncate">
                      {person.firstName} {person.lastName}
                    </h3>
                    {person.khmerName && (
                      <p className="text-xs text-slate-400 font-khmer truncate">
                        {person.khmerName}
                      </p>
                    )}
                    <span
                      className={`inline-block text-[10px] px-2 py-0.5 rounded-full mt-1.5 font-medium border ${
                        person.isLiving
                          ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                          : "bg-slate-800 text-slate-400 border-slate-700"
                      }`}
                    >
                      {person.isLiving ? "Living" : "Deceased"}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1.5 text-[11px]">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    {person.birthYear || "—"} - {person.deathYear || (person.isLiving ? "Present" : "—")}
                  </span>

                  <Link
                    href={`/spaces/${spaceId}/tree`}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-[#d4af37] hover:underline"
                  >
                    <span>View in Tree</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function RelativesParamResolver({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = use(params);
  return <RelativesDirectoryContent spaceId={spaceId} />;
}

export default function RelativesPage({
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
      <RelativesParamResolver params={params} />
    </Suspense>
  );
}
