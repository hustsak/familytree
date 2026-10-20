"use client";

import React, { useState, useEffect, use, useMemo, useCallback, Suspense } from "react";
import Link from "next/link";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  Node,
  Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { Navigation } from "@/components/Navigation";
import { HeritagePersonNode } from "@/components/tree/PersonNode";
import { computeTreeLayout, TreePerson, TreeRelationship } from "@/lib/tree-layout";
import { KinshipResult } from "@/lib/kinship";
import { useLanguage } from "@/lib/i18n/context";
import {
  TreePine,
  Search,
  GitCompare,
  X,
  Edit3,
  AlertCircle,
  User,
  Plus,
  ArrowRight,
} from "lucide-react";

interface PersonDetail extends TreePerson {
  parents: { id: string; firstName: string; lastName: string; khmerName?: string | null }[];
  children: { id: string; firstName: string; lastName: string; khmerName?: string | null }[];
  spouses: { id: string; firstName: string; lastName: string; khmerName?: string | null }[];
}

function FamilyTreeCanvas({ spaceId }: { spaceId: string }) {
  const { t } = useLanguage();
  const reactFlowInstance = useReactFlow();

  const [people, setPeople] = useState<TreePerson[]>([]);
  const [relationships, setRelationships] = useState<TreeRelationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>("MEMBER");

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Search & Navigation
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [activeProfile, setActiveProfile] = useState<PersonDetail | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Edit Profile State
  const [isEditing, setIsEditing] = useState(false);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editKhmerName, setEditKhmerName] = useState("");
  const [editBirthYear, setEditBirthYear] = useState("");
  const [editDeathYear, setEditDeathYear] = useState("");
  const [editBio, setEditBio] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Kinship Calculator State
  const [showKinshipModal, setShowKinshipModal] = useState(false);
  const [kinshipP1, setKinshipP1] = useState<string>("");
  const [kinshipP2, setKinshipP2] = useState<string>("");
  const [calculatingKinship, setCalculatingKinship] = useState(false);
  const [kinshipResult, setKinshipResult] = useState<KinshipResult | null>(null);
  const [kinshipError, setKinshipError] = useState<string | null>(null);

  const nodeTypes = useMemo(() => ({ heritagePerson: HeritagePersonNode }), []);

  // Compute highlighted nodes and edges for ancestry branch & direct relatives
  const { highlightedNodeIds, highlightedEdgeIds } = useMemo(() => {
    if (!selectedPersonId || relationships.length === 0) {
      return { highlightedNodeIds: new Set<string>(), highlightedEdgeIds: new Set<string>() };
    }

    const nodesSet = new Set<string>();
    const edgesSet = new Set<string>();
    nodesSet.add(selectedPersonId);

    const parentMap = new Map<string, string[]>();
    const childMap = new Map<string, string[]>();
    const spouseMap = new Map<string, string[]>();
    const edgeLookup = new Map<string, string>();

    for (const rel of relationships) {
      if (rel.status !== "CONFIRMED") continue;
      const k1 = `${rel.personId}_${rel.relatedPersonId}`;
      const k2 = `${rel.relatedPersonId}_${rel.personId}`;
      edgeLookup.set(k1, `edge_${rel.id}`);
      edgeLookup.set(k2, `edge_${rel.id}`);

      if (rel.type === "PARENT_CHILD" || rel.type === "ADOPTIVE_PARENT_CHILD") {
        const c = childMap.get(rel.personId) || [];
        c.push(rel.relatedPersonId);
        childMap.set(rel.personId, c);

        const p = parentMap.get(rel.relatedPersonId) || [];
        p.push(rel.personId);
        parentMap.set(rel.relatedPersonId, p);
      } else if (rel.type === "SPOUSE") {
        const s1 = spouseMap.get(rel.personId) || [];
        s1.push(rel.relatedPersonId);
        spouseMap.set(rel.personId, s1);

        const s2 = spouseMap.get(rel.relatedPersonId) || [];
        s2.push(rel.personId);
        spouseMap.set(rel.relatedPersonId, s2);
      }
    }

    // 1. Traverse ancestry branch upward
    const queue = [selectedPersonId];
    const visitedAncestors = new Set<string>();
    while (queue.length > 0) {
      const current = queue.shift()!;
      const parents = parentMap.get(current) || [];
      for (const p of parents) {
        nodesSet.add(p);
        const edgeId = edgeLookup.get(`${p}_${current}`);
        if (edgeId) edgesSet.add(edgeId);
        if (!visitedAncestors.has(p)) {
          visitedAncestors.add(p);
          queue.push(p);
        }
      }
    }

    // 2. Direct relatives: Children
    const children = childMap.get(selectedPersonId) || [];
    for (const c of children) {
      nodesSet.add(c);
      const edgeId = edgeLookup.get(`${selectedPersonId}_${c}`);
      if (edgeId) edgesSet.add(edgeId);
    }

    // 3. Direct relatives: Spouses
    const spouses = spouseMap.get(selectedPersonId) || [];
    for (const s of spouses) {
      nodesSet.add(s);
      const edgeId = edgeLookup.get(`${selectedPersonId}_${s}`) || edgeLookup.get(`${s}_${selectedPersonId}`);
      if (edgeId) edgesSet.add(edgeId);
    }

    // 4. Direct relatives: Siblings
    const parents = parentMap.get(selectedPersonId) || [];
    for (const p of parents) {
      const siblings = childMap.get(p) || [];
      for (const sib of siblings) {
        nodesSet.add(sib);
        const edgeId = edgeLookup.get(`${p}_${sib}`);
        if (edgeId) edgesSet.add(edgeId);
      }
    }

    return { highlightedNodeIds: nodesSet, highlightedEdgeIds: edgesSet };
  }, [selectedPersonId, relationships]);

  // Synchronize highlights to React Flow state
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: {
          ...node.data,
          isHighlighted: highlightedNodeIds.has(node.id),
        },
      }))
    );
    setEdges((eds) =>
      eds.map((edge) => {
        const isHighlighted = highlightedEdgeIds.has(edge.id);
        const isSpouse = (edge.data as { type?: string } | undefined)?.type === "SPOUSE";
        return {
          ...edge,
          animated: isHighlighted || isSpouse,
          style: isHighlighted
            ? { ...edge.style, stroke: "#fbbf24", strokeWidth: 3.5 }
            : {
                ...edge.style,
                stroke: isSpouse ? "#f43f5e" : "#d4af37",
                strokeWidth: 2,
              },
        };
      })
    );
  }, [highlightedNodeIds, highlightedEdgeIds, setNodes, setEdges]);

  // Load Tree Data
  useEffect(() => {
    async function loadTree() {
      try {
        setLoading(true);
        const res = await fetch(`/api/spaces/${spaceId}/tree`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to load family tree");
        }

        const data = await res.json();
        const treePeople: TreePerson[] = data.people || [];
        const treeRels: TreeRelationship[] = data.relationships || [];

        setPeople(treePeople);
        setRelationships(treeRels);
        setUserRole(data.userRole || "MEMBER");

        const layout = computeTreeLayout(treePeople, treeRels);
        setNodes(layout.nodes);
        setEdges(layout.edges);
      } catch (err: unknown) {
        const e = err as Error;
        setErrorMsg(e.message || "An unexpected error occurred.");
      } finally {
        setLoading(false);
      }
    }

    loadTree();
  }, [spaceId, setNodes, setEdges]);

  // Load Individual Profile Details on Node Click
  const handleNodeClick = useCallback(
    async (_event: React.MouseEvent, node: Node) => {
      setSelectedPersonId(node.id);
      setIsEditing(false);
      setProfileLoading(true);
      try {
        const res = await fetch(`/api/spaces/${spaceId}/people/${node.id}`);
        if (res.ok) {
          const data = await res.json();
          setActiveProfile(data.person);
          setEditFirstName(data.person.firstName);
          setEditLastName(data.person.lastName);
          setEditKhmerName(data.person.khmerName || "");
          setEditBirthYear(data.person.birthYear ? String(data.person.birthYear) : "");
          setEditDeathYear(data.person.deathYear ? String(data.person.deathYear) : "");
          setEditBio(data.person.biography || "");
        }
      } catch (err) {
        console.error("Profile load error", err);
      } finally {
        setProfileLoading(false);
      }
    },
    [spaceId]
  );

  // Focus and Fly to Person on Search
  const handleSelectSearchResult = (personId: string) => {
    const targetNode = nodes.find((n) => n.id === personId);
    if (targetNode) {
      reactFlowInstance.setCenter(
        targetNode.position.x + 110,
        targetNode.position.y + 70,
        { zoom: 1.2, duration: 800 }
      );
      setSelectedPersonId(personId);
      handleNodeClick({} as React.MouseEvent, targetNode);
    }
  };

  // Run Kinship Calculation
  const handleCalculateKinship = async () => {
    if (!kinshipP1 || !kinshipP2) return;
    setCalculatingKinship(true);
    setKinshipError(null);
    setKinshipResult(null);

    try {
      const res = await fetch(`/api/spaces/${spaceId}/kinship`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ person1Id: kinshipP1, person2Id: kinshipP2 }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to calculate kinship");
      }

      setKinshipResult(data.result);
    } catch (err: unknown) {
      const e = err as Error;
      setKinshipError(e.message || "Calculation failed");
    } finally {
      setCalculatingKinship(false);
    }
  };

  // Save Profile Edit
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProfile) return;
    setSavingProfile(true);
    setEditError(null);

    try {
      const res = await fetch(`/api/spaces/${spaceId}/people/${activeProfile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: editFirstName.trim(),
          lastName: editLastName.trim(),
          khmerName: editKhmerName.trim() || null,
          birthYear: editBirthYear ? parseInt(editBirthYear, 10) : null,
          deathYear: editDeathYear ? parseInt(editDeathYear, 10) : null,
          biography: editBio.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update profile");
      }

      // Update local state
      setActiveProfile((prev) =>
        prev
          ? {
              ...prev,
              firstName: editFirstName.trim(),
              lastName: editLastName.trim(),
              khmerName: editKhmerName.trim() || null,
              birthYear: editBirthYear ? parseInt(editBirthYear, 10) : null,
              deathYear: editDeathYear ? parseInt(editDeathYear, 10) : null,
              biography: editBio.trim() || null,
            }
          : null
      );

      // Re-layout nodes
      setPeople((prev) =>
        prev.map((p) =>
          p.id === activeProfile.id
            ? {
                ...p,
                firstName: editFirstName.trim(),
                lastName: editLastName.trim(),
                khmerName: editKhmerName.trim() || null,
                birthYear: editBirthYear ? parseInt(editBirthYear, 10) : null,
                deathYear: editDeathYear ? parseInt(editDeathYear, 10) : null,
                biography: editBio.trim() || null,
              }
            : p
        )
      );

      setIsEditing(false);
    } catch (err: unknown) {
      const e = err as Error;
      setEditError(e.message);
    } finally {
      setSavingProfile(false);
    }
  };

  // Filtered search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return people
      .filter(
        (p) =>
          p.firstName.toLowerCase().includes(q) ||
          p.lastName.toLowerCase().includes(q) ||
          (p.khmerName && p.khmerName.includes(q))
      )
      .slice(0, 8);
  }, [searchQuery, people]);

  return (
    <div className="min-h-screen bg-[#0c0f14] flex flex-col overflow-hidden">
      <Navigation activeSpaceId={spaceId} />

      {/* Top Controls Toolbar */}
      <div className="bg-[#0f141f]/90 border-b border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3 z-30">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#d4af37]/10 border border-[#d4af37]/30 text-[#d4af37] flex items-center justify-center">
              <TreePine className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold font-heritage text-white block">
                {t.nav.tree}
              </span>
              <span className="text-[10px] text-slate-400">
                {people.length} verified relatives in lineage
              </span>
            </div>
          </div>
        </div>

        {/* Live Search & Kinship Actions */}
        <div className="flex items-center gap-2 flex-1 max-w-md justify-end">
          <div className="relative w-full max-w-xs">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
              <Search className="w-3.5 h-3.5" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search relatives in tree..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#d4af37]"
            />

            {/* Live Autocomplete List */}
            {searchResults.length > 0 && (
              <div className="absolute top-full mt-1 left-0 right-0 rounded-xl border border-slate-800 bg-slate-950/95 shadow-xl backdrop-blur-md divide-y divide-slate-800/80 z-50 max-h-56 overflow-y-auto">
                {searchResults.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => {
                      handleSelectSearchResult(person.id);
                      setSearchQuery("");
                    }}
                    className="w-full p-2.5 text-left text-xs text-slate-200 hover:bg-[#d4af37]/20 flex items-center justify-between"
                  >
                    <div>
                      <span className="font-semibold text-slate-100">
                        {person.firstName} {person.lastName}
                      </span>
                      {person.khmerName && (
                        <span className="ml-1 text-[11px] text-slate-400 font-khmer">
                          ({person.khmerName})
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500">
                      {person.birthYear ? `b. ${person.birthYear}` : ""}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setShowKinshipModal(true);
              setKinshipResult(null);
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-950 bg-gradient-to-r from-[#fef08a] via-[#d4af37] to-[#b45309] hover:opacity-95 transition-all flex items-center gap-1.5 shrink-0 shadow-sm shadow-[#d4af37]/20 cursor-pointer"
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Kinship Calculator</span>
          </button>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 relative w-full h-[calc(100vh-120px)]">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0c0f14] z-20">
            <div className="text-center">
              <div className="w-10 h-10 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs text-slate-400">Loading interactive family tree...</p>
            </div>
          </div>
        ) : errorMsg ? (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0c0f14] p-4 z-20">
            <div className="heritage-card p-6 max-w-md text-center">
              <AlertCircle className="w-8 h-8 text-rose-400 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white mb-2">Error Loading Tree</h3>
              <p className="text-xs text-slate-400 mb-4">{errorMsg}</p>
              <Link
                href="/dashboard"
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#d4af37] text-slate-950"
              >
                Return to Dashboard
              </Link>
            </div>
          </div>
        ) : people.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0c0f14] p-4 z-20">
            <div className="heritage-card p-8 max-w-md text-center">
              <TreePine className="w-12 h-12 text-[#d4af37] mx-auto mb-4" />
              <h3 className="text-lg font-bold font-heritage text-white mb-2">
                Empty Family Tree
              </h3>
              <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                This space has no relatives recorded yet. Onboard the founding patriarch or
                matriarch to establish the lineage tree.
              </p>
              <Link
                href={`/spaces/${spaceId}/onboarding`}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#d4af37] text-slate-950 hover:bg-[#e5c158] transition-all shadow-md shadow-[#d4af37]/20"
              >
                <Plus className="w-4 h-4" />
                <span>Establish Founding Ancestor</span>
              </Link>
            </div>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={handleNodeClick}
            nodeTypes={nodeTypes}
            fitView
            minZoom={0.2}
            maxZoom={2.5}
            className="bg-[#0c0f14]"
          >
            <Background color="#1e293b" gap={24} size={1} />
            <Controls className="!bg-[#141923] !border-slate-800 !fill-slate-300 !rounded-xl !shadow-xl" />
          </ReactFlow>
        )}

        {/* Selected Person Profile Drawer */}
        {(activeProfile || profileLoading) && (
          <div className="absolute top-4 right-4 bottom-4 w-full max-w-sm heritage-card-elevated p-6 z-40 overflow-y-auto shadow-2xl flex flex-col justify-between animate-in slide-in-from-right-4 duration-200">
            {profileLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                <div className="w-8 h-8 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-xs text-slate-400">Loading person details...</p>
              </div>
            ) : activeProfile ? (
              <>
                <div>
                  <div className="flex items-start justify-between pb-4 border-b border-slate-800 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full border-2 border-[#d4af37]/40 overflow-hidden bg-slate-900 flex items-center justify-center shrink-0">
                        {activeProfile.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={activeProfile.photoUrl}
                            alt={activeProfile.firstName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-6 h-6 text-[#d4af37]" />
                        )}
                      </div>
                      <div>
                        <h3 className="text-base font-bold font-heritage text-white">
                          {activeProfile.firstName} {activeProfile.lastName}
                        </h3>
                        {activeProfile.khmerName && (
                          <p className="text-xs text-slate-400 font-khmer">
                            {activeProfile.khmerName}
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveProfile(null);
                        setSelectedPersonId(null);
                      }}
                      className="text-slate-400 hover:text-white p-1"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {isEditing ? (
                    /* Edit Form */
                    <form onSubmit={handleSaveProfile} className="space-y-3 text-xs">
                      {editError && (
                        <div className="p-2.5 rounded-lg bg-rose-950/50 border border-rose-800 text-rose-200 text-[11px]">
                          {editError}
                        </div>
                      )}

                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">First Name</label>
                        <input
                          type="text"
                          required
                          value={editFirstName}
                          onChange={(e) => setEditFirstName(e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Last Name</label>
                        <input
                          type="text"
                          required
                          value={editLastName}
                          onChange={(e) => setEditLastName(e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Khmer Name</label>
                        <input
                          type="text"
                          value={editKhmerName}
                          onChange={(e) => setEditKhmerName(e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-khmer"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">Birth Year</label>
                          <input
                            type="number"
                            value={editBirthYear}
                            onChange={(e) => setEditBirthYear(e.target.value)}
                            className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">Death Year</label>
                          <input
                            type="number"
                            value={editDeathYear}
                            onChange={(e) => setEditDeathYear(e.target.value)}
                            className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Biography / Story</label>
                        <textarea
                          rows={3}
                          value={editBio}
                          onChange={(e) => setEditBio(e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                        />
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setIsEditing(false)}
                          className="px-3 py-1.5 text-slate-400 hover:text-white"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={savingProfile}
                          className="px-4 py-1.5 rounded-lg bg-[#d4af37] text-slate-950 font-semibold disabled:opacity-50"
                        >
                          {savingProfile ? "Saving..." : "Save"}
                        </button>
                      </div>
                    </form>
                  ) : (
                    /* Profile View */
                    <div className="space-y-4 text-xs">
                      <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-300">
                        <div>
                          <span className="text-[10px] text-slate-500 block">Life Status</span>
                          <span className="font-semibold text-slate-200">
                            {activeProfile.isLiving ? "Living" : "Deceased"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">Years</span>
                          <span className="font-semibold text-slate-200">
                            {activeProfile.birthYear || "—"} - {activeProfile.deathYear || (activeProfile.isLiving ? "Pres." : "—")}
                          </span>
                        </div>
                      </div>

                      {activeProfile.biography && (
                        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-300 leading-relaxed text-[11px]">
                          <span className="text-[10px] text-[#d4af37] uppercase tracking-wider font-semibold block mb-1">
                            Biography
                          </span>
                          {activeProfile.biography}
                        </div>
                      )}

                      {/* Immediate Kinship Relations */}
                      <div className="space-y-3">
                        {/* Parents */}
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block mb-1">
                            Parents ({activeProfile.parents.length})
                          </span>
                          {activeProfile.parents.length === 0 ? (
                            <p className="text-[11px] text-slate-500 italic">No parents recorded</p>
                          ) : (
                            <div className="space-y-1">
                              {activeProfile.parents.map((parent) => (
                                <button
                                  key={parent.id}
                                  type="button"
                                  onClick={() => handleSelectSearchResult(parent.id)}
                                  className="w-full text-left p-2 rounded-lg bg-slate-900 hover:bg-[#d4af37]/20 border border-slate-800 flex items-center justify-between text-[11px] text-slate-200"
                                >
                                  <span>{parent.firstName} {parent.lastName}</span>
                                  <ArrowRight className="w-3 h-3 text-[#d4af37]" />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Children */}
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block mb-1">
                            Children ({activeProfile.children.length})
                          </span>
                          {activeProfile.children.length === 0 ? (
                            <p className="text-[11px] text-slate-500 italic">No children recorded</p>
                          ) : (
                            <div className="space-y-1">
                              {activeProfile.children.map((child) => (
                                <button
                                  key={child.id}
                                  type="button"
                                  onClick={() => handleSelectSearchResult(child.id)}
                                  className="w-full text-left p-2 rounded-lg bg-slate-900 hover:bg-[#d4af37]/20 border border-slate-800 flex items-center justify-between text-[11px] text-slate-200"
                                >
                                  <span>{child.firstName} {child.lastName}</span>
                                  <ArrowRight className="w-3 h-3 text-[#d4af37]" />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Spouses */}
                        {activeProfile.spouses.length > 0 && (
                          <div>
                            <span className="text-[10px] text-rose-400 uppercase tracking-wider font-semibold block mb-1">
                              Spouses / Partners ({activeProfile.spouses.length})
                            </span>
                            <div className="space-y-1">
                              {activeProfile.spouses.map((spouse) => (
                                <button
                                  key={spouse.id}
                                  type="button"
                                  onClick={() => handleSelectSearchResult(spouse.id)}
                                  className="w-full text-left p-2 rounded-lg bg-slate-900 hover:bg-rose-950/40 border border-rose-900/40 flex items-center justify-between text-[11px] text-slate-200"
                                >
                                  <span>{spouse.firstName} {spouse.lastName}</span>
                                  <ArrowRight className="w-3 h-3 text-rose-400" />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Profile Drawer Footer Actions */}
                <div className="pt-4 border-t border-slate-800 space-y-2 mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setKinshipP1(activeProfile.id);
                      setShowKinshipModal(true);
                      setKinshipResult(null);
                    }}
                    className="w-full py-2 px-3 rounded-lg text-xs font-medium text-slate-200 bg-slate-900 hover:bg-[#d4af37] hover:text-slate-950 transition-colors flex items-center justify-center gap-1.5 border border-slate-700"
                  >
                    <GitCompare className="w-3.5 h-3.5" />
                    <span>Calculate Kinship With...</span>
                  </button>

                  {(userRole === "OWNER" || userRole === "ADMIN") && !isEditing && (
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="w-full py-2 px-3 rounded-lg text-xs font-medium text-slate-400 hover:text-white bg-slate-950 hover:bg-slate-900 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit Relative Record</span>
                    </button>
                  )}
                </div>
              </>
            ) : null}
          </div>
        )}
      </div>

      {/* Kinship Calculator Modal */}
      {showKinshipModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="heritage-card-elevated max-w-lg w-full p-6 sm:p-8 relative max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setShowKinshipModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-[#d4af37]/10 border border-[#d4af37]/30 text-[#d4af37] flex items-center justify-center">
                <GitCompare className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold font-heritage text-white">
                  Familial Kinship Calculator
                </h3>
                <p className="text-[11px] text-slate-400">
                  Calculates exact genealogical kinship strictly using verified database edges.
                </p>
              </div>
            </div>

            {kinshipError && (
              <div className="my-3 p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-xs text-rose-200">
                {kinshipError}
              </div>
            )}

            <div className="space-y-4 my-6">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  First Relative (Anchor)
                </label>
                <select
                  value={kinshipP1}
                  onChange={(e) => setKinshipP1(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-[#d4af37]"
                >
                  <option value="">Select first person...</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.firstName} {p.lastName} {p.khmerName ? `(${p.khmerName})` : ""}{" "}
                      {p.birthYear ? `[b. ${p.birthYear}]` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Second Relative (Target)
                </label>
                <select
                  value={kinshipP2}
                  onChange={(e) => setKinshipP2(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-[#d4af37]"
                >
                  <option value="">Select second person...</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.firstName} {p.lastName} {p.khmerName ? `(${p.khmerName})` : ""}{" "}
                      {p.birthYear ? `[b. ${p.birthYear}]` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleCalculateKinship}
                disabled={calculatingKinship || !kinshipP1 || !kinshipP2}
                className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs text-slate-950 bg-[#d4af37] hover:bg-[#e5c158] transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-md shadow-[#d4af37]/20"
              >
                {calculatingKinship ? (
                  <span>Tracing lineage...</span>
                ) : (
                  <>
                    <GitCompare className="w-4 h-4" />
                    <span>Calculate Relationship</span>
                  </>
                )}
              </button>
            </div>

            {/* Kinship Result Presentation */}
            {kinshipResult && (
              <div className="p-4 rounded-xl bg-slate-900 border border-[#d4af37]/40 space-y-4 animate-in fade-in duration-200">
                <div className="text-center pb-3 border-b border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest block mb-1">
                    Genealogical Relationship
                  </span>
                  <h4 className="text-xl font-bold font-heritage gold-gradient-text">
                    {kinshipResult.relationshipNameEn}
                  </h4>
                  <p className="text-sm font-khmer text-slate-300 mt-0.5">
                    {kinshipResult.relationshipNameKm}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                  <div className="p-2.5 rounded-lg bg-slate-950">
                    <span className="text-[10px] text-slate-500 block">Degrees of Separation</span>
                    <span className="font-semibold text-white">
                      {kinshipResult.degreeOfSeparation >= 0 ? `${kinshipResult.degreeOfSeparation} step(s)` : "Disconnected"}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950">
                    <span className="text-[10px] text-slate-500 block">Generational Shift</span>
                    <span className="font-semibold text-white">
                      {kinshipResult.generationDifference === 0
                        ? "Same Generation"
                        : `${Math.abs(kinshipResult.generationDifference)} generation(s)`}
                    </span>
                  </div>
                </div>

                {/* Step Path */}
                {kinshipResult.path.length > 0 && (
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-2 font-semibold">
                      Verified Relationship Path:
                    </span>
                    <div className="space-y-1.5 text-xs">
                      {kinshipResult.path.map((step, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-slate-300">
                          <span className="w-5 h-5 rounded-full bg-slate-800 text-[10px] text-[#d4af37] flex items-center justify-center font-mono">
                            {idx + 1}
                          </span>
                          <span className="font-medium text-slate-100">{step.personName}</span>
                          <span className="text-[10px] text-slate-500">({step.roleInStep})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-800 leading-relaxed italic">
                  {kinshipResult.explanation}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TreeParamResolver({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = use(params);
  return (
    <ReactFlowProvider>
      <FamilyTreeCanvas spaceId={spaceId} />
    </ReactFlowProvider>
  );
}

export default function FamilyTreePage({
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
      <TreeParamResolver params={params} />
    </Suspense>
  );
}
