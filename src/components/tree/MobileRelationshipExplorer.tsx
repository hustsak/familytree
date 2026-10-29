"use client";

import React, { useMemo, useState } from "react";
import { TreePerson, TreeRelationship } from "@/lib/tree-layout";
import { calculateKinship, KinshipPerson, KinshipRelationship } from "@/lib/kinship";
import { toKhmerNumber } from "@/app/spaces/[spaceId]/tree/page";
import {
  User,
  Users,
  Heart,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Plus,
  Edit3,
  Trash2,
  Sparkles,
  GitBranch,
  Map as MapIcon,
  Award,
  CheckCircle2,
  ArrowUpRight,
  Baby,
  Crown,
} from "lucide-react";

interface MobileRelationshipExplorerProps {
  people: TreePerson[];
  relationships: TreeRelationship[];
  selectedPersonId: string | null;
  linkedPersonId: string | null;
  language: "km" | "en";
  canEdit: boolean;
  canDelete: boolean;
  onSelectPerson: (personId: string) => void;
  onOpenProfileDrawer: (personId: string) => void;
  onEditPerson: (personId: string) => void;
  onDeletePerson: (personId: string) => void;
  onAddRelative: (anchorId: string, presetRel: "CHILD" | "SPOUSE" | "PARENT" | "SIBLING" | "NONE") => void;
  onClaimIdentity: (personId: string) => void;
  onSwitchToMap: (focusPersonId?: string) => void;
}

export function MobileRelationshipExplorer({
  people,
  relationships,
  selectedPersonId,
  linkedPersonId,
  language,
  canEdit,
  canDelete,
  onSelectPerson,
  onOpenProfileDrawer,
  onEditPerson,
  onDeletePerson,
  onAddRelative,
  onClaimIdentity,
  onSwitchToMap,
}: MobileRelationshipExplorerProps) {
  const [viewTab, setViewTab] = useState<"FOCUS" | "GENERATIONS">("FOCUS");
  const [expandedGen, setExpandedGen] = useState<number | null>(null);

  // Build adjacency maps and generation depth map
  const {
    personMap,
    parentsMap,
    childrenMap,
    spousesMap,
    generationMap,
    rootPersonId,
  } = useMemo(() => {
    const pMap = new Map<string, TreePerson>();
    const parMap = new Map<string, TreePerson[]>();
    const chMap = new Map<string, TreePerson[]>();
    const spMap = new Map<string, TreePerson[]>();

    for (const p of people) {
      pMap.set(p.id, p);
      parMap.set(p.id, []);
      chMap.set(p.id, []);
      spMap.set(p.id, []);
    }

    for (const rel of relationships) {
      if (rel.status !== "CONFIRMED") continue;
      const p1 = pMap.get(rel.personId);
      const p2 = pMap.get(rel.relatedPersonId);
      if (!p1 || !p2) continue;

      if (rel.type === "PARENT_CHILD" || rel.type === "ADOPTIVE_PARENT_CHILD") {
        const curCh = chMap.get(p1.id) || [];
        if (!curCh.some((c) => c.id === p2.id)) curCh.push(p2);
        chMap.set(p1.id, curCh);

        const curPar = parMap.get(p2.id) || [];
        if (!curPar.some((pr) => pr.id === p1.id)) curPar.push(p1);
        parMap.set(p2.id, curPar);
      } else if (rel.type === "SPOUSE") {
        const s1 = spMap.get(p1.id) || [];
        if (!s1.some((s) => s.id === p2.id)) s1.push(p2);
        spMap.set(p1.id, s1);

        const s2 = spMap.get(p2.id) || [];
        if (!s2.some((s) => s.id === p1.id)) s2.push(p1);
        spMap.set(p2.id, s2);
      }
    }

    // Compute generations via BFS from root ancestors (people with 0 parents who have children or earliest birthYear)
    const genMap = new Map<string, number>();
    const roots = people.filter((p) => (parMap.get(p.id)?.length || 0) === 0);

    // Pick primary root ancestor (with most descendants or earliest birth year)
    const countDescendants = (id: string, visited = new Set<string>()): number => {
      if (visited.has(id)) return 0;
      visited.add(id);
      let count = 0;
      for (const ch of chMap.get(id) || []) {
        count += 1 + countDescendants(ch.id, visited);
      }
      return count;
    };

    let bestRoot = roots[0]?.id || people[0]?.id || "";
    let bestScore = -1;
    for (const r of roots) {
      const desc = countDescendants(r.id);
      if (desc > bestScore) {
        bestScore = desc;
        bestRoot = r.id;
      }
    }

    if (bestRoot) {
      const queue: { id: string; gen: number }[] = [{ id: bestRoot, gen: 0 }];
      genMap.set(bestRoot, 0);
      while (queue.length > 0) {
        const { id, gen } = queue.shift()!;
        for (const sp of spMap.get(id) || []) {
          if (!genMap.has(sp.id)) {
            genMap.set(sp.id, gen);
            queue.push({ id: sp.id, gen });
          }
        }
        for (const ch of chMap.get(id) || []) {
          if (!genMap.has(ch.id) || (genMap.get(ch.id) ?? 0) < gen + 1) {
            genMap.set(ch.id, gen + 1);
            queue.push({ id: ch.id, gen: gen + 1 });
          }
        }
        for (const pr of parMap.get(id) || []) {
          if (!genMap.has(pr.id)) {
            genMap.set(pr.id, Math.max(0, gen - 1));
            queue.push({ id: pr.id, gen: Math.max(0, gen - 1) });
          }
        }
      }
    }

    // Assign any remaining unvisited people to generation 0
    for (const p of people) {
      if (!genMap.has(p.id)) genMap.set(p.id, 0);
    }

    return {
      personMap: pMap,
      parentsMap: parMap,
      childrenMap: chMap,
      spousesMap: spMap,
      generationMap: genMap,
      rootPersonId: bestRoot,
    };
  }, [people, relationships]);

  // Active person to inspect (defaults to selectedPersonId -> linkedPersonId -> rootPersonId)
  const activePersonId =
    (selectedPersonId && personMap.has(selectedPersonId) ? selectedPersonId : null) ||
    (linkedPersonId && personMap.has(linkedPersonId) ? linkedPersonId : null) ||
    rootPersonId;

  const activePerson = activePersonId ? personMap.get(activePersonId) || null : null;
  const activeGen = activePersonId ? generationMap.get(activePersonId) ?? 0 : 0;

  // Compute direct relatives for activePerson
  const {
    parents,
    grandparents,
    greatGrandparents,
    luotAncestors,
    spouses,
    siblings,
    children,
    grandchildren,
    ancestryChain,
    kinshipToMe,
  } = useMemo(() => {
    if (!activePerson) {
      return {
        parents: [] as TreePerson[],
        grandparents: [] as TreePerson[],
        greatGrandparents: [] as TreePerson[],
        luotAncestors: [] as TreePerson[],
        spouses: [] as TreePerson[],
        siblings: [] as TreePerson[],
        children: [] as TreePerson[],
        grandchildren: [] as TreePerson[],
        ancestryChain: [] as TreePerson[],
        kinshipToMe: null,
      };
    }

    // Helper: get parents of a person AND include their married co-parent spouses
    const getFullParents = (personId: string): TreePerson[] => {
      const directPars = parentsMap.get(personId) || [];
      const fullMap = new Map<string, TreePerson>();
      for (const pr of directPars) {
        fullMap.set(pr.id, pr);
        for (const sp of spousesMap.get(pr.id) || []) {
          fullMap.set(sp.id, sp);
        }
      }
      return Array.from(fullMap.values());
    };

    const pars = getFullParents(activePerson.id);
    const sps = spousesMap.get(activePerson.id) || [];

    // Combine children of activePerson and their spouses so couples see all their children
    const childMapUnique = new Map<string, TreePerson>();
    for (const ch of childrenMap.get(activePerson.id) || []) {
      childMapUnique.set(ch.id, ch);
    }
    for (const sp of sps) {
      for (const ch of childrenMap.get(sp.id) || []) {
        childMapUnique.set(ch.id, ch);
      }
    }
    const chs = Array.from(childMapUnique.values());

    // Grandparents (2 generations up: ជីតា / ជីដូន)
    const gpMap = new Map<string, TreePerson>();
    for (const pr of pars) {
      for (const gp of getFullParents(pr.id)) {
        gpMap.set(gp.id, gp);
      }
    }
    const gps = Array.from(gpMap.values());

    // Great-Grandparents (3 generations up: ទួតប្រុស / ទួតស្រី)
    const ggpMap = new Map<string, TreePerson>();
    for (const gp of gps) {
      for (const ggp of getFullParents(gp.id)) {
        ggpMap.set(ggp.id, ggp);
      }
    }
    const ggps = Array.from(ggpMap.values());

    // 2x Great-Grandparents (4+ generations up, father/mother of ទួត: លួត)
    const luotMap = new Map<string, TreePerson>();
    for (const ggp of ggps) {
      for (const l of getFullParents(ggp.id)) {
        luotMap.set(l.id, l);
      }
    }
    const luots = Array.from(luotMap.values());

    // Siblings
    const sibMap = new Map<string, TreePerson>();
    for (const pr of pars) {
      for (const sib of childrenMap.get(pr.id) || []) {
        if (sib.id !== activePerson.id) {
          sibMap.set(sib.id, sib);
        }
      }
    }

    // Grandchildren
    const gcMap = new Map<string, TreePerson>();
    for (const ch of chs) {
      for (const gc of childrenMap.get(ch.id) || []) {
        gcMap.set(gc.id, gc);
      }
    }

    // Ancestry chain from root down to activePerson
    const chain: TreePerson[] = [activePerson];
    let curr = activePerson;
    const visited = new Set<string>([activePerson.id]);
    while (curr) {
      const currPars = parentsMap.get(curr.id) || [];
      // Prefer parent with higher ancestor chain or biological lineage
      const nextPar =
        currPars.find((p) => (parentsMap.get(p.id)?.length || 0) > 0) || currPars[0];
      if (nextPar && !visited.has(nextPar.id)) {
        visited.add(nextPar.id);
        chain.unshift(nextPar);
        curr = nextPar;
      } else {
        break;
      }
    }

    // Kinship to "Me" (linkedPersonId)
    let kResult = null;
    if (linkedPersonId && personMap.has(linkedPersonId)) {
      kResult = calculateKinship(
        linkedPersonId,
        activePerson.id,
        people as unknown as KinshipPerson[],
        relationships as unknown as KinshipRelationship[]
      );
    }

    return {
      parents: pars,
      grandparents: gps,
      greatGrandparents: ggps,
      luotAncestors: luots,
      spouses: sps,
      siblings: Array.from(sibMap.values()),
      children: chs,
      grandchildren: Array.from(gcMap.values()),
      ancestryChain: chain,
      kinshipToMe: kResult,
    };
  }, [activePerson, parentsMap, spousesMap, childrenMap, linkedPersonId, personMap, people, relationships]);

  // Group all people by Generation for the "All Generations" directory tab
  const generationGroups = useMemo(() => {
    const groups = new Map<number, TreePerson[]>();
    for (const p of people) {
      const g = generationMap.get(p.id) ?? 0;
      const list = groups.get(g) || [];
      list.push(p);
      groups.set(g, list);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0] - b[0]);
  }, [people, generationMap]);

  // Helper to get relation badge between any relative and "Me" (linkedPersonId) or activePerson
  const getKinshipLabel = (targetId: string, baseId: string | null) => {
    if (!baseId || !personMap.has(baseId)) return null;
    if (targetId === baseId) {
      return language === "km" ? "ខ្លួនខ្ញុំ" : "You";
    }
    const res = calculateKinship(
      baseId,
      targetId,
      people as unknown as KinshipPerson[],
      relationships as unknown as KinshipRelationship[]
    );
    if (!res.determined) return null;
    return language === "km" ? res.relationshipNameKm : res.relationshipNameEn;
  };

  const getDisplayName = (p: TreePerson) =>
    p.khmerName?.trim() || `${p.lastName} ${p.firstName}`.trim();

  if (!activePerson) return null;

  return (
    <div className="w-full h-full overflow-y-auto bg-gradient-to-b from-[#eef5ff] via-[#f5f9ff] to-[#ebf3fc] pt-28 pb-28 px-3 font-khmer select-none">
      <div className="max-w-lg mx-auto space-y-3.5">
        {/* Top Segmented Mode Switcher: Family Hub vs All Generations */}
        <div className="bg-white/95 backdrop-blur-md p-1 rounded-2xl border border-[#dbe7f5] shadow-sm flex items-center gap-1">
          <button
            type="button"
            onClick={() => setViewTab("FOCUS")}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              viewTab === "FOCUS"
                ? "bg-gradient-to-r from-[#2f7de1] to-[#1c57b8] text-white shadow-sm"
                : "text-[#475569] hover:bg-[#f1f5f9]"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>{language === "km" ? "មើលខ្សែញាតិផ្ទាល់" : "Family Relationships"}</span>
          </button>
          <button
            type="button"
            onClick={() => setViewTab("GENERATIONS")}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              viewTab === "GENERATIONS"
                ? "bg-gradient-to-r from-[#2f7de1] to-[#1c57b8] text-white shadow-sm"
                : "text-[#475569] hover:bg-[#f1f5f9]"
            }`}
          >
            <Crown className="w-3.5 h-3.5" />
            <span>
              {language === "km"
                ? `គ្រប់ជំនាន់ (${toKhmerNumber(generationGroups.length)})`
                : `By Generation (${generationGroups.length})`}
            </span>
          </button>
        </div>

        {viewTab === "FOCUS" ? (
          <>
            {/* 1. Breadcrumb Lineage Path from Root Ancestor down to Selected Person */}
            {ancestryChain.length > 1 && (
              <div className="bg-white/90 backdrop-blur-xs px-3 py-2.5 rounded-2xl border border-[#dbe7f5] shadow-2xs">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10.5px] font-bold text-[#6a7f99] uppercase tracking-wider flex items-center gap-1">
                    <GitBranch className="w-3 h-3 text-[#2f7de1]" />
                    <span>
                      {language === "km"
                        ? "ខ្សែស្រឡាយពីបុព្វបុរសដើម (ចុចដើម្បីផ្លាស់ប្តូរ)"
                        : "Ancestry Path (Tap any ancestor)"}
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
                  {ancestryChain.map((anc, idx) => {
                    const isCurrent = anc.id === activePerson.id;
                    const ancGen = generationMap.get(anc.id) ?? idx;
                    return (
                      <React.Fragment key={anc.id}>
                        <button
                          type="button"
                          onClick={() => onSelectPerson(anc.id)}
                          className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold shrink-0 flex items-center gap-1 transition-all cursor-pointer border ${
                            isCurrent
                              ? "bg-[#2f7de1] text-white border-[#2f7de1] shadow-xs"
                              : "bg-[#f8fbff] text-[#1c2e48] border-[#dbe7f5] hover:bg-[#ebf3fc]"
                          }`}
                        >
                          <span
                            className={`text-[9.5px] px-1 rounded ${
                              isCurrent
                                ? "bg-white/20 text-white"
                                : "bg-[#e0f2fe] text-[#0284c7]"
                            }`}
                          >
                            ជំនាន់ {toKhmerNumber(ancGen + 1)}
                          </span>
                          <span>{getDisplayName(anc)}</span>
                        </button>
                        {idx < ancestryChain.length - 1 && (
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. Upward Lineage: លួត -> ទួត -> ជីដូនជីតា -> ឪពុកម្តាយ */}
            <div className="bg-white rounded-2xl border border-[#dbe7f5] p-3.5 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                  <h3 className="text-xs font-bold text-[#1c2e48] leading-relaxed py-0.5">
                    {language === "km"
                      ? "បុព្វការីជន (ឪពុកម្តាយ • ជីដូនជីតា • ទួត • លួត)"
                      : "Ancestors (Parents • Grandparents • Great-Grandparents)"}
                  </h3>
                </div>
                {parents.length < 2 && (
                  <button
                    type="button"
                    onClick={() => onAddRelative(activePerson.id, "PARENT")}
                    className="px-2.5 py-1 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[10.5px] font-bold flex items-center gap-1 cursor-pointer shrink-0 leading-relaxed"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{language === "km" ? "បន្ថែមឪពុកម្តាយ" : "Add Parent"}</span>
                  </button>
                )}
              </div>

              {/* លួត (Father/Mother of ទួត - 4+ gens up) */}
              {luotAncestors.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pb-1.5 border-b border-slate-100">
                  {luotAncestors.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => onSelectPerson(l.id)}
                      className="px-2.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100/80 border border-purple-200 text-purple-950 text-[11px] font-medium flex items-center gap-1.5 cursor-pointer leading-relaxed"
                    >
                      <span className="px-1.5 py-0.5 rounded bg-purple-200/80 text-purple-900 text-[10px] font-bold leading-relaxed">
                        {language === "km" ? "លួត" : "2x Great-Grandparent"}
                      </span>
                      <span className="font-bold leading-relaxed">{getDisplayName(l)}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* ទួត (Great-Grandparents - 3 gens up) */}
              {greatGrandparents.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pb-1.5 border-b border-slate-100">
                  {greatGrandparents.map((ggp) => (
                    <button
                      key={ggp.id}
                      type="button"
                      onClick={() => onSelectPerson(ggp.id)}
                      className="px-2.5 py-1.5 rounded-xl bg-indigo-50/80 hover:bg-indigo-100/80 border border-indigo-200 text-indigo-950 text-[11px] font-medium flex items-center gap-1.5 cursor-pointer leading-relaxed"
                    >
                      <span className="px-1.5 py-0.5 rounded bg-indigo-200/70 text-indigo-900 text-[10px] font-bold leading-relaxed">
                        {ggp.gender === "FEMALE"
                          ? language === "km"
                            ? "ទួតស្រី"
                            : "Great-Grandmother"
                          : ggp.gender === "MALE"
                          ? language === "km"
                            ? "ទួតប្រុស"
                            : "Great-Grandfather"
                          : language === "km"
                          ? "ទួត"
                          : "Great-Grandparent"}
                      </span>
                      <span className="font-bold leading-relaxed">{getDisplayName(ggp)}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* ជីតា / ជីដូន (Grandparents - 2 gens up) */}
              {grandparents.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pb-1.5 border-b border-slate-100">
                  {grandparents.map((gp) => (
                    <button
                      key={gp.id}
                      type="button"
                      onClick={() => onSelectPerson(gp.id)}
                      className="px-2.5 py-1.5 rounded-xl bg-amber-50/70 hover:bg-amber-100/80 border border-amber-200/80 text-amber-950 text-[11px] font-medium flex items-center gap-1.5 cursor-pointer leading-relaxed"
                    >
                      <span className="px-1.5 py-0.5 rounded bg-amber-200/70 text-amber-900 text-[10px] font-bold leading-relaxed">
                        {gp.gender === "FEMALE"
                          ? language === "km"
                            ? "ជីដូន"
                            : "Grandmother"
                          : language === "km"
                          ? "ជីតា"
                          : "Grandfather"}
                      </span>
                      <span className="font-bold leading-relaxed">{getDisplayName(gp)}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* ឪពុក / ម្តាយ (Parents - 1 gen up) */}
              {parents.length === 0 ? (
                <div className="py-2.5 text-center text-[11px] text-slate-400 bg-slate-50/70 rounded-xl border border-dashed border-slate-200 leading-relaxed">
                  {language === "km"
                    ? "បុព្វបុរសដើម ឬមិនទាន់មានទិន្នន័យឪពុកម្តាយ"
                    : "Root ancestor or no parents recorded yet"}
                </div>
              ) : (
                <div className="grid grid-cols-1 xs:grid-cols-2 gap-2">
                  {parents.map((pr) => {
                    const roleBadge =
                      pr.gender === "FEMALE"
                        ? language === "km"
                          ? "ម្តាយ (Mother)"
                          : "Mother"
                        : pr.gender === "MALE"
                        ? language === "km"
                          ? "ឪពុក (Father)"
                          : "Father"
                        : language === "km"
                        ? "ឪពុកម្តាយ"
                        : "Parent";
                    return (
                      <button
                        key={pr.id}
                        type="button"
                        onClick={() => onSelectPerson(pr.id)}
                        className="p-2.5 rounded-xl bg-[#f8fbff] hover:bg-[#ebf3fc] border border-[#dbe7f5] flex items-center justify-between text-left transition-all active:scale-[0.99] cursor-pointer"
                      >
                        <div className="min-w-0 flex-1 pr-1">
                          <span className="inline-block px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[10px] font-bold mb-1 leading-relaxed">
                            {roleBadge}
                          </span>
                          <p className="text-xs font-bold text-[#1c2e48] break-words leading-relaxed py-0.5">
                            {getDisplayName(pr)}
                          </p>
                          <p className="text-[10px] text-[#6a7f99] leading-relaxed">
                            ជំនាន់ទី {toKhmerNumber((generationMap.get(pr.id) ?? 0) + 1)}
                            {pr.birthYear ? ` • ${pr.birthYear}` : ""}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-[#2f7de1] shrink-0" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 3. Selected Person Center Hero Card (Clear Identity & Relationship to User) */}
            <div className="relative rounded-3xl bg-gradient-to-br from-[#1e3a8a] via-[#1d4ed8] to-[#0284c7] text-white p-4 shadow-xl shadow-blue-600/20 border border-blue-400/30">
              {/* Top Row: Generation Pill + Relationship to "Me" Badge */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-1.5">
                  <span className="px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-xs text-white text-[11px] font-bold border border-white/25 leading-relaxed">
                    ជំនាន់ទី {toKhmerNumber(activeGen + 1)}
                  </span>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold border leading-relaxed ${
                      activePerson.isLiving
                        ? "bg-emerald-400/20 text-emerald-100 border-emerald-300/40"
                        : "bg-slate-200/20 text-slate-200 border-slate-300/30"
                    }`}
                  >
                    {activePerson.isLiving
                      ? language === "km"
                        ? "នៅរស់"
                        : "Living"
                      : language === "km"
                      ? "ទទួលមរណភាព"
                      : "Deceased"}
                  </span>
                </div>

                {/* Quick Switch to Full Visual Tree Canvas */}
                <button
                  type="button"
                  onClick={() => onSwitchToMap(activePerson.id)}
                  className="px-2.5 py-1 rounded-full bg-white/15 hover:bg-white/25 text-white text-[10.5px] font-semibold flex items-center gap-1 border border-white/25 cursor-pointer leading-relaxed"
                >
                  <MapIcon className="w-3 h-3" />
                  <span>{language === "km" ? "មើលលើផែនទីដើមឈើ" : "View on Map"}</span>
                </button>
              </div>

              {/* Main Person Title */}
              <div className="flex items-start gap-3.5">
                <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-md border-2 border-amber-300/80 flex items-center justify-center shrink-0 shadow-md overflow-hidden mt-0.5">
                  {activePerson.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={activePerson.photoUrl}
                      alt={getDisplayName(activePerson)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-7 h-7 text-amber-300" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h2 className="text-lg font-extrabold leading-relaxed py-0.5 break-words">
                      {getDisplayName(activePerson)}
                    </h2>
                    {linkedPersonId === activePerson.id && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-extrabold shrink-0 leading-relaxed">
                        {language === "km" ? "ខ្លួនខ្ញុំ" : "ME"}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-blue-100 mt-0.5 leading-relaxed">
                    {activePerson.gender === "MALE"
                      ? language === "km"
                        ? "ភេទប្រុស"
                        : "Male"
                      : activePerson.gender === "FEMALE"
                      ? language === "km"
                        ? "ភេទស្រី"
                        : "Female"
                      : language === "km"
                      ? "សមាជិកគ្រួសារ"
                      : "Family Member"}
                    {activePerson.birthYear ? ` • កើតឆ្នាំ ${activePerson.birthYear}` : ""}
                    {!activePerson.isLiving && activePerson.deathYear
                      ? ` - ${activePerson.deathYear}`
                      : ""}
                  </p>
                  {/* Direct Family Role Summary (Spouse / Parent / Children) */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    {spouses.length > 0 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-400/25 border border-rose-300/40 text-rose-100 text-[10.5px] font-bold leading-relaxed">
                        <span>
                          {activePerson.gender === "FEMALE"
                            ? language === "km"
                              ? `ភរិយារបស់ ${spouses.map(getDisplayName).join(", ")}`
                              : `Wife of ${spouses.map(getDisplayName).join(", ")}`
                            : activePerson.gender === "MALE"
                            ? language === "km"
                              ? `ស្វាមីរបស់ ${spouses.map(getDisplayName).join(", ")}`
                              : `Husband of ${spouses.map(getDisplayName).join(", ")}`
                            : `${spouses.map(getDisplayName).join(", ")}`}
                        </span>
                      </span>
                    )}
                    {children.length > 0 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-400/20 border border-emerald-300/35 text-emerald-100 text-[10.5px] font-bold leading-relaxed">
                        <span>
                          {activePerson.gender === "FEMALE"
                            ? language === "km"
                              ? `ម្តាយរបស់កូន ${toKhmerNumber(children.length)} នាក់`
                              : `Mother of ${children.length}`
                            : activePerson.gender === "MALE"
                            ? language === "km"
                              ? `ឪពុករបស់កូន ${toKhmerNumber(children.length)} នាក់`
                              : `Father of ${children.length}`
                            : language === "km"
                            ? `មានកូន ${toKhmerNumber(children.length)} នាក់`
                            : `${children.length} children`}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Automatic Kinship Banner: "How is this person related to ME?" with inline identity selector */}
              <div className="mt-3 pt-2.5 border-t border-white/15 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2 bg-white/10 rounded-xl px-3 py-2.5 border border-white/15">
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    <Sparkles className="w-4 h-4 text-amber-300 shrink-0 mt-1" />
                    <div className="text-xs min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1 text-blue-100 text-[11px] mb-1 leading-relaxed">
                        <span>
                          {language === "km" ? "ត្រូវជាអ្វីនឹងអ្នក (" : "Relation to you ("}
                        </span>
                        <select
                          value={linkedPersonId || ""}
                          onChange={(e) => {
                            if (e.target.value) onClaimIdentity(e.target.value);
                          }}
                          className="bg-white/15 text-amber-200 font-bold rounded-lg px-2 py-1 text-[11px] border border-white/25 focus:outline-none cursor-pointer max-w-[180px] leading-relaxed"
                          title={language === "km" ? "ជ្រើសរើសឈ្មោះរបស់អ្នក" : "Select your identity"}
                        >
                          <option value="" className="text-slate-900">
                            {language === "km" ? "-- ជ្រើសរើសឈ្មោះអ្នក --" : "-- Select Yourself --"}
                          </option>
                          {people.map((p) => (
                            <option key={p.id} value={p.id} className="text-slate-900">
                              {getDisplayName(p)}
                            </option>
                          ))}
                        </select>
                        <span>)៖</span>
                      </div>
                      {linkedPersonId ? (
                        linkedPersonId === activePerson.id ? (
                          <span className="inline-block font-extrabold text-amber-300 text-sm leading-relaxed py-0.5">
                            {language === "km" ? "ខ្លួនអ្នកផ្ទាល់ (Self)" : "Yourself (Self)"}
                          </span>
                        ) : kinshipToMe && kinshipToMe.determined ? (
                          <span className="inline-block font-extrabold text-amber-300 text-sm leading-relaxed py-0.5">
                            {language === "km"
                              ? kinshipToMe.relationshipNameKm
                              : kinshipToMe.relationshipNameEn}
                          </span>
                        ) : (
                          <span className="inline-block text-blue-200 text-xs leading-relaxed py-0.5">
                            {language === "km" ? "សាច់ញាតិក្នុងគ្រួសារ" : "Family Relative"}
                          </span>
                        )
                      ) : (
                        <span className="inline-block text-amber-200 text-[11px] font-semibold leading-relaxed py-0.5">
                          {language === "km"
                            ? "សូមជ្រើសរើសឈ្មោះអ្នកខាងលើ ឬចុច «ជាខ្លួនខ្ញុំ»"
                            : "Select your name above or tap 'Me'"}
                        </span>
                      )}
                    </div>
                  </div>
                  {linkedPersonId &&
                    linkedPersonId !== activePerson.id &&
                    kinshipToMe &&
                    kinshipToMe.determined && (
                      <span className="px-2 py-1 rounded-lg bg-white/15 text-[10px] font-semibold shrink-0 leading-relaxed">
                        {kinshipToMe.degreeOfSeparation}{" "}
                        {language === "km" ? "ជំហាន" : "steps"}
                      </span>
                    )}
                </div>
              </div>

              {/* Action Buttons Bar inside Hero Card */}
              <div className="mt-3 grid grid-cols-2 xs:grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => onAddRelative(activePerson.id, "CHILD")}
                  className="py-2 px-2 rounded-xl bg-white text-[#1e3a8a] font-bold text-[11px] flex items-center justify-center gap-1 shadow-xs active:scale-95 cursor-pointer leading-relaxed"
                >
                  <Plus className="w-3.5 h-3.5 text-[#2f7de1] shrink-0" />
                  <span>{language === "km" ? "បន្ថែមកូន" : "+ Child"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onAddRelative(activePerson.id, "SPOUSE")}
                  className="py-2 px-2 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-[11px] flex items-center justify-center gap-1 border border-white/20 active:scale-95 cursor-pointer leading-relaxed"
                >
                  <Plus className="w-3.5 h-3.5 text-sky-200 shrink-0" />
                  <span>{language === "km" ? "ប្តី/ប្រពន្ធ" : "Spouse"}</span>
                </button>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => onEditPerson(activePerson.id)}
                    className="py-2 px-2 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-[11px] flex items-center justify-center gap-1 border border-white/20 active:scale-95 cursor-pointer leading-relaxed"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                    <span>{language === "km" ? "កែប្រែ" : "Edit"}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    linkedPersonId === activePerson.id
                      ? onOpenProfileDrawer(activePerson.id)
                      : onClaimIdentity(activePerson.id)
                  }
                  className="py-2 px-2 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-[11px] flex items-center justify-center gap-1 border border-white/20 active:scale-95 cursor-pointer leading-relaxed"
                >
                  <User className="w-3.5 h-3.5 text-sky-200 shrink-0" />
                  <span>
                    {linkedPersonId === activePerson.id
                      ? language === "km"
                        ? "លម្អិត"
                        : "Details"
                      : language === "km"
                      ? "ជាខ្លួនខ្ញុំ"
                      : "This is Me"}
                  </span>
                </button>
              </div>
            </div>

            {/* 4. Spouses & Siblings Section (Same Generation) */}
            <div className="grid grid-cols-1 gap-3">
              {/* Spouse Card */}
              <div className="bg-white rounded-2xl border border-rose-200/90 p-3.5 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                    <h3 className="text-xs font-bold text-[#1c2e48] leading-relaxed py-0.5">
                      {language === "km"
                        ? `ស្វាមី / ភរិយា (${toKhmerNumber(spouses.length)})`
                        : `Spouse / Partner (${spouses.length})`}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => onAddRelative(activePerson.id, "SPOUSE")}
                    className="px-2.5 py-1 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[10.5px] font-bold flex items-center gap-1 cursor-pointer leading-relaxed"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{language === "km" ? "បន្ថែមប្តី/ប្រពន្ធ" : "Add Spouse"}</span>
                  </button>
                </div>

                {spouses.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic py-1 leading-relaxed">
                    {language === "km" ? "មិនទាន់មានទិន្នន័យប្តី/ប្រពន្ធ" : "No spouse recorded"}
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {spouses.map((sp) => (
                      <div
                        key={sp.id}
                        onClick={() => onSelectPerson(sp.id)}
                        className="p-2.5 rounded-xl bg-rose-50/60 hover:bg-rose-100/70 border border-rose-200/80 flex items-center justify-between cursor-pointer transition-all"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-300 flex items-center justify-center text-rose-600 font-bold text-xs shrink-0">
                            <User className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="inline-block px-2 py-0.5 rounded bg-rose-200/80 text-rose-900 text-[9.5px] font-bold leading-relaxed">
                              {sp.gender === "FEMALE"
                                ? language === "km"
                                  ? "ភរិយា / ប្រពន្ធ"
                                  : "Wife"
                                : sp.gender === "MALE"
                                ? language === "km"
                                  ? "ស្វាមី / ប្តី"
                                  : "Husband"
                                : language === "km"
                                ? "ដៃគូជីវិត"
                                : "Spouse"}
                            </span>
                            <p className="text-xs font-bold text-rose-950 break-words leading-relaxed py-0.5 mt-0.5">
                              {getDisplayName(sp)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {canEdit && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditPerson(sp.id);
                              }}
                              className="p-1.5 rounded-lg hover:bg-rose-200/60 text-rose-700"
                              title="កែប្រែ"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <ChevronRight className="w-4 h-4 text-rose-500" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Siblings Card */}
              {siblings.length > 0 && (
                <div className="bg-white rounded-2xl border border-[#dbe7f5] p-3.5 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                      <h3 className="text-xs font-bold text-[#1c2e48] leading-relaxed py-0.5">
                        {language === "km"
                          ? `បងប្អូនបង្កើតរួមឪពុកម្តាយ (${toKhmerNumber(siblings.length)} នាក់)`
                          : `Siblings (${siblings.length})`}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => onAddRelative(activePerson.id, "SIBLING")}
                      className="px-2.5 py-1 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10.5px] font-bold flex items-center gap-1 cursor-pointer leading-relaxed shrink-0"
                    >
                      <Plus className="w-3 h-3" />
                      <span>{language === "km" ? "បន្ថែមបងប្អូន" : "Add Sibling"}</span>
                    </button>
                  </div>

                  <div className="flex gap-2 overflow-x-auto pb-1.5 no-scrollbar">
                    {siblings.map((sib) => {
                      const sibChildren = childrenMap.get(sib.id)?.length || 0;
                      return (
                        <button
                          key={sib.id}
                          type="button"
                          onClick={() => onSelectPerson(sib.id)}
                          className="min-w-[155px] p-2.5 rounded-xl bg-indigo-50/40 hover:bg-indigo-50 border border-indigo-200/70 text-left shrink-0 transition-all cursor-pointer"
                        >
                          <span className="inline-block px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[9.5px] font-bold leading-relaxed">
                            {sib.gender === "FEMALE"
                              ? language === "km"
                                ? "បងប្អូនស្រី"
                                : "Sister"
                              : sib.gender === "MALE"
                              ? language === "km"
                                ? "បងប្អូនប្រុស"
                                : "Brother"
                              : language === "km"
                              ? "បងប្អូន"
                              : "Sibling"}
                          </span>
                          <p className="text-xs font-bold text-[#1c2e48] break-words leading-relaxed py-0.5 mt-1">
                            {getDisplayName(sib)}
                          </p>
                          <p className="text-[10px] text-[#6a7f99] mt-0.5 leading-relaxed">
                            {sibChildren > 0
                              ? `${toKhmerNumber(sibChildren)} កូន`
                              : language === "km"
                              ? "ចុចមើលគ្រួសារ"
                              : "Tap to view"}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 5. Children & Grandchildren Section (Downward Lineage) */}
            <div className="bg-white rounded-2xl border border-emerald-200/90 p-3.5 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <h3 className="text-xs font-bold text-[#1c2e48] leading-relaxed py-0.5">
                    {language === "km"
                      ? `កូនបង្កើត (${toKhmerNumber(children.length)} នាក់)`
                      : `Children (${children.length})`}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => onAddRelative(activePerson.id, "CHILD")}
                  className="px-2.5 py-1 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10.5px] font-bold flex items-center gap-1 cursor-pointer leading-relaxed"
                >
                  <Plus className="w-3 h-3" />
                  <span>{language === "km" ? "បន្ថែមកូន" : "Add Child"}</span>
                </button>
              </div>

              {children.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-400 bg-slate-50/70 rounded-xl border border-dashed border-slate-200 leading-relaxed">
                  <p>
                    {language === "km"
                      ? "មិនទាន់មានកូនកត់ត្រាទេ — ចុច «+ បន្ថែមកូន» ដើម្បីបន្តមែកធាង"
                      : "No children recorded yet — Tap '+ Add Child' to extend this branch"}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {children.map((ch, idx) => {
                    const chSpouses = spousesMap.get(ch.id) || [];
                    const chChildren = childrenMap.get(ch.id) || [];
                    const relToUser = getKinshipLabel(ch.id, linkedPersonId);

                    return (
                      <div
                        key={ch.id}
                        onClick={() => onSelectPerson(ch.id)}
                        className="p-3 rounded-2xl bg-gradient-to-r from-[#f8fbff] to-white hover:from-[#ebf3fc] border border-[#dbe7f5] flex items-center justify-between gap-2 transition-all active:scale-[0.99] cursor-pointer shadow-2xs"
                      >
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <div className="w-7 h-7 rounded-xl bg-emerald-100 border border-emerald-200 text-emerald-800 font-extrabold text-xs flex items-center justify-center shrink-0 mt-0.5">
                            {toKhmerNumber(idx + 1)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-bold text-xs sm:text-sm text-[#1c2e48] break-words leading-relaxed py-0.5">
                                {getDisplayName(ch)}
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[9.5px] font-bold leading-relaxed">
                                {ch.gender === "FEMALE"
                                  ? language === "km"
                                    ? "កូនស្រី"
                                    : "Daughter"
                                  : ch.gender === "MALE"
                                  ? language === "km"
                                    ? "កូនប្រុស"
                                    : "Son"
                                  : language === "km"
                                  ? "កូន"
                                  : "Child"}
                              </span>
                              {relToUser && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[9.5px] font-bold leading-relaxed">
                                  ត្រូវជា៖ {relToUser}
                                </span>
                              )}
                            </div>

                            {/* Child's Spouse & Grandchildren count */}
                            <div className="flex flex-wrap items-center gap-2 mt-1 text-[10.5px] text-[#6a7f99] leading-relaxed">
                              {chSpouses.length > 0 && (
                                <span className="inline-flex items-center gap-1 text-rose-600 font-medium leading-relaxed">
                                  <span>
                                    ប្តី/ប្រពន្ធ៖ {chSpouses.map((s) => getDisplayName(s)).join(", ")}
                                  </span>
                                </span>
                              )}
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold leading-relaxed">
                                {chChildren.length > 0
                                  ? `${toKhmerNumber(chChildren.length)} កូន (ចៅ)`
                                  : "0 កូន"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {canEdit && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditPerson(ch.id);
                              }}
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
                              title="កែប្រែ"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <ChevronRight className="w-4 h-4 text-[#2f7de1]" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Grandchildren summary pill */}
              {grandchildren.length > 0 && (
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-[#475569]">
                  <span>
                    {language === "km"
                      ? `សរុបចៅៗក្នុងមែកធាងនេះ៖ ${toKhmerNumber(grandchildren.length)} នាក់`
                      : `Total Grandchildren in this branch: ${grandchildren.length}`}
                  </span>
                  <span className="text-[10px] text-[#2f7de1] font-semibold">
                    {language === "km" ? "ចុចលើកូនដើម្បីមើលចៅ →" : "Tap a child to view →"}
                  </span>
                </div>
              )}
            </div>
          </>
        ) : (
          /* ALL GENERATIONS ACCORDION VIEW */
          <div className="space-y-2.5">
            {generationGroups.map(([genNum, genPeople]) => {
              const isOpen = expandedGen === null || expandedGen === genNum;
              return (
                <div
                  key={genNum}
                  className="bg-white rounded-2xl border border-[#dbe7f5] shadow-xs overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedGen(isOpen && expandedGen === genNum ? -1 : genNum)}
                    className="w-full px-4 py-3 bg-gradient-to-r from-[#f8fbff] to-white flex items-center justify-between text-left border-b border-[#ebf3fc] cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                          genNum === 0
                            ? "bg-amber-100 text-amber-900 border border-amber-300"
                            : "bg-[#e0f2fe] text-[#0284c7] border border-[#bae6fd]"
                        }`}
                      >
                        ជំនាន់ទី {toKhmerNumber(genNum + 1)}
                      </span>
                      <span className="text-xs font-bold text-[#1c2e48]">
                        {genNum === 0
                          ? language === "km"
                            ? "មេគ្រួសារដើម (Root Ancestors)"
                            : "Root Ancestors"
                          : language === "km"
                          ? `សមាជិកជំនាន់ទី ${toKhmerNumber(genNum + 1)}`
                          : `Generation ${genNum + 1}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold">
                        {toKhmerNumber(genPeople.length)} {language === "km" ? "នាក់" : ""}
                      </span>
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4 text-slate-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-500" />
                      )}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="p-2.5 divide-y divide-slate-100">
                      {genPeople.map((p) => {
                        const pParents = parentsMap.get(p.id) || [];
                        const pSpouses = spousesMap.get(p.id) || [];
                        const pChildren = childrenMap.get(p.id) || [];
                        const relToMe = getKinshipLabel(p.id, linkedPersonId);

                        return (
                          <div
                            key={p.id}
                            onClick={() => {
                              onSelectPerson(p.id);
                              setViewTab("FOCUS");
                            }}
                            className="py-2.5 px-2 hover:bg-[#f8fbff] rounded-xl flex items-center justify-between gap-2 cursor-pointer transition-colors"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-bold text-xs text-[#1c2e48]">
                                  {getDisplayName(p)}
                                </span>
                                {relToMe && (
                                  <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 text-[9.5px] font-bold">
                                    {relToMe}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-[#6a7f99] mt-0.5">
                                {pParents.length > 0 && (
                                  <span>
                                    កូនរបស់៖{" "}
                                    <strong className="text-slate-700">
                                      {pParents.map((pr) => getDisplayName(pr)).join(" & ")}
                                    </strong>
                                  </span>
                                )}
                                {pSpouses.length > 0 && (
                                  <span className="text-rose-600">
                                    • ប្តី/ប្រពន្ធ៖ {pSpouses.map((s) => getDisplayName(s)).join(", ")}
                                  </span>
                                )}
                                {pChildren.length > 0 && (
                                  <span className="text-emerald-700 font-semibold">
                                    • {toKhmerNumber(pChildren.length)} កូន
                                  </span>
                                )}
                              </div>
                            </div>
                            <ArrowUpRight className="w-4 h-4 text-[#2f7de1] shrink-0" />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

