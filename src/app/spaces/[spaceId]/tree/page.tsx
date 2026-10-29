"use client";

import React, { useState, useEffect, useRef, use, useMemo, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ReactFlow,
  Background,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useViewport,
  ReactFlowProvider,
  Node,
  Edge,
  MiniMap,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { HeritagePersonNode, HeritageCoupleNode } from "@/components/tree/PersonNode";
import { MobileRelationshipExplorer } from "@/components/tree/MobileRelationshipExplorer";
import { computeTreeLayout, getGen3CollapsedNodeIds, TreePerson, TreeRelationship, BranchInfo } from "@/lib/tree-layout";
import { KinshipResult, calculateKinship, KinshipPerson, KinshipRelationship } from "@/lib/kinship";
import { useLanguage } from "@/lib/i18n/context";
import {
  subscribeToTree,
  updatePersonInRTDB,
  addPersonToRTDB,
  deletePersonFromRTDB,
} from "@/lib/firebase/rtdb";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import {
  Compass,
  Map as MapIcon,
  TreePine,
  Search,
  GitCompare,
  X,
  Edit3,
  AlertCircle,
  User,
  Plus,
  ArrowRight,
  LocateFixed,
  Maximize2,
  GitBranch,
  ShieldCheck,
  Image as ImageIcon,
  Sparkles,
  Trash2,
  CheckCircle2,
  Check,
  AlertTriangle,
  FolderTree,
  Layers,
  Eye,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  LayoutGrid,
  Sun,
  Moon,
  ChevronLeft,
} from "lucide-react";

interface PersonDetail extends TreePerson {
  parents: { id: string; firstName: string; lastName: string; khmerName?: string | null; photoUrl?: string | null }[];
  children: { id: string; firstName: string; lastName: string; khmerName?: string | null; photoUrl?: string | null }[];
  spouses: { id: string; firstName: string; lastName: string; khmerName?: string | null; photoUrl?: string | null }[];
  memories?: {
    id: string;
    title: string;
    description?: string | null;
    mediaUrl: string;
    mediaType: "PHOTO" | "DOCUMENT" | "AUDIO" | "VIDEO";
    year?: number | null;
  }[];
}

const nodeTypes = {
  heritagePerson: HeritagePersonNode,
  heritageCouple: HeritageCoupleNode,
};
const EMPTY_SET = new Set<string>();

// Helper to sanitize birthYear and support both Khmer (០-៩) and Latin (0-9) numerals
function cleanYearInput(val: string): string {
  if (!val) return "";
  return val
    .replace(/[០-៩]/g, (d) => String("០១២៣៤៥៦៧៨៩".indexOf(d)))
    .replace(/[^\d]/g, "")
    .slice(0, 4);
}

// Helper to format numbers into authentic Khmer numerals (០-៩)
const KHMER_DIGITS = ["០", "១", "២", "៣", "៤", "៥", "៦", "៧", "៨", "៩"];
export function toKhmerNumber(num: number): string {
  return String(num)
    .split("")
    .map((d) => KHMER_DIGITS[parseInt(d, 10)] ?? d)
    .join("");
}

export function FamilyTreeCanvas({ spaceId: propSpaceId }: { spaceId?: string }) {
  const [currentSpaceId, setCurrentSpaceId] = useState<string>(propSpaceId || "");
  const { t, language } = useLanguage();
  const reactFlowInstance = useReactFlow();
  const reactFlowRef = React.useRef(reactFlowInstance);
  useEffect(() => {
    reactFlowRef.current = reactFlowInstance;
  }, [reactFlowInstance]);
  const searchParams = useSearchParams();
  const focusParamId = searchParams.get("focusPersonId");
  const { x: vpX, y: vpY, zoom: vpZoom } = useViewport();
  const [generationYMap, setGenerationYMap] = useState<Record<number, number>>({});

  const [people, setPeople] = useState<TreePerson[]>([]);
  const [relationships, setRelationships] = useState<TreeRelationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>("MEMBER");
  const [linkedPersonId, setLinkedPersonId] = useState<string | null>(null);

  // Branch & interactive tree state
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string | null>(null);
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(new Set());
  const [isCompactLayout, setIsCompactLayout] = useState(true);
  const [focusedDescendantPersonId, setFocusedDescendantPersonId] = useState<string | null>(null);
  const [showMiniMap, setShowMiniMap] = useState(false);
  const [mobileViewMode, setMobileViewMode] = useState<"CARDS" | "MAP">("CARDS");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isInitialFitDone = useRef(false);

  // Background Theme: Default to "light" for easy viewing, with saved user preference
  const [treeTheme, setTreeTheme] = useState<"light" | "dark">("light");
  const treeThemeRef = useRef<"light" | "dark">("light");

  useEffect(() => {
    setTreeTheme("light");
    treeThemeRef.current = "light";
    try {
      localStorage.setItem("familytree_theme", "light");
    } catch {
      // ignore
    }
  }, []);

  // Smooth mouse wheel & touchpad canvas panning + web-standard pinch/Ctrl zoom
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const handleWheel = (e: WheelEvent) => {
      // Allow standard scrolling if inside an explicit scrollable drawer, modal, or input
      const targetEl = e.target as HTMLElement | null;
      if (targetEl?.closest('.overflow-y-auto, textarea, input, select')) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const currentViewport = reactFlowRef.current?.getViewport() || reactFlowInstance.getViewport();

      // Zoom in / out with Ctrl + wheel or trackpad pinch (standard web behavior)
      if (e.ctrlKey || e.metaKey) {
        const zoomFactor = Math.pow(2, -e.deltaY * 0.005);
        const nextZoom = Math.min(2.5, Math.max(0.15, currentViewport.zoom * zoomFactor));
        const rect = wrapper.getBoundingClientRect();
        const pointerX = e.clientX - rect.left;
        const pointerY = e.clientY - rect.top;
        const newX = pointerX - (pointerX - currentViewport.x) * (nextZoom / currentViewport.zoom);
        const newY = pointerY - (pointerY - currentViewport.y) * (nextZoom / currentViewport.zoom);
        reactFlowInstance.setViewport({
          x: newX,
          y: newY,
          zoom: nextZoom,
        });
        return;
      }

      // Normal scroll (without Ctrl): pan smoothly preserving current zoom
      const deltaX = e.shiftKey ? e.deltaY : e.deltaX;
      const deltaY = e.shiftKey ? 0 : e.deltaY;
      reactFlowInstance.setViewport({
        x: currentViewport.x - deltaX,
        y: currentViewport.y - deltaY,
        zoom: currentViewport.zoom,
      });
    };

    wrapper.addEventListener('wheel', handleWheel, { capture: true, passive: false });

    return () => {
      wrapper.removeEventListener('wheel', handleWheel, { capture: true });
    };
  }, [reactFlowInstance]);

  // Space information for header
  const [spaceInfo, setSpaceInfo] = useState<{ id: string; name: string } | null>(null);
  const effectiveSpaceId = currentSpaceId || spaceInfo?.id || propSpaceId || "";

  // Direct Node Action Callback Refs
  const handleOpenAddModalRef = useRef<
    (personId?: string, presetRel?: "CHILD" | "SPOUSE" | "PARENT" | "SIBLING" | "NONE") => void
  >(() => {});
  const handleEditPersonDirectlyRef = useRef<(personId: string) => void>(() => {});
  const handleDeletePersonDirectlyRef = useRef<(personId: string) => void>(() => {});
  const handleSelectPersonDirectlyRef = useRef<(personId: string) => void>(() => {});

  // Floating feedback banner
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Real-time Firebase connection status
  const [isLiveConnected, setIsLiveConnected] = useState(false);

  // Auto-dismiss notification after 4.5 seconds
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => setNotification(null), 4500);
    return () => clearTimeout(timer);
  }, [notification]);

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Search & Navigation
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [activeProfile, setActiveProfile] = useState<PersonDetail | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [isBranchFocused, setIsBranchFocused] = useState(false);

  // Edit Profile State
  const [isEditing, setIsEditing] = useState(false);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editKhmerName, setEditKhmerName] = useState("");
  const [editGender, setEditGender] = useState("UNKNOWN");
  const [editBirthYear, setEditBirthYear] = useState("");
  const [editDeathYear, setEditDeathYear] = useState("");
  const [editIsLiving, setEditIsLiving] = useState(true);
  const [editPhotoUrl, setEditPhotoUrl] = useState("");
  const [editBio, setEditBio] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Auto-Save State for live editing
  type AutoSaveState = "idle" | "saving" | "saved" | "error";
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveState>("idle");
  const [autoSaveMessage, setAutoSaveMessage] = useState<string>("");
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingEditsRef = useRef<{
    personId: string;
    firstName: string;
    lastName: string;
    khmerName?: string;
    gender: string;
    birthYear: string;
    deathYear: string;
    isLiving: boolean;
    photoUrl?: string;
    bio: string;
  } | null>(null);

  // Restore claimed identity from localStorage if available
  useEffect(() => {
    try {
      const savedId = localStorage.getItem("family_linked_person_id");
      if (savedId) {
        setLinkedPersonId(savedId);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleClaimIdentity = (personId: string) => {
    setLinkedPersonId(personId);
    try {
      localStorage.setItem("family_linked_person_id", personId);
      document.cookie = `family_linked_person_id=${personId}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {
      // ignore
    }
    const person = people.find((p) => p.id === personId);
    setNotification({
      type: "success",
      message: language === "km"
        ? `អ្នកបានជ្រើសរើស ${person?.khmerName || person?.firstName || "អត្តសញ្ញាណ"} ជាខ្លួនអ្នក!`
        : `You claimed ${person?.firstName || "identity"} as yourself!`,
    });
  };

  // Remove Profile State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingPerson, setDeletingPerson] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Add Relative State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addStep, setAddStep] = useState<"FORM" | "CONFIRM">("FORM");
  const [addFirstName, setAddFirstName] = useState("");
  const [addLastName, setAddLastName] = useState("");
  const [addKhmerName, setAddKhmerName] = useState("");
  const [addGender, setAddGender] = useState("UNKNOWN");
  const [addBirthYear, setAddBirthYear] = useState("");
  const [addDeathYear, setAddDeathYear] = useState("");
  const [addIsLiving, setAddIsLiving] = useState(true);
  const [addPhotoUrl, setAddPhotoUrl] = useState("");
  const [addBio, setAddBio] = useState("");
  const [addRelType, setAddRelType] = useState<"PARENT" | "CHILD" | "SPOUSE" | "SIBLING" | "NONE">("CHILD");
  const [addAnchorId, setAddAnchorId] = useState<string>("");
  const [addAlsoLinkSpouse, setAddAlsoLinkSpouse] = useState(false);
  const [submittingAdd, setSubmittingAdd] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Kinship Calculator State
  const [showKinshipModal, setShowKinshipModal] = useState(false);
  const [kinshipP1, setKinshipP1] = useState<string>("");
  const [kinshipP2, setKinshipP2] = useState<string>("");
  const [calculatingKinship, setCalculatingKinship] = useState(false);
  const [kinshipResult, setKinshipResult] = useState<KinshipResult | null>(null);
  const [kinshipError, setKinshipError] = useState<string | null>(null);

  // Permissions: Open Family Collaboration Mode - All cousins can fill, edit, and add
  const isCouncil = userRole === "OWNER" || userRole === "ADMIN";
  const isSelfProfile = Boolean(activeProfile && linkedPersonId && activeProfile.id === linkedPersonId);
  const canEditActive = true;
  const canDeleteActive = isCouncil;
  const canAddRelative = true;

  // Compute highlighted nodes and edges for ancestry branch & direct relatives
  const { highlightedNodeIds, highlightedEdgeIds } = useMemo(() => {
    if (!selectedPersonId || relationships.length === 0) {
      return {
        highlightedNodeIds: EMPTY_SET,
        highlightedEdgeIds: EMPTY_SET,
      };
    }

    const nodesSet = new Set<string>();
    const edgesSet = new Set<string>();
    const descendantsSet = new Set<string>();
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

    // 1. Traverse ancestry branch upward (Parents, Grandparents, etc.)
    const ancestorQueue = [selectedPersonId];
    const visitedAncestors = new Set<string>();
    while (ancestorQueue.length > 0) {
      const current = ancestorQueue.shift()!;
      const parents = parentMap.get(current) || [];
      for (const p of parents) {
        nodesSet.add(p);
        const edgeId = edgeLookup.get(`${p}_${current}`);
        if (edgeId) edgesSet.add(edgeId);
        if (!visitedAncestors.has(p)) {
          visitedAncestors.add(p);
          ancestorQueue.push(p);
        }
      }
    }

    // 2. Traverse descendants downward (Children, Grandchildren, etc.)
    const descendantQueue = [selectedPersonId];
    const visitedDescendants = new Set<string>();
    while (descendantQueue.length > 0) {
      const current = descendantQueue.shift()!;
      const children = childMap.get(current) || [];
      for (const c of children) {
        nodesSet.add(c);
        descendantsSet.add(c);
        const edgeId = edgeLookup.get(`${current}_${c}`);
        if (edgeId) edgesSet.add(edgeId);
        if (!visitedDescendants.has(c)) {
          visitedDescendants.add(c);
          descendantQueue.push(c);
        }
      }
    }

    // 3. Direct relatives: Spouses
    const spouses = spouseMap.get(selectedPersonId) || [];
    for (const s of spouses) {
      nodesSet.add(s);
      const edgeId =
        edgeLookup.get(`${selectedPersonId}_${s}`) || edgeLookup.get(`${s}_${selectedPersonId}`);
      if (edgeId) edgesSet.add(edgeId);
    }

    // 4. Direct relatives: Siblings (children of same parents)
    const parents = parentMap.get(selectedPersonId) || [];
    for (const p of parents) {
      const siblings = childMap.get(p) || [];
      for (const sib of siblings) {
        nodesSet.add(sib);
        const edgeId = edgeLookup.get(`${p}_${sib}`);
        if (edgeId) edgesSet.add(edgeId);
      }
    }

    return {
      highlightedNodeIds: nodesSet,
      highlightedEdgeIds: edgesSet,
    };
  }, [selectedPersonId, relationships]);

  // Synchronize highlights and branch focus to React Flow state
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => {
        const isHighlighted = highlightedNodeIds.has(node.id);
        const isSelected = selectedPersonId === node.id;
        let opacity = 1;

        if (isBranchFocused && highlightedNodeIds.size > 0) {
          opacity = isHighlighted ? 1 : 0.22;
        }

        return {
          ...node,
          style: {
            ...node.style,
            opacity,
            transition: "opacity 0.3s ease, transform 0.3s ease",
          },
          data: {
            ...node.data,
            isHighlighted: isHighlighted || isSelected,
          },
        };
      })
    );

    setEdges((eds) =>
      eds.map((edge) => {
        const isHighlighted = highlightedEdgeIds.has(edge.id);
        const isSpouse = (edge.data as { type?: string } | undefined)?.type === "SPOUSE";
        const isDisputed = (edge.data as { status?: string } | undefined)?.status === "DISPUTED";
        const isPending = (edge.data as { status?: string } | undefined)?.status === "PENDING_APPROVAL";

        let stroke = isSpouse ? "#f43f5e" : "#d4af37";
        let strokeDasharray = isSpouse ? "5,5" : undefined;
        let opacity = 1;

        if (isDisputed) {
          stroke = "#f59e0b";
          strokeDasharray = "4,4";
        } else if (isPending) {
          stroke = "#38bdf8";
          strokeDasharray = "6,3";
        }

        if (isHighlighted) {
          stroke = "#fbbf24";
        }

        if (isBranchFocused && highlightedEdgeIds.size > 0) {
          opacity = isHighlighted ? 1 : 0.15;
        }

        return {
          ...edge,
          animated: isHighlighted || isSpouse || isDisputed || isPending,
          style: {
            ...edge.style,
            stroke,
            strokeDasharray,
            strokeWidth: isHighlighted ? 3.5 : 2,
            opacity,
            transition: "opacity 0.3s ease",
          },
        };
      })
    );
  }, [highlightedNodeIds, highlightedEdgeIds, isBranchFocused, selectedPersonId, setNodes, setEdges]);

  // Compute Siblings for active profile based on verified relationships
  const activeProfileSiblings = useMemo(() => {
    if (!activeProfile || activeProfile.parents.length === 0) return [];

    const parentIds = new Set(activeProfile.parents.map((p) => p.id));
    const siblingIds = new Set<string>();

    for (const rel of relationships) {
      if (
        rel.status === "CONFIRMED" &&
        (rel.type === "PARENT_CHILD" || rel.type === "ADOPTIVE_PARENT_CHILD") &&
        parentIds.has(rel.personId) &&
        rel.relatedPersonId !== activeProfile.id
      ) {
        siblingIds.add(rel.relatedPersonId);
      }
    }

    return people.filter((p) => siblingIds.has(p.id));
  }, [activeProfile, relationships, people]);

  // Automatic instant kinship calculation between user ("Me") and currently opened profile
  const activeProfileKinshipToMe = useMemo(() => {
    if (!activeProfile || !linkedPersonId || activeProfile.id === linkedPersonId) return null;
    const kPeople: KinshipPerson[] = people.map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      khmerName: p.khmerName,
      gender: p.gender,
    }));
    const kRels: KinshipRelationship[] = relationships.map((r) => ({
      id: r.id,
      personId: r.personId,
      relatedPersonId: r.relatedPersonId,
      type: r.type,
      status: r.status,
    }));
    const res = calculateKinship(linkedPersonId, activeProfile.id, kPeople, kRels);
    return res.determined ? res : null;
  }, [activeProfile, linkedPersonId, people, relationships]);

  // Ref to break circular closure in node callbacks
  const applyLayoutRef = useRef<
    (
      targetCollapsed: Set<string>,
      pList?: TreePerson[],
      rList?: TreeRelationship[],
      targetFocusPersonId?: string | null,
      compactMode?: boolean
    ) => void
  >(() => {});

  // Apply layout calculations directly to React Flow state without cascading effects
  const applyLayout = useCallback(
    (
      targetCollapsed: Set<string>,
      pList?: TreePerson[],
      rList?: TreeRelationship[],
      targetFocusPersonId?: string | null,
      compactMode?: boolean
    ) => {
      const activePeople = pList || people;
      const activeRels = rList || relationships;
      if (activePeople.length === 0) return;

      const activeFocusId =
        targetFocusPersonId !== undefined ? targetFocusPersonId : focusedDescendantPersonId;
      const activeCompact = compactMode !== undefined ? compactMode : isCompactLayout;

      const layout = computeTreeLayout(activePeople, activeRels, {
        collapsedNodeIds: targetCollapsed,
        focusPersonId: activeFocusId,
        compactSiblingLayout: activeCompact,
        combineCouples: true,
      });

      setBranches(layout.branches || []);
      if (layout.generationYMap) {
        setGenerationYMap(layout.generationYMap);
      }

      const interactiveNodes = layout.nodes.map((n) => ({
        ...n,
        data: {
          ...n.data,
          theme: treeThemeRef.current,
          onToggleCollapse: (personId: string) => {
            setCollapsedNodeIds((prev) => {
              const next = new Set(prev);
              if (next.has(personId)) next.delete(personId);
              else next.add(personId);
              applyLayoutRef.current(
                next,
                activePeople,
                activeRels,
                activeFocusId,
                activeCompact
              );
              return next;
            });
          },
          onAddRelative: (personId: string) => {
            handleOpenAddModalRef.current(personId, "CHILD");
          },
          onAddSpouse: (personId: string) => {
            handleOpenAddModalRef.current(personId, "SPOUSE");
          },
          onEditPerson: (personId: string) => {
            handleEditPersonDirectlyRef.current(personId);
          },
          onDeletePerson: (personId: string) => {
            handleDeletePersonDirectlyRef.current(personId);
          },
          onSelectPerson: (personId: string) => {
            handleSelectPersonDirectlyRef.current(personId);
          },
        },
      }));

      setNodes(interactiveNodes);
      setEdges(layout.edges);
    },
    [people, relationships, focusedDescendantPersonId, isCompactLayout, setNodes, setEdges]
  );

  applyLayoutRef.current = applyLayout;
  useEffect(() => {
    applyLayoutRef.current = applyLayout;
  }, [applyLayout]);

  // Load Tree Data from database and layout nodes
  const loadTree = useCallback(
    async (focusTargetId?: string) => {
      try {
        setLoading(true);
        setErrorMsg(null);
        const url = propSpaceId ? `/api/spaces/${propSpaceId}/tree` : `/api/tree`;
        const res = await fetch(url);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to load family tree");
        }

        const data = await res.json();
        if (data.space) {
          setSpaceInfo(data.space);
          setCurrentSpaceId(data.space.id);
        }
        const treePeople: TreePerson[] = data.people || [];
        const treeRels: TreeRelationship[] = data.relationships || [];

        setPeople(treePeople);
        setRelationships(treeRels);
        setUserRole(data.userRole || "MEMBER");
        setLinkedPersonId(data.linkedPersonId || null);

        const activeCollapsed = collapsedNodeIds;
        setCollapsedNodeIds(activeCollapsed);
        applyLayout(activeCollapsed, treePeople, treeRels, focusedDescendantPersonId, isCompactLayout);

        setTimeout(() => {
          if (focusTargetId) {
            const target = treePeople.find((p) => p.id === focusTargetId);
            if (target) {
              setSelectedPersonId(focusTargetId);
              return;
            }
          }
          reactFlowRef.current?.fitView({
            padding: typeof window !== "undefined" && window.innerWidth < 768 ? 0.08 : 0.16,
            minZoom: 0.15,
            maxZoom: 1.1,
            duration: 400,
          });
        }, 80);
      } catch (err: unknown) {
        const e = err as Error;
        setErrorMsg(e.message || "An unexpected error occurred.");
      } finally {
        setLoading(false);
      }
    },
    [propSpaceId, collapsedNodeIds, focusedDescendantPersonId, isCompactLayout, applyLayout]
  );

  useEffect(() => {
    let active = true;

    async function initialFetch() {
      try {
        const url = propSpaceId ? `/api/spaces/${propSpaceId}/tree` : `/api/tree`;
        const res = await fetch(url);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to load family tree");
        }

        const data = await res.json();
        if (!active) return;
        if (data.space) {
          setSpaceInfo(data.space);
          setCurrentSpaceId(data.space.id);
        }

        const treePeople: TreePerson[] = data.people || [];
        const treeRels: TreeRelationship[] = data.relationships || [];

        setPeople(treePeople);
        setRelationships(treeRels);
        setUserRole(data.userRole || "MEMBER");
        setLinkedPersonId(data.linkedPersonId || null);

        // Default view: Fully expanded descendant tree matching the template poster
        const defaultCollapsed = new Set<string>();
        setCollapsedNodeIds(defaultCollapsed);
        applyLayoutRef.current(defaultCollapsed, treePeople, treeRels, null, true);

        if (!isInitialFitDone.current) {
          isInitialFitDone.current = true;
          setTimeout(() => {
            const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
            reactFlowRef.current?.fitView({
              padding: isMobile ? 0.08 : 0.16,
              minZoom: 0.15,
              maxZoom: 1.1,
              duration: 450,
            });
          }, 100);
        }
      } catch (err: unknown) {
        if (!active) return;
        const e = err as Error;
        setErrorMsg(e.message || "An unexpected error occurred.");
      } finally {
        if (active) setLoading(false);
      }
    }

    initialFetch();

    return () => {
      active = false;
    };
  }, [propSpaceId]);

  // Real-time synchronization via Firebase Realtime Database
  useEffect(() => {
    const spaceId = propSpaceId || currentSpaceId;
    if (!spaceId || !isFirebaseConfigured()) {
      setIsLiveConnected(false);
      return;
    }

    const unsubscribe = subscribeToTree(
      spaceId,
      (liveData) => {
        setIsLiveConnected(true);
        if (liveData.people && liveData.people.length > 0) {
          setPeople(liveData.people);
          setRelationships(liveData.relationships);
          applyLayoutRef.current(
            collapsedNodeIds,
            liveData.people,
            liveData.relationships,
            focusedDescendantPersonId,
            isCompactLayout
          );
        }
      },
      (error) => {
        console.warn("Real-time Firebase listener notice:", error);
        setIsLiveConnected(false);
      }
    );

    return () => {
      unsubscribe?.();
    };
  }, [propSpaceId, currentSpaceId, collapsedNodeIds, focusedDescendantPersonId, isCompactLayout]);

  // Load Individual Profile Details on Node Click
  const handleNodeClick = useCallback(
    async (_event: React.MouseEvent, node: Node) => {
      setSelectedPersonId(node.id);
      setIsEditing(false);
      setEditError(null);

      const nodePerson = (node.data as unknown as { person?: TreePerson })?.person;
      if (nodePerson) {
        setActiveProfile({
          ...nodePerson,
          parents: [],
          children: [],
          spouses: [],
          memories: [],
        });
        setEditFirstName(nodePerson.firstName || "");
        setEditLastName(nodePerson.lastName || "");
        setEditKhmerName(nodePerson.khmerName || "");
        setEditGender(nodePerson.gender || "UNKNOWN");
        setEditBirthYear(nodePerson.birthYear ? String(nodePerson.birthYear) : "");
        setEditDeathYear(nodePerson.deathYear ? String(nodePerson.deathYear) : "");
        setEditIsLiving(nodePerson.isLiving ?? true);
        setEditPhotoUrl(nodePerson.photoUrl || "");
        setEditBio(nodePerson.biography || "");
      }

      setProfileLoading(true);
      try {
        const res = await fetch(`/api/spaces/${effectiveSpaceId}/people/${node.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.person) {
            setActiveProfile(data.person);
            setEditFirstName(data.person.firstName);
            setEditLastName(data.person.lastName);
            setEditKhmerName(data.person.khmerName || "");
            setEditGender(data.person.gender || "UNKNOWN");
            setEditBirthYear(data.person.birthYear ? String(data.person.birthYear) : "");
            setEditDeathYear(data.person.deathYear ? String(data.person.deathYear) : "");
            setEditIsLiving(data.person.isLiving ?? true);
            setEditPhotoUrl(data.person.photoUrl || "");
            setEditBio(data.person.biography || "");
          }
        }
      } catch (err) {
        console.error("Profile load error", err);
      } finally {
        setProfileLoading(false);
      }
    },
    [effectiveSpaceId]
  );

  // Focus and Fly to Person on Search or Link, uncollapsing ancestors if needed
  const handleSelectSearchResult = useCallback(
    (personId: string) => {
      // Uncollapse ancestors of this person if collapsed
      setCollapsedNodeIds((prev) => {
        if (prev.size === 0) return prev;
        const next = new Set(prev);
        next.delete(personId);
        let cur = personId;
        const visited = new Set<string>();
        while (cur && !visited.has(cur)) {
          visited.add(cur);
          const pRels = relationships.filter(
            (r) =>
              r.status === "CONFIRMED" &&
              (r.type === "PARENT_CHILD" || r.type === "ADOPTIVE_PARENT_CHILD") &&
              r.relatedPersonId === cur
          );
          for (const rel of pRels) {
            next.delete(rel.personId);
            cur = rel.personId;
          }
          if (pRels.length === 0) break;
        }
        return next;
      });

      setSelectedPersonId(personId);

      setTimeout(() => {
        const targetNode = nodes.find(
          (n) =>
            n.id === personId ||
            (n.data as any)?.spouse?.id === personId ||
            (n.data as any)?.spouseIds?.includes(personId)
        );
        if (targetNode) {
          const currentViewport = reactFlowRef.current?.getViewport() || reactFlowInstance.getViewport();
          reactFlowRef.current?.setCenter(
            targetNode.position.x + 120,
            targetNode.position.y + 65,
            { zoom: currentViewport.zoom, duration: 600 }
          );
          const isSmallScreen = typeof window !== "undefined" && window.innerWidth < 640;
          if (!isSmallScreen || mobileViewMode === "MAP") {
            handleNodeClick({} as React.MouseEvent, targetNode);
          }
        }
      }, 100);
    },
    [nodes, relationships, handleNodeClick, mobileViewMode]
  );

  // Handle URL focusPersonId once nodes are loaded
  useEffect(() => {
    if (focusParamId && nodes.length > 0 && !loading) {
      const timer = setTimeout(() => {
        handleSelectSearchResult(focusParamId);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [focusParamId, nodes.length, loading, handleSelectSearchResult]);

  // Hierarchy Actions: Expand All, Collapse to Gen 3, Fit to Screen
  const handleExpandAll = useCallback(() => {
    const emptySet = new Set<string>();
    setCollapsedNodeIds(emptySet);
    applyLayout(emptySet, people, relationships, focusedDescendantPersonId, isCompactLayout);
    setTimeout(() => {
      reactFlowRef.current?.fitView({
        padding: typeof window !== "undefined" && window.innerWidth < 768 ? 0.08 : 0.15,
        minZoom: 0.15,
        maxZoom: 1.1,
        duration: 450,
      });
    }, 80);
  }, [applyLayout, people, relationships, focusedDescendantPersonId, isCompactLayout]);

  const handleCollapseToGen3 = useCallback(() => {
    const gen3Set = getGen3CollapsedNodeIds(people, relationships);
    setCollapsedNodeIds(gen3Set);
    applyLayout(gen3Set, people, relationships, focusedDescendantPersonId, isCompactLayout);
    setTimeout(() => {
      reactFlowRef.current?.fitView({
        padding: typeof window !== "undefined" && window.innerWidth < 768 ? 0.08 : 0.15,
        minZoom: 0.15,
        maxZoom: 1.1,
        duration: 450,
      });
    }, 80);
  }, [applyLayout, people, relationships, focusedDescendantPersonId, isCompactLayout]);

  const handleFitToScreen = useCallback(() => {
    reactFlowRef.current?.fitView({
      padding: typeof window !== "undefined" && window.innerWidth < 768 ? 0.08 : 0.15,
      minZoom: 0.15,
      maxZoom: 1.1,
      duration: 400,
    });
  }, []);

  // Toolbar Actions: Entire Tree, My Branch, Find Myself, Fit Branch, Fit Overview, Zoom controls
  const handleEntireTree = () => {
    setSelectedBranchFilter(null);
    setFocusedDescendantPersonId(null);
    const emptySet = new Set<string>();
    setCollapsedNodeIds(emptySet);
    applyLayout(emptySet, people, relationships, null, isCompactLayout);
    setTimeout(() => {
      reactFlowRef.current?.fitView({ padding: 0.18, minZoom: 0.05, maxZoom: 1.2, duration: 500 });
    }, 80);
  };

  const handleMyBranch = () => {
    if (!linkedPersonId) {
      handleEntireTree();
      return;
    }
    const myBranch = branches.find((b) => b.id === linkedPersonId);
    if (myBranch) {
      setSelectedBranchFilter(myBranch.id);
      const newCollapsed = new Set<string>();
      for (const b of branches) {
        if (b.id !== myBranch.id) newCollapsed.add(b.id);
      }
      setCollapsedNodeIds(newCollapsed);
      applyLayout(newCollapsed, people, relationships, null, isCompactLayout);
    }
    handleSelectSearchResult(linkedPersonId);
  };

  const handleFitBranch = () => {
    const currentBranchId =
      selectedBranchFilter ||
      (activeProfile ? (branches.find((b) => b.id === activeProfile.id)?.id || activeProfile.id) : null);

    const targetNodes = currentBranchId
      ? nodes.filter(
          (n) =>
            (n.data as unknown as { branch?: BranchInfo })?.branch?.id === currentBranchId ||
            highlightedNodeIds.has(n.id)
        )
      : nodes.filter((n) => highlightedNodeIds.has(n.id));

    if (targetNodes.length > 0) {
      reactFlowRef.current?.fitView({
        nodes: targetNodes,
        padding: 0.22,
        minZoom: 0.65,
        maxZoom: 1.1,
        duration: 600,
      });
    } else {
      reactFlowRef.current?.fitView({ padding: 0.18, minZoom: 0.05, maxZoom: 1.2, duration: 500 });
    }
  };

  const handleFitOverview = () => {
    reactFlowInstance.fitView({ padding: 0.2, duration: 500 });
  };

  const handleFindPerson = () => {
    searchInputRef.current?.focus();
  };

  const handleFindMyself = () => {
    const targetId = linkedPersonId || (people.length > 0 ? people[0].id : null);
    if (!targetId) return;
    handleSelectSearchResult(targetId);
  };



  const handleToggleTheme = useCallback(() => {
    const next = treeTheme === "light" ? "dark" : "light";
    setTreeTheme(next);
    treeThemeRef.current = next;
    try {
      localStorage.setItem("familytree_theme", next);
    } catch {
      // ignore
    }
    setNodes((prev) =>
      prev.map((n) => ({
        ...n,
        data: {
          ...(n.data as unknown as Record<string, unknown>),
          theme: next,
        },
      }))
    );
  }, [treeTheme, setNodes]);

  const handleToggleCompactLayout = () => {
    const next = !isCompactLayout;
    setIsCompactLayout(next);
    applyLayout(collapsedNodeIds, people, relationships, focusedDescendantPersonId, next);
  };

  const handleFocusDescendants = (personId?: string) => {
    const targetId = personId || activeProfile?.id || selectedPersonId;
    if (!targetId) return;

    // Toggle behavior: if already focused on this person, clicking again cancels/clears focus
    if (focusedDescendantPersonId === targetId) {
      setFocusedDescendantPersonId(null);
      applyLayout(collapsedNodeIds, people, relationships, null, isCompactLayout);
      setTimeout(() => {
        handleFitOverview();
      }, 100);
      return;
    }

    setFocusedDescendantPersonId(targetId);
    setSelectedBranchFilter(null);
    applyLayout(collapsedNodeIds, people, relationships, targetId, isCompactLayout);

    setTimeout(() => {
      reactFlowRef.current?.fitView({
        padding: 0.25,
        minZoom: 0.65,
        maxZoom: 1.1,
        duration: 700,
      });
    }, 100);
  };

  const handleClearFocusDescendants = () => {
    setFocusedDescendantPersonId(null);
    applyLayout(collapsedNodeIds, people, relationships, null, isCompactLayout);
    setTimeout(() => {
      handleFitOverview();
    }, 100);
  };

  // Action: "Focus Branch" toggle
  const handleToggleFocusBranch = () => {
    if (!selectedPersonId) return;
    const nextState = !isBranchFocused;
    setIsBranchFocused(nextState);

    if (nextState) {
      const targetNodes = nodes.filter((n) => highlightedNodeIds.has(n.id));
      if (targetNodes.length > 0) {
        reactFlowRef.current?.fitView({
          nodes: targetNodes,
          duration: 800,
          padding: 0.25,
        });
      }
    } else {
      reactFlowRef.current?.fitView({ duration: 600, padding: 0.15 });
    }
  };

  // Auto-Save helper for Add Family Member draft
  const updateAddRelativeDraft = (fields: Partial<{
    firstName: string;
    lastName: string;
    khmerName: string;
    gender: string;
    birthYear: string;
    deathYear: string;
    isLiving: boolean;
    photoUrl: string;
    bio: string;
  }>) => {
    try {
      const draft = {
        firstName: fields.firstName !== undefined ? fields.firstName : addFirstName,
        lastName: fields.lastName !== undefined ? fields.lastName : addLastName,
        khmerName: fields.khmerName !== undefined ? fields.khmerName : addKhmerName,
        gender: fields.gender !== undefined ? fields.gender : addGender,
        birthYear: fields.birthYear !== undefined ? fields.birthYear : addBirthYear,
        deathYear: fields.deathYear !== undefined ? fields.deathYear : addDeathYear,
        isLiving: fields.isLiving !== undefined ? fields.isLiving : addIsLiving,
        photoUrl: fields.photoUrl !== undefined ? fields.photoUrl : addPhotoUrl,
        bio: fields.bio !== undefined ? fields.bio : addBio,
      };
      localStorage.setItem("familytree_add_draft", JSON.stringify(draft));
    } catch {
      // ignore
    }
  };

  // Open Add Member Modal with intelligent anchor default & draft restore
  const handleOpenAddModal = (
    presetAnchorId?: string,
    presetRelType: "CHILD" | "SPOUSE" | "PARENT" | "SIBLING" | "NONE" = "CHILD"
  ) => {
    setAddStep("FORM");
    setAddError(null);

    let initialFirst = "";
    let initialLast = "";
    let initialKhmer = "";
    let initialGender = "UNKNOWN";
    let initialBirth = "";
    let initialDeath = "";
    let initialIsLiving = true;
    let initialPhoto = "";
    let initialBio = "";

    try {
      const savedDraft = localStorage.getItem("familytree_add_draft");
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (parsed.firstName) initialFirst = parsed.firstName;
        if (parsed.lastName) initialLast = parsed.lastName;
        if (parsed.khmerName) initialKhmer = parsed.khmerName;
        if (parsed.gender) initialGender = parsed.gender;
        if (parsed.birthYear) initialBirth = parsed.birthYear;
        if (parsed.deathYear) initialDeath = parsed.deathYear;
        if (parsed.isLiving !== undefined) initialIsLiving = parsed.isLiving;
        if (parsed.photoUrl) initialPhoto = parsed.photoUrl;
        if (parsed.bio) initialBio = parsed.bio;
      }
    } catch {
      // ignore
    }

    setAddFirstName(initialFirst);
    setAddLastName(initialLast);
    setAddKhmerName(initialKhmer);
    setAddGender(initialGender);
    setAddBirthYear(initialBirth);
    setAddDeathYear(initialDeath);
    setAddIsLiving(initialIsLiving);
    setAddPhotoUrl(initialPhoto);
    setAddBio(initialBio);
    setAddAlsoLinkSpouse(false);

    if (people.length === 0) {
      setAddRelType("NONE");
      setAddAnchorId("");
    } else {
      const anchor =
        presetAnchorId ||
        selectedPersonId ||
        activeProfile?.id ||
        (linkedPersonId && !isCouncil ? linkedPersonId : people[0]?.id) ||
        "";
      setAddAnchorId(anchor);
      setAddRelType(presetRelType);

      // Auto infer complementary gender if adding spouse
      if (presetRelType === "SPOUSE" && anchor) {
        const anchorP = people.find((p) => p.id === anchor);
        if (anchorP) {
          if (anchorP.gender === "MALE") {
            setAddGender("FEMALE");
          } else if (anchorP.gender === "FEMALE") {
            setAddGender("MALE");
          }
        }
      }
    }

    setShowAddModal(true);
  };

  // Kinship Calculation
  const handleCalculateKinship = async () => {
    if (!kinshipP1 || !kinshipP2) return;
    setCalculatingKinship(true);
    setKinshipError(null);
    setKinshipResult(null);

    try {
      const res = await fetch(`/api/spaces/${effectiveSpaceId}/kinship`, {
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

  // Live Auto-Refresh: Polling every 15 seconds to sync other cousins' changes smoothly
  useEffect(() => {
    let timer: NodeJS.Timeout;

    const pollSync = async () => {
      // Don't poll if document is hidden or user is actively typing in edit/add modals
      if (document.hidden || isEditing || savingProfile || submittingAdd) return;
      try {
        const url = effectiveSpaceId ? `/api/spaces/${effectiveSpaceId}/tree` : `/api/tree`;
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        const newPeople: TreePerson[] = data.people || [];
        const newRels: TreeRelationship[] = data.relationships || [];

        setPeople((currentPeople) => {
          if (newPeople.length !== currentPeople.length) {
            // Relative count changed - recompute layout smoothly preserving current zoom
            setTimeout(() => {
              applyLayoutRef.current(collapsedNodeIds, newPeople, newRels, focusedDescendantPersonId, isCompactLayout);
            }, 60);
            return newPeople;
          }
          return currentPeople;
        });
        setRelationships(newRels);
      } catch {
        // Ignore background polling errors
      }
    };

    timer = setInterval(pollSync, 15000);

    const handleVisibility = () => {
      if (!document.hidden) pollSync();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [effectiveSpaceId, isEditing, savingProfile, submittingAdd, collapsedNodeIds, focusedDescendantPersonId, isCompactLayout]);

  // Debounced Auto-Save for cousin profile editing
  const triggerAutoSave = useCallback(
    (updatedFields: Partial<{
      firstName: string;
      lastName: string;
      gender: string;
      birthYear: string;
      deathYear: string;
      isLiving: boolean;
      bio: string;
    }>) => {
      if (!activeProfile) return;

      const currentData = {
        personId: activeProfile.id,
        firstName: updatedFields.firstName !== undefined ? updatedFields.firstName : editFirstName,
        lastName: updatedFields.lastName !== undefined ? updatedFields.lastName : editLastName,
        gender: updatedFields.gender !== undefined ? updatedFields.gender : editGender,
        birthYear: updatedFields.birthYear !== undefined ? updatedFields.birthYear : editBirthYear,
        deathYear: updatedFields.deathYear !== undefined ? updatedFields.deathYear : editDeathYear,
        isLiving: updatedFields.isLiving !== undefined ? updatedFields.isLiving : editIsLiving,
        bio: updatedFields.bio !== undefined ? updatedFields.bio : editBio,
      };

      pendingEditsRef.current = currentData;
      setAutoSaveStatus("saving");
      setAutoSaveMessage(language === "km" ? "កំពុងរក្សាទុកស្វ័យប្រវត្តិ..." : "Auto-saving...");

      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }

      autoSaveTimerRef.current = setTimeout(async () => {
        try {
          const dataToSave = pendingEditsRef.current;
          if (!dataToSave || !dataToSave.firstName.trim() || !dataToSave.lastName.trim()) {
            setAutoSaveStatus("idle");
            return;
          }

          // Clean birth year
          const rawYear = dataToSave.birthYear ? cleanYearInput(dataToSave.birthYear) : "";
          let parsedBirthYear: number | null = null;
          if (rawYear) {
            if (rawYear.length < 4) {
              // User is still typing digits (1, 19, 196) - wait until 4 digits before sending
              setAutoSaveStatus("idle");
              return;
            }
            parsedBirthYear = parseInt(rawYear, 10);
            if (isNaN(parsedBirthYear) || parsedBirthYear < 1000 || parsedBirthYear > 2050) {
              parsedBirthYear = null;
            }
          }

          // Clean death year if deceased
          const rawDeath = !dataToSave.isLiving && dataToSave.deathYear ? cleanYearInput(dataToSave.deathYear) : "";
          let parsedDeathYear: number | null = null;
          if (rawDeath) {
            const yr = parseInt(rawDeath, 10);
            if (!isNaN(yr) && yr >= 1000 && yr <= 2050) {
              parsedDeathYear = yr;
            }
          }

          const fullName = `${dataToSave.lastName.trim()} ${dataToSave.firstName.trim()}`.trim();

          const res = await fetch(`/api/spaces/${effectiveSpaceId}/people/${dataToSave.personId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              firstName: dataToSave.firstName.trim(),
              lastName: dataToSave.lastName.trim(),
              khmerName: fullName || null,
              gender: dataToSave.gender,
              birthYear: parsedBirthYear,
              deathYear: parsedDeathYear,
              isLiving: dataToSave.isLiving,
              biography: dataToSave.bio.trim() || null,
            }),
          });

          if (!res.ok) {
            throw new Error("Save failed");
          }

          // Sync update to Firebase Realtime Database
          updatePersonInRTDB(effectiveSpaceId, dataToSave.personId, {
            firstName: dataToSave.firstName.trim(),
            lastName: dataToSave.lastName.trim(),
            khmerName: fullName || null,
            gender: dataToSave.gender as TreePerson["gender"],
            birthYear: parsedBirthYear,
            deathYear: parsedDeathYear,
            isLiving: dataToSave.isLiving,
            biography: dataToSave.bio.trim() || null,
          }).catch(console.warn);

          setAutoSaveStatus("saved");
          setAutoSaveMessage(language === "km" ? "បានរក្សាទុកស្វ័យប្រវត្តិ ✓" : "Auto-saved ✓");

          // Update active profile in memory
          setActiveProfile((prev) =>
            prev && prev.id === dataToSave.personId
              ? {
                  ...prev,
                  firstName: dataToSave.firstName.trim(),
                  lastName: dataToSave.lastName.trim(),
                  khmerName: fullName || null,
                  gender: dataToSave.gender as TreePerson["gender"],
                  birthYear: parsedBirthYear,
                  deathYear: parsedDeathYear,
                  isLiving: dataToSave.isLiving,
                  biography: dataToSave.bio.trim() || null,
                }
              : prev
          );

          // Update people in memory
          setPeople((prev) =>
            prev.map((p) =>
              p.id === dataToSave.personId
                ? {
                    ...p,
                    firstName: dataToSave.firstName.trim(),
                    lastName: dataToSave.lastName.trim(),
                    khmerName: fullName || null,
                    gender: dataToSave.gender as TreePerson["gender"],
                    birthYear: parsedBirthYear,
                    deathYear: parsedDeathYear,
                    isLiving: dataToSave.isLiving,
                    biography: dataToSave.bio.trim() || null,
                  }
                : p
            )
          );

          // Smoothly update visual node without re-centering canvas
          setNodes((prev) =>
            prev.map((n) => {
              if (n.id !== dataToSave.personId) return n;
              const nodeData = n.data as unknown as { person: TreePerson };
              return {
                ...n,
                data: {
                  ...nodeData,
                  person: {
                    ...nodeData.person,
                    firstName: dataToSave.firstName.trim(),
                    lastName: dataToSave.lastName.trim(),
                    khmerName: fullName || null,
                    gender: dataToSave.gender as TreePerson["gender"],
                    birthYear: parsedBirthYear,
                    deathYear: parsedDeathYear,
                    isLiving: dataToSave.isLiving,
                    biography: dataToSave.bio.trim() || null,
                  },
                },
              };
            })
          );
        } catch (err) {
          console.error("Auto-save error", err);
          setAutoSaveStatus("error");
          setAutoSaveMessage(language === "km" ? "បរាជ័យក្នុងការរក្សាទុក" : "Auto-save failed");
        }
      }, 750);
    },
    [activeProfile, editFirstName, editLastName, editGender, editBirthYear, editDeathYear, editIsLiving, editBio, effectiveSpaceId, language, setNodes]
  );

  // Save Profile Edit (Immediate manual submit)
  const handleSaveProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeProfile) return;
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    setSavingProfile(true);
    setEditError(null);

    try {
      const rawYear = editBirthYear ? cleanYearInput(editBirthYear) : "";
      let parsedBirthYear: number | null = null;
      if (rawYear) {
        const yr = parseInt(rawYear, 10);
        if (!isNaN(yr) && yr >= 1000 && yr <= 2050) {
          parsedBirthYear = yr;
        }
      }
      const rawDeath = !editIsLiving && editDeathYear ? cleanYearInput(editDeathYear) : "";
      let parsedDeathYear: number | null = null;
      if (rawDeath) {
        const yr = parseInt(rawDeath, 10);
        if (!isNaN(yr) && yr >= 1000 && yr <= 2050) {
          parsedDeathYear = yr;
        }
      }
      const fullName = `${editLastName.trim()} ${editFirstName.trim()}`.trim();

      const res = await fetch(`/api/spaces/${effectiveSpaceId}/people/${activeProfile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: editFirstName.trim(),
          lastName: editLastName.trim(),
          khmerName: fullName || null,
          gender: editGender,
          birthYear: parsedBirthYear,
          deathYear: parsedDeathYear,
          isLiving: editIsLiving,
          biography: editBio.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update profile");
      }

      // Update active profile state
      setActiveProfile((prev) =>
        prev
          ? {
              ...prev,
              firstName: editFirstName.trim(),
              lastName: editLastName.trim(),
              khmerName: fullName || null,
              gender: editGender as TreePerson["gender"],
              birthYear: parsedBirthYear,
              deathYear: parsedDeathYear,
              isLiving: editIsLiving,
              biography: editBio.trim() || null,
            }
          : null
      );

      setAutoSaveStatus("saved");
      setAutoSaveMessage(language === "km" ? "បានរក្សាទុកស្វ័យប្រវត្តិ ✓" : "Auto-saved ✓");
      setIsEditing(false);
      setNotification({
        type: "success",
        message: language === "km"
          ? "ព័ត៌មានសមាជិកគ្រួសារត្រូវបានរក្សាទុកដោយជោគជ័យ!"
          : "Family member details saved successfully!",
      });

      // Refresh tree node
      await loadTree(activeProfile.id);
    } catch (err: unknown) {
      const e = err as Error;
      setEditError(e.message);
    } finally {
      setSavingProfile(false);
    }
  };

  // Submit Add Family Member
  const handleConfirmAddMember = async () => {
    setSubmittingAdd(true);
    setAddError(null);

    try {
      const rawBirthYear = addBirthYear ? cleanYearInput(addBirthYear) : "";
      let parsedBirthYear: number | null = null;
      if (rawBirthYear) {
        const yr = parseInt(rawBirthYear, 10);
        if (!isNaN(yr) && yr >= 1000 && yr <= 2050) {
          parsedBirthYear = yr;
        }
      }

      const rawDeathYear = !addIsLiving && addDeathYear ? cleanYearInput(addDeathYear) : "";
      let parsedDeathYear: number | null = null;
      if (rawDeathYear) {
        const yr = parseInt(rawDeathYear, 10);
        if (!isNaN(yr) && yr >= 1000 && yr <= 2050) {
          parsedDeathYear = yr;
        }
      }

      const fullName = `${addLastName.trim()} ${addFirstName.trim()}`.trim();

      const payload = {
        firstName: addFirstName.trim(),
        lastName: addLastName.trim(),
        khmerName: fullName || null,
        gender: addGender,
        birthYear: parsedBirthYear,
        deathYear: parsedDeathYear,
        isLiving: addIsLiving,
        biography: addBio.trim() || null,
        relationship:
          addRelType !== "NONE" && addAnchorId
            ? {
                type: addRelType,
                anchorPersonId: addAnchorId,
                alsoLinkSpouse: addAlsoLinkSpouse,
              }
            : { type: "NONE" },
      };

      const res = await fetch(`/api/spaces/${effectiveSpaceId}/people`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to add family member");
      }

      // Sync to Firebase Realtime Database
      if (data.person) {
        addPersonToRTDB(effectiveSpaceId, data.person, data.relationships || []).catch(console.warn);
      }

      try {
        localStorage.removeItem("familytree_add_draft");
      } catch {
        // ignore
      }

      setShowAddModal(false);
      setNotification({
        type: "success",
        message: "សមាជិកគ្រួសារត្រូវបានបញ្ចូល និងតភ្ជាប់ទៅក្នុងដើមឈើដោយជោគជ័យ!",
      });

      // Refresh tree and highlight newly created relative
      await loadTree(data.person?.id);
    } catch (err: unknown) {
      const e = err as Error;
      setAddError(e.message);
    } finally {
      setSubmittingAdd(false);
    }
  };

  // Remove Family Member
  const handleConfirmDeletePerson = async () => {
    if (!activeProfile) return;
    setDeletingPerson(true);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/spaces/${effectiveSpaceId}/people/${activeProfile.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to remove family member");
      }

      // Sync deletion to Firebase Realtime Database
      deletePersonFromRTDB(effectiveSpaceId, activeProfile.id, relationships).catch(console.warn);

      setShowDeleteModal(false);
      const deletedName =
        activeProfile.khmerName ||
        `${activeProfile.lastName} ${activeProfile.firstName}`.trim();
      setActiveProfile(null);
      setSelectedPersonId(null);
      setIsBranchFocused(false);

      setNotification({
        type: "success",
        message: `សមាជិក "${deletedName}" ត្រូវបានលុបចេញពីពង្សាវតារដោយជោគជ័យ។ អនុស្សាវរីយ៍និងសមាជិកដទៃត្រូវបានរក្សាទុកដោយសុវត្ថិភាព។`,
      });

      // Refresh tree immediately
      await loadTree();
    } catch (err: unknown) {
      const e = err as Error;
      setDeleteError(e.message);
    } finally {
      setDeletingPerson(false);
    }
  };

  // Direct actions called from nodes or floating UI
  const handleEditPersonDirectly = useCallback(
    async (personId: string) => {
      const p = people.find((item) => item.id === personId);
      if (!p) return;
      setSelectedPersonId(personId);
      setActiveProfile({
        ...p,
        parents: [],
        children: [],
        spouses: [],
        memories: [],
      });
      setEditFirstName(p.firstName || "");
      setEditLastName(p.lastName || "");
      setEditKhmerName(p.khmerName || "");
      setEditGender(p.gender || "UNKNOWN");
      setEditBirthYear(p.birthYear ? String(p.birthYear) : "");
      setEditDeathYear(p.deathYear ? String(p.deathYear) : "");
      setEditIsLiving(p.isLiving ?? true);
      setEditPhotoUrl(p.photoUrl || "");
      setEditBio(p.biography || "");
      setIsEditing(true);

      try {
        const res = await fetch(`/api/spaces/${effectiveSpaceId}/people/${personId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.person) {
            setActiveProfile(data.person);
            setEditFirstName(data.person.firstName);
            setEditLastName(data.person.lastName);
            setEditKhmerName(data.person.khmerName || "");
            setEditGender(data.person.gender || "UNKNOWN");
            setEditBirthYear(data.person.birthYear ? String(data.person.birthYear) : "");
            setEditDeathYear(data.person.deathYear ? String(data.person.deathYear) : "");
            setEditIsLiving(data.person.isLiving ?? true);
            setEditPhotoUrl(data.person.photoUrl || "");
            setEditBio(data.person.biography || "");
          }
        }
      } catch (err) {
        console.error("Profile load error", err);
      }
    },
    [people, effectiveSpaceId]
  );

  const handleDeletePersonDirectly = useCallback(
    async (personId: string) => {
      const p = people.find((item) => item.id === personId);
      if (!p) return;
      setSelectedPersonId(personId);
      setDeleteError(null);

      try {
        const res = await fetch(`/api/spaces/${effectiveSpaceId}/people/${personId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.person) {
            setActiveProfile(data.person);
            setShowDeleteModal(true);
            return;
          }
        }
      } catch (err) {
        console.error("Profile load error for delete", err);
      }

      setActiveProfile({
        ...p,
        parents: [],
        children: [],
        spouses: [],
        memories: [],
      });
      setShowDeleteModal(true);
    },
    [people, effectiveSpaceId]
  );

  const handleSelectPersonDirectly = useCallback(
    async (personId: string) => {
      const p = people.find((item) => item.id === personId);
      if (!p) return;
      setSelectedPersonId(personId);
      setIsEditing(false);
      setActiveProfile({
        ...p,
        parents: [],
        children: [],
        spouses: [],
        memories: [],
      });
      setEditFirstName(p.firstName || "");
      setEditLastName(p.lastName || "");
      setEditKhmerName(p.khmerName || "");
      setEditGender(p.gender || "UNKNOWN");
      setEditBirthYear(p.birthYear ? String(p.birthYear) : "");
      setEditDeathYear(p.deathYear ? String(p.deathYear) : "");
      setEditIsLiving(p.isLiving ?? true);
      setEditPhotoUrl(p.photoUrl || "");
      setEditBio(p.biography || "");

      try {
        const res = await fetch(`/api/spaces/${effectiveSpaceId}/people/${personId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.person) {
            setActiveProfile(data.person);
            setEditFirstName(data.person.firstName);
            setEditLastName(data.person.lastName);
            setEditKhmerName(data.person.khmerName || "");
            setEditGender(data.person.gender || "UNKNOWN");
            setEditBirthYear(data.person.birthYear ? String(data.person.birthYear) : "");
            setEditDeathYear(data.person.deathYear ? String(data.person.deathYear) : "");
            setEditIsLiving(data.person.isLiving ?? true);
            setEditPhotoUrl(data.person.photoUrl || "");
            setEditBio(data.person.biography || "");
          }
        }
      } catch (err) {
        console.error("Profile load error", err);
      }
    },
    [people, effectiveSpaceId]
  );

  useEffect(() => {
    handleOpenAddModalRef.current = handleOpenAddModal;
    handleEditPersonDirectlyRef.current = handleEditPersonDirectly;
    handleDeletePersonDirectlyRef.current = handleDeletePersonDirectly;
    handleSelectPersonDirectlyRef.current = handleSelectPersonDirectly;
  });

  // Filtered search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return people
      .filter(
        (p) =>
          p.firstName.toLowerCase().includes(q) ||
          p.lastName.toLowerCase().includes(q) ||
          (p.khmerName && p.khmerName.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [searchQuery, people]);

  const selectedAnchorPerson = useMemo(() => {
    return people.find((p) => p.id === addAnchorId);
  }, [people, addAnchorId]);

  return (
    <div
      className={`h-screen w-screen flex flex-col overflow-hidden font-khmer select-none transition-colors duration-200 ${
        treeTheme === "light" ? "bg-[#f8fafc] text-slate-900" : "bg-[#0c0f14] text-white"
      }`}
    >
      {/* Floating Notification Toast */}
      {notification && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
          <div
            className={`px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-medium border ${
              notification.type === "success"
                ? "bg-emerald-950/95 border-emerald-500/50 text-emerald-200"
                : "bg-rose-950/95 border-rose-500/50 text-rose-200"
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{notification.message}</span>
            <button
              type="button"
              onClick={() => setNotification(null)}
              className="ml-2 hover:opacity-80 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Canvas Area (Full Screen Graph Map) */}
      <div ref={wrapperRef} className="react-flow-wrapper overflow-hidden flex-1 relative w-full h-full bg-[#f2f8ff]">
        {/* Soft Ambient Glows: top-left rgba(120,180,255,.25), bottom-right rgba(150,230,220,.22) */}
        <div
          className="absolute top-0 left-0 w-[55vw] h-[55vh] pointer-events-none z-10"
          style={{
            background: "radial-gradient(circle at 0% 0%, rgba(120, 180, 255, 0.25) 0%, transparent 65%)",
          }}
        />
        <div
          className="absolute bottom-0 right-0 w-[55vw] h-[55vh] pointer-events-none z-10"
          style={{
            background: "radial-gradient(circle at 100% 100%, rgba(150, 230, 220, 0.22) 0%, transparent 65%)",
          }}
        />

        {/* Frosted-glass floating header bar (white at 90% opacity, blur 10px) */}
        <div
          className="absolute top-2 inset-x-2 sm:inset-x-auto sm:top-4 sm:left-4 z-30 flex items-center justify-between sm:justify-start gap-1.5 sm:gap-3 px-3 sm:px-4 py-1.5 sm:py-2 rounded-2xl sm:rounded-full border border-[#dbe7f5] shadow-lg shadow-[#2f7de1]/10 font-khmer select-none"
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.92)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
          }}
        >
          {/* Family title & member count */}
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 shrink">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#2f7de1] to-[#1c57b8] flex items-center justify-center text-white shadow-sm shrink-0">
              <TreePine className="w-4 h-4" />
            </div>
            <h1 className="text-xs sm:text-sm font-bold text-[#1c2e48] leading-tight max-w-[120px] xs:max-w-[150px] sm:max-w-xs truncate">
              {spaceInfo?.name || t.nav.tree}
            </h1>
            <span className="hidden xs:inline-flex px-1.5 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold bg-[#ebf3fc] text-[#2f7de1] border border-[#dbe7f5] shrink-0">
              {people.length}
            </span>
            {isLiveConnected && (
              <span
                className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shrink-0"
                title="ភ្ជាប់ទៅកាន់ Firebase Realtime Database រួចរាល់"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Live</span>
              </span>
            )}
          </div>

          <div className="h-5 w-px bg-[#dbe7f5] shrink-0 hidden sm:block" />

          {/* Search box - flexible on mobile */}
          <div className="relative flex-1 sm:flex-initial max-w-[140px] xs:max-w-[170px] sm:max-w-none">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-[#6a7f99] absolute left-2.5 pointer-events-none" />
              <input
                ref={searchInputRef}
                id="input-tree-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={language === "km" ? "ស្វែងរក..." : "Search..."}
                className="w-full sm:w-44 pl-7 pr-2.5 py-1 sm:py-1.5 bg-[#f8fbff] hover:bg-white focus:bg-white border border-[#dbe7f5] rounded-full text-xs text-[#1c2e48] placeholder:text-[#6a7f99] focus:sm:w-56 focus:border-[#2f7de1] focus:ring-2 focus:ring-[#2f7de1]/20 transition-all outline-none"
              />
            </div>

            {/* Search Dropdown */}
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 sm:right-auto mt-2 w-64 sm:w-72 bg-white border border-[#dbe7f5] rounded-2xl shadow-xl shadow-[#2f7de1]/15 z-50 overflow-hidden divide-y divide-[#ebf3fc]">
                {searchResults.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => {
                      handleSelectSearchResult(person.id);
                      setSearchQuery("");
                    }}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-[#ebf3fc] flex items-center justify-between text-xs transition-colors cursor-pointer"
                  >
                    <div className="truncate">
                      <span className="font-bold text-[#1c2e48] block truncate font-khmer">
                        {person.khmerName || `${person.lastName} ${person.firstName}`.trim()}
                      </span>
                      {person.khmerName && (
                        <span className="text-[10px] text-[#6a7f99] block truncate">
                          {`${person.lastName} ${person.firstName}`.trim()}
                        </span>
                      )}
                    </div>
                    {person.birthYear && (
                      <span className="text-[10px] text-[#6a7f99] font-mono shrink-0 ml-2">
                        {person.birthYear}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Mobile View Switcher Pill (Relationships vs Tree Map) */}
          <div className="flex sm:hidden items-center bg-[#eef5fc] p-0.5 rounded-full border border-[#dbe7f5] shrink-0">
            <button
              type="button"
              onClick={() => setMobileViewMode("CARDS")}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                mobileViewMode === "CARDS"
                  ? "bg-[#2f7de1] text-white shadow-xs"
                  : "text-[#5b718a]"
              }`}
            >
              <Sparkles className="w-3 h-3" />
              <span>{language === "km" ? "ខ្សែញាតិ" : "Relatives"}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileViewMode("MAP");
                setTimeout(() => {
                  reactFlowRef.current?.fitView({
                    padding: 0.08,
                    minZoom: 0.15,
                    maxZoom: 1.1,
                    duration: 350,
                  });
                }, 80);
              }}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                mobileViewMode === "MAP"
                  ? "bg-[#2f7de1] text-white shadow-xs"
                  : "text-[#5b718a]"
              }`}
            >
              <TreePine className="w-3 h-3" />
              <span>{language === "km" ? "ផែនទី" : "Map"}</span>
            </button>
          </div>

          {/* Desktop "Add member" Button: on mobile accessed through floating bottom dock */}
          {canAddRelative && (
            <button
              id="btn-floating-add-member"
              type="button"
              onClick={() => handleOpenAddModal()}
              className="hidden sm:flex px-4 py-1.5 rounded-full bg-gradient-to-r from-[#4a95ee] to-[#2467cc] hover:from-[#3b87e3] hover:to-[#1c57b8] text-white font-semibold text-xs items-center gap-1 shadow-md shadow-[#2f7de1]/25 hover:shadow-lg hover:shadow-[#2f7de1]/35 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer font-khmer shrink-0"
              title="បន្ថែមសមាជិកគ្រួសារថ្មី (Add family member)"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{language === "km" ? "បន្ថែមសមាជិក" : "Add Member"}</span>
            </button>
          )}
        </div>

        {/* Quick Hierarchy Action Controls (Expand all, Collapse to Gen 3, Fit to screen) */}
        <div
          className={`absolute top-12 xs:top-14 sm:top-4 sm:left-[460px] z-30 ${
            mobileViewMode === "CARDS" ? "hidden sm:flex" : "flex"
          } items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 rounded-2xl sm:rounded-full border border-[#dbe7f5] shadow-md font-khmer select-none`}
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.94)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
          }}
        >
          {/* Expand all button */}
          <button
            id="btn-expand-all"
            type="button"
            onClick={handleExpandAll}
            className="px-2 py-1 rounded-full text-[11px] sm:text-xs font-semibold text-[#1c2e48] hover:text-[#2f7de1] hover:bg-[#ebf3fc] transition-all cursor-pointer flex items-center gap-1"
            title="បើកមើលគ្រប់ជំនាន់ទាំងអស់ (Expand all generations)"
          >
            <FolderTree className="w-3.5 h-3.5 text-[#2f7de1]" />
            <span>{language === "km" ? "បើកទាំងអស់" : "Expand all"}</span>
          </button>

          <div className="h-3.5 w-px bg-[#dbe7f5]" />

          {/* Collapse to Gen 3 button */}
          <button
            id="btn-collapse-gen3"
            type="button"
            onClick={handleCollapseToGen3}
            className="px-2 py-1 rounded-full text-[11px] sm:text-xs font-semibold text-[#1c2e48] hover:text-[#2f7de1] hover:bg-[#ebf3fc] transition-all cursor-pointer flex items-center gap-1"
            title="បង្រួមកូនចៅត្រឹមជំនាន់ទី ៣ (Collapse to Gen 3)"
          >
            <Layers className="w-3.5 h-3.5 text-[#f59e0b]" />
            <span>{language === "km" ? "បង្រួមត្រឹមជំនាន់ទី ៣" : "Collapse to Gen 3"}</span>
          </button>

          <div className="h-3.5 w-px bg-[#dbe7f5]" />

          {/* Fit to screen button */}
          <button
            id="btn-fit-screen"
            type="button"
            onClick={handleFitToScreen}
            className="px-2 py-1 rounded-full text-[11px] sm:text-xs font-semibold text-[#1c2e48] hover:text-[#2f7de1] hover:bg-[#ebf3fc] transition-all cursor-pointer flex items-center gap-1"
            title="ទំហំពេញអេក្រង់ (Fit to screen)"
          >
            <Maximize2 className="w-3.5 h-3.5 text-[#10b981]" />
            <span>{language === "km" ? "ទំហំពេញអេក្រង់" : "Fit to screen"}</span>
          </button>
        </div>

        {/* Focus Descendants Active Banner (Floating Pill) */}
        {focusedDescendantPersonId && (
          <div className="absolute top-18 left-4 z-30 flex items-center gap-3 bg-amber-50 border border-amber-300 text-amber-950 px-3 py-1.5 rounded-xl shadow-md text-xs font-khmer animate-in slide-in-from-top-2">
            <div className="flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5 text-amber-600" />
              <span>
                {t.tree.focusingOnDescendants}{" "}
                <strong>
                  {people.find((p) => p.id === focusedDescendantPersonId)?.khmerName ||
                    `${people.find((p) => p.id === focusedDescendantPersonId)?.lastName} ${people.find((p) => p.id === focusedDescendantPersonId)?.firstName}`}
                </strong>
              </span>
            </div>
            <button
              type="button"
              onClick={handleClearFocusDescendants}
              className="px-2 py-0.5 rounded-lg bg-amber-600 text-white font-bold text-[11px] hover:bg-amber-700 transition-colors cursor-pointer"
            >
              {t.tree.viewAllTree}
            </button>
          </div>
        )}

        {loading ? (
          <div
            className={`absolute inset-0 flex items-center justify-center z-20 transition-colors ${
              treeTheme === "light" ? "bg-[#f8fafc]" : "bg-[#0c0f14]"
            }`}
          >
            <div className="text-center">
              <div className="w-10 h-10 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p
                className={`text-xs font-khmer ${
                  treeTheme === "light" ? "text-slate-600 font-medium" : "text-slate-400"
                }`}
              >
                {language === "km"
                  ? "កំពុងផ្ទុកដើមឈើគ្រួសារអន្តរកម្ម..."
                  : "Loading interactive family tree..."}
              </p>
            </div>
          </div>
        ) : errorMsg ? (
          <div
            className={`absolute inset-0 flex items-center justify-center p-4 z-20 transition-colors ${
              treeTheme === "light" ? "bg-[#f8fafc]" : "bg-[#0c0f14]"
            }`}
          >
            <div
              className={`p-6 max-w-md text-center rounded-2xl border ${
                treeTheme === "light"
                  ? "bg-white border-slate-200 shadow-xl"
                  : "heritage-card"
              }`}
            >
              <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-3" />
              <h3
                className={`text-base font-bold mb-2 font-khmer ${
                  treeTheme === "light" ? "text-slate-900" : "text-white"
                }`}
              >
                {language === "km" ? "បញ្ហាក្នុងការផ្ទុកដើមឈើ" : "Error Loading Tree"}
              </h3>
              <p className={`text-xs mb-4 ${treeTheme === "light" ? "text-slate-600" : "text-slate-400"}`}>
                {errorMsg}
              </p>
              <button
                type="button"
                onClick={() => loadTree()}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#d4af37] text-slate-950 hover:bg-[#e5c158]"
              >
                {language === "km" ? "ព្យាយាមម្តងទៀត" : "Try Again"}
              </button>
            </div>
          </div>
        ) : people.length === 0 ? (
          <div
            className={`absolute inset-0 flex items-center justify-center p-4 z-20 transition-colors ${
              treeTheme === "light" ? "bg-[#f8fafc]" : "bg-[#0c0f14]"
            }`}
          >
            <div
              className={`p-8 max-w-md text-center rounded-2xl border ${
                treeTheme === "light"
                  ? "bg-white border-slate-200 shadow-xl"
                  : "heritage-card"
              }`}
            >
              <TreePine className="w-12 h-12 text-[#d4af37] mx-auto mb-4" />
              <h3
                className={`text-lg font-bold font-heritage mb-2 font-khmer ${
                  treeTheme === "light" ? "text-slate-900" : "text-white"
                }`}
              >
                {t.tree.emptyTreeTitle}
              </h3>
              <p
                className={`text-xs mb-6 leading-relaxed font-khmer ${
                  treeTheme === "light" ? "text-slate-600" : "text-slate-400"
                }`}
              >
                {t.tree.emptyTreeDesc}
              </p>
              <button
                type="button"
                onClick={() => handleOpenAddModal()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#d4af37] text-slate-950 hover:bg-[#e5c158] transition-all shadow-md shadow-[#d4af37]/20 font-khmer cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{language === "km" ? "បន្ថែមសមាជិកគ្រួសារដំបូង" : "Add First Relative"}</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Mobile Easy Relationship Explorer (Default on mobile <640px when in CARDS mode) */}
            {mobileViewMode === "CARDS" && (
              <div className="sm:hidden absolute inset-0 z-20">
                <MobileRelationshipExplorer
                  people={people}
                  relationships={relationships}
                  selectedPersonId={selectedPersonId}
                  linkedPersonId={linkedPersonId}
                  language={language}
                  canEdit={canEditActive}
                  canDelete={canDeleteActive}
                  onSelectPerson={(id) => setSelectedPersonId(id)}
                  onOpenProfileDrawer={(id) => handleSelectPersonDirectly(id)}
                  onEditPerson={(id) => handleEditPersonDirectly(id)}
                  onDeletePerson={(id) => handleDeletePersonDirectly(id)}
                  onAddRelative={(anchorId, relType) => handleOpenAddModal(anchorId, relType)}
                  onClaimIdentity={(id) => handleClaimIdentity(id)}
                  onSwitchToMap={(focusId) => {
                    setMobileViewMode("MAP");
                    if (focusId) {
                      setTimeout(() => handleSelectSearchResult(focusId), 90);
                    }
                  }}
                />
              </div>
            )}

            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={handleNodeClick}
              nodeTypes={nodeTypes}
              defaultViewport={{ x: 80, y: 60, zoom: 0.85 }}
              minZoom={0.15}
              maxZoom={2.5}
              zoomOnScroll={false}
              zoomActivationKeyCode={["Control", "Meta"]}
              zoomOnPinch={true}
              zoomOnDoubleClick={false}
              panOnScroll={false}
              panOnDrag={true}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={true}
              preventScrolling={true}
              className="w-full h-full bg-[#f2f8ff] tree-theme-light touch-none"
              style={{ width: "100%", height: "100%" }}
            >
              <Background
                color="#c6dcf2"
                gap={24}
                size={1.5}
                style={{ opacity: 0.85 }}
              />
              {showMiniMap && (
                <MiniMap
                  nodeColor={(n) => ((n.data as any)?.generation === 0 ? "#fbbf24" : "#2f7de1")}
                  maskColor="rgba(242, 248, 255, 0.75)"
                  style={{
                    bottom: 80,
                    right: 20,
                    width: 170,
                    height: 110,
                    borderRadius: 12,
                    border: "1px solid #dbe7f5",
                    boxShadow: "0 4px 16px rgba(47, 125, 225, 0.12)",
                  }}
                />
              )}
            </ReactFlow>
          </>
        )}

        {/* Left-side Generation Labels (ជំនាន់ទី ១ ដល់ ជំនាន់ទី ៧) */}
        {Object.keys(generationYMap).length > 0 && (
          <div
            className={`${
              mobileViewMode === "CARDS" ? "hidden sm:block" : "block"
            } absolute top-0 left-0 bottom-0 pointer-events-none z-20 w-44 overflow-hidden select-none font-khmer`}
          >
            {Object.entries(generationYMap)
              .filter(([genStr]) => Number(genStr) < 7)
              .map(([genStr, canvasY]) => {
                const genNum = Number(genStr);
                const screenY = vpY + (canvasY + 31) * vpZoom;
                if (
                  screenY < -40 ||
                  screenY > (typeof window !== "undefined" ? window.innerHeight + 60 : 1000)
                ) {
                  return null;
                }

                const isRootGen = genNum === 0;
                const isHoriz = genNum <= 3; // Gen 1-4 horizontal, Gen 5-7 vertical

                return (
                  <div
                    key={genNum}
                    style={{ top: `${screenY}px` }}
                    className={`absolute left-2.5 -translate-y-1/2 flex items-center gap-1.5 px-2.5 py-1 rounded-full border shadow-sm backdrop-blur-xs text-[10.5px] font-bold pointer-events-auto transition-transform hover:scale-105 ${
                      isRootGen
                        ? "bg-amber-50/95 dark:bg-amber-950/90 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 ring-2 ring-amber-400/20"
                        : "bg-white/95 dark:bg-slate-900/90 border-[#dbe7f5] dark:border-slate-700 text-[#1c2e48] dark:text-slate-200"
                    }`}
                    title={`ជំនាន់ទី ${toKhmerNumber(genNum + 1)} (${isHoriz ? "ទម្រង់ផ្តេក" : "ទម្រង់បញ្ឈរ"})`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isRootGen
                          ? "bg-amber-500"
                          : isHoriz
                          ? "bg-emerald-500"
                          : "bg-sky-500"
                      }`}
                    />
                    <span>ជំនាន់ទី {toKhmerNumber(genNum + 1)}</span>
                    <span className="text-[8.5px] font-normal px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                      {isHoriz ? "ផ្តេក" : "បញ្ឈរ"}
                    </span>
                  </div>
                );
              })}
          </div>
        )}

        {/* Floating Zoom & Navigation Toolbar (Shifted up on mobile to leave room for bottom dock) */}
        <div
          className={`${
            mobileViewMode === "CARDS" ? "hidden sm:flex" : "flex"
          } absolute bottom-20 sm:bottom-6 right-3 sm:right-6 z-30 flex-col items-center gap-1.5 p-1.5 rounded-2xl bg-white/92 backdrop-blur-md border border-[#dbe7f5] shadow-xl shadow-[#2f7de1]/15 font-khmer select-none`}
        >
          <button
            id="btn-center-root"
            type="button"
            onClick={() => {
              const rootNode = nodes.find((n) => (n.data as any)?.generation === 0);
              if (rootNode) {
                reactFlowInstance.setCenter(
                  rootNode.position.x + 90,
                  rootNode.position.y + 31,
                  { zoom: 1, duration: 450 }
                );
              }
            }}
            className="w-10 h-10 sm:w-8 sm:h-8 rounded-xl bg-white hover:bg-[#ebf3fc] text-[#1c2e48] hover:text-[#2f7de1] active:scale-90 flex items-center justify-center transition-all shadow-xs cursor-pointer"
            title="ទៅកាន់មេគ្រួសារដើម (Center on Root Ancestor)"
            aria-label="Center on Root Ancestor"
          >
            <Compass className="w-4.5 h-4.5 sm:w-4 sm:h-4" />
          </button>
          <button
            id="btn-toggle-minimap"
            type="button"
            onClick={() => setShowMiniMap((prev) => !prev)}
            className={`w-10 h-10 sm:w-8 sm:h-8 rounded-xl ${
              showMiniMap
                ? "bg-sky-100 text-[#2f7de1] border border-sky-300"
                : "bg-white hover:bg-[#ebf3fc] text-[#1c2e48] hover:text-[#2f7de1]"
            } active:scale-90 flex items-center justify-center transition-all shadow-xs cursor-pointer`}
            title={showMiniMap ? "លាក់ផែនទីតូច (Hide Minimap)" : "បង្ហាញផែនទីតូច (Show Minimap)"}
            aria-label="Toggle Minimap"
          >
            <MapIcon className="w-4.5 h-4.5 sm:w-4 sm:h-4" />
          </button>
          <div className="w-5 h-px bg-[#dbe7f5] my-0.5" />
          <button
            id="btn-zoom-in"
            type="button"
            onClick={() => reactFlowInstance.zoomIn({ duration: 250 })}
            className="w-10 h-10 sm:w-8 sm:h-8 rounded-xl bg-white hover:bg-[#ebf3fc] text-[#1c2e48] hover:text-[#2f7de1] active:scale-90 flex items-center justify-center transition-all shadow-xs cursor-pointer"
            title="ពង្រីក (Zoom In)"
            aria-label="Zoom In"
          >
            <ZoomIn className="w-4.5 h-4.5 sm:w-4 sm:h-4" />
          </button>
          <button
            id="btn-zoom-out"
            type="button"
            onClick={() => reactFlowInstance.zoomOut({ duration: 250 })}
            className="w-10 h-10 sm:w-8 sm:h-8 rounded-xl bg-white hover:bg-[#ebf3fc] text-[#1c2e48] hover:text-[#2f7de1] active:scale-90 flex items-center justify-center transition-all shadow-xs cursor-pointer"
            title="បង្រួម (Zoom Out)"
            aria-label="Zoom Out"
          >
            <ZoomOut className="w-4.5 h-4.5 sm:w-4 sm:h-4" />
          </button>
          <div className="w-5 h-px bg-[#dbe7f5] my-0.5" />
          <button
            id="btn-fit-view"
            type="button"
            onClick={() =>
              reactFlowInstance.fitView({
                padding: typeof window !== "undefined" && window.innerWidth < 768 ? 0.08 : 0.16,
                minZoom: 0.15,
                maxZoom: 1.1,
                duration: 400,
              })
            }
            className="w-10 h-10 sm:w-8 sm:h-8 rounded-xl bg-white hover:bg-[#ebf3fc] text-[#1c2e48] hover:text-[#2f7de1] active:scale-90 flex items-center justify-center transition-all shadow-xs cursor-pointer"
            title="ទំហំពេញលេញល្អបំផុត (Fit for Best View)"
            aria-label="Fit for Best View"
          >
            <Maximize2 className="w-4.5 h-4.5 sm:w-4 sm:h-4" />
          </button>
        </div>

        {/* Mobile-First Floating Action Bottom Dock (Thumb-friendly for mobile phones) */}
        <div
          className="sm:hidden fixed bottom-3 inset-x-3 z-30 flex items-center justify-around px-2 py-2 rounded-2xl border border-[#dbe7f5] shadow-2xl font-khmer select-none"
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.96)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          {/* Smart Relationship Explorer vs Tree Map Toggle */}
          <button
            type="button"
            onClick={() => {
              if (mobileViewMode === "CARDS") {
                setMobileViewMode("MAP");
                setTimeout(() => {
                  reactFlowInstance.fitView({
                    padding: 0.08,
                    minZoom: 0.15,
                    maxZoom: 1.1,
                    duration: 400,
                  });
                }, 80);
              } else {
                setMobileViewMode("CARDS");
              }
            }}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all text-center ${
              mobileViewMode === "CARDS"
                ? "bg-[#ebf3fc] text-[#2f7de1]"
                : "text-[#1c2e48] active:bg-[#ebf3fc]"
            }`}
            title="ប្តូរទម្រង់មើល (Switch View Mode)"
          >
            {mobileViewMode === "CARDS" ? (
              <>
                <TreePine className="w-4.5 h-4.5 text-[#2f7de1]" />
                <span className="text-[10px] font-bold mt-0.5">
                  {language === "km" ? "ផែនទីដើមឈើ" : "Tree Map"}
                </span>
              </>
            ) : (
              <>
                <Sparkles className="w-4.5 h-4.5 text-[#2f7de1]" />
                <span className="text-[10px] font-bold mt-0.5">
                  {language === "km" ? "មើលខ្សែញាតិ" : "Relatives"}
                </span>
              </>
            )}
          </button>

          {/* Jump to Myself */}
          <button
            type="button"
            onClick={handleFindMyself}
            className="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-[#1c2e48] active:bg-[#ebf3fc] active:scale-95 transition-all text-center"
            title="ស្វែងរកខ្លួនខ្ញុំ (Find Me)"
          >
            <User className="w-4.5 h-4.5 text-[#2f7de1]" />
            <span className="text-[10px] font-semibold mt-0.5">{language === "km" ? "ខ្លួនខ្ញុំ" : "Me"}</span>
          </button>

          {/* Center Prominent Add Button */}
          {canAddRelative && (
            <button
              type="button"
              onClick={() => handleOpenAddModal()}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-gradient-to-r from-[#4a95ee] to-[#2467cc] text-white font-bold text-xs shadow-lg shadow-[#2f7de1]/30 active:scale-90 transition-all shrink-0"
              title="បន្ថែមសមាជិក (Add Member)"
            >
              <Plus className="w-4 h-4" />
              <span>{language === "km" ? "បន្ថែម" : "Add"}</span>
            </button>
          )}

          {/* Search focus */}
          <button
            type="button"
            onClick={() => searchInputRef.current?.focus()}
            className="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-[#1c2e48] active:bg-[#ebf3fc] active:scale-95 transition-all text-center"
            title="ស្វែងរក (Search)"
          >
            <Search className="w-4.5 h-4.5 text-[#2f7de1]" />
            <span className="text-[10px] font-semibold mt-0.5">{language === "km" ? "ស្វែងរក" : "Search"}</span>
          </button>

          {/* Kinship Calc */}
          <button
            type="button"
            onClick={() => {
              setShowKinshipModal(true);
              setKinshipResult(null);
            }}
            className="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-[#1c2e48] active:bg-[#ebf3fc] active:scale-95 transition-all text-center"
            title="គណនាទំនាក់ទំនង (Kinship)"
          >
            <GitCompare className="w-4.5 h-4.5 text-[#2f7de1]" />
            <span className="text-[10px] font-semibold mt-0.5">{language === "km" ? "ជាប់ញាតិ" : "Kinship"}</span>
          </button>
        </div>

        {/* Selected Person Profile Drawer (Mobile Bottom Sheet / Desktop Right Drawer) */}
        {(activeProfile || profileLoading) && (
          <div
            className={`fixed inset-x-0 bottom-0 max-h-[88vh] sm:max-h-none sm:top-4 sm:right-4 sm:bottom-4 sm:left-auto sm:w-96 p-5 sm:p-6 z-40 overflow-y-auto shadow-2xl flex flex-col justify-between animate-in slide-in-from-bottom sm:slide-in-from-right duration-200 rounded-t-3xl sm:rounded-2xl border-t sm:border ${
              treeTheme === "light"
                ? "bg-white border-slate-200 text-slate-900 shadow-2xl tree-drawer-light"
                : "heritage-card-elevated text-white"
            }`}
          >
            {/* Mobile Sheet Drag Handle Pill */}
            <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-3 sm:hidden shrink-0" />
            {profileLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                <div className="w-8 h-8 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-xs text-slate-400">Loading person details...</p>
              </div>
            ) : activeProfile ? (
              <>
                <div>
                  {/* Drawer Header */}
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
                        <h3 className="text-base font-bold font-khmer text-white">
                          {activeProfile.khmerName ||
                            `${activeProfile.lastName} ${activeProfile.firstName}`.trim()}
                        </h3>
                        {activeProfile.khmerName &&
                          `${activeProfile.lastName} ${activeProfile.firstName}`.trim() &&
                          `${activeProfile.lastName} ${activeProfile.firstName}`.trim() !==
                            activeProfile.khmerName && (
                            <p className="text-xs text-[#d4af37] font-heritage">
                              {`${activeProfile.lastName} ${activeProfile.firstName}`.trim()}
                            </p>
                          )}
                        {/* Automatic Kinship Relationship Badge to Current User */}
                        {activeProfileKinshipToMe && (
                          <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-300 text-amber-900 text-[10.5px] font-bold font-khmer">
                            <Sparkles className="w-3 h-3 text-amber-600 shrink-0" />
                            <span>
                              {language === "km"
                                ? `ត្រូវជា ${activeProfileKinshipToMe.relationshipNameKm} របស់អ្នក`
                                : `Your ${activeProfileKinshipToMe.relationshipNameEn}`}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveProfile(null);
                        setSelectedPersonId(null);
                        setIsBranchFocused(false);
                      }}
                      className="text-slate-400 hover:text-white p-1"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Branch Focus, Descendant Focus & Status Badges */}
                  <div className="flex flex-col gap-2 mb-4">
                    <div className="flex items-center gap-2">
                      <button
                        id="btn-drawer-focus-descendants"
                        type="button"
                        onClick={() => handleFocusDescendants(activeProfile.id)}
                        className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all border font-khmer cursor-pointer ${
                          focusedDescendantPersonId === activeProfile.id
                            ? "bg-amber-500 text-white border-amber-600 shadow-sm shadow-amber-500/30"
                            : treeTheme === "light"
                            ? "bg-amber-100 text-amber-900 border-amber-400 hover:bg-amber-200"
                            : "bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/30"
                        }`}
                        title={
                          focusedDescendantPersonId === activeProfile.id
                            ? "ចុចម្តងទៀតដើម្បីលុបចោលការផ្តោត (Click again to cancel)"
                            : "មែកធាងជាមេគ្រួសារ (ផ្តោតលើតំណពូជកូនចៅ)"
                        }
                      >
                        <FolderTree className={`w-3.5 h-3.5 ${focusedDescendantPersonId === activeProfile.id ? "text-white" : treeTheme === "light" ? "text-amber-700" : "text-amber-400"}`} />
                        <span>{t.tree.focusDescendants}</span>
                      </button>

                      <button
                        id="btn-drawer-focus-branch"
                        type="button"
                        onClick={handleToggleFocusBranch}
                        className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all border cursor-pointer ${
                          isBranchFocused
                            ? "bg-[#2f7de1] text-white border-[#2f7de1] shadow-sm shadow-[#2f7de1]/20"
                            : treeTheme === "light"
                            ? "bg-[#f0f6ff] text-[#1c2e48] border-[#2f7de1]/40 hover:bg-[#dcecff]"
                            : "bg-slate-900 text-slate-300 border-slate-700 hover:border-[#d4af37]"
                        }`}
                      >
                        <GitBranch className={`w-3.5 h-3.5 ${isBranchFocused ? "text-white" : "text-[#2f7de1]"}`} />
                        <span>{t.tree.focusBranch}</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      {activeProfile.isVerified ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px]">
                          <ShieldCheck className="w-3 h-3" />
                          <span>{t.tree.verifiedBadge}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px]">
                          <AlertCircle className="w-3 h-3" />
                          <span>{t.tree.pendingBadge}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {isEditing ? (
                    /* Edit Form with Auto-Save */
                    <form onSubmit={handleSaveProfile} className="space-y-3 text-xs">
                      {/* Auto-Save Status Banner */}
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-700/60">
                        <span className="text-[11px] font-semibold text-slate-300">
                          {language === "km" ? "កែប្រែព័ត៌មាន (រក្សាទុកស្វ័យប្រវត្តិ)" : "Edit Profile (Auto-Saving)"}
                        </span>
                        {autoSaveStatus === "saving" && (
                          <div className="flex items-center gap-1.5 text-[11px] text-amber-400 font-medium animate-pulse">
                            <div className="w-2.5 h-2.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                            <span>{autoSaveMessage}</span>
                          </div>
                        )}
                        {autoSaveStatus === "saved" && (
                          <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>{autoSaveMessage}</span>
                          </div>
                        )}
                        {autoSaveStatus === "error" && (
                          <div className="text-[11px] text-rose-400 font-medium">
                            {autoSaveMessage}
                          </div>
                        )}
                      </div>

                      {editError && (
                        <div className="p-2.5 rounded-lg bg-rose-950/50 border border-rose-800 text-rose-200 text-[11px]">
                          {editError}
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] text-slate-300 font-semibold mb-1">
                            នាមត្រកូល (Last Name) *
                          </label>
                          <input
                            type="text"
                            required
                            value={editLastName}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditLastName(val);
                              triggerAutoSave({ lastName: val });
                            }}
                            placeholder="ឧ. កុយ"
                            className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-[#d4af37]"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] text-slate-300 font-semibold mb-1">
                            នាមខ្លួន (First Name) *
                          </label>
                          <input
                            type="text"
                            required
                            value={editFirstName}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditFirstName(val);
                              triggerAutoSave({ firstName: val });
                            }}
                            placeholder="ឧ. វិរៈស័ក្ក"
                            className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-[#d4af37]"
                          />
                        </div>
                      </div>

                      {/* Life Status (នៅរស់ / ស្លាប់) */}
                      <div>
                        <label className="block text-[11px] text-slate-300 font-semibold mb-1.5">
                          ស្ថានភាពជីវិត *
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditIsLiving(true);
                              setEditDeathYear("");
                              triggerAutoSave({ isLiving: true, deathYear: "" });
                            }}
                            className={`flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                              editIsLiving
                                ? "bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-sm"
                                : "bg-slate-900 border-slate-700 text-slate-400 hover:text-white"
                            }`}
                          >
                            <span className="w-2 h-2 rounded-full bg-emerald-400" />
                            <span>នៅរស់</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditIsLiving(false);
                              triggerAutoSave({ isLiving: false });
                            }}
                            className={`flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                              !editIsLiving
                                ? "bg-slate-700/60 border-slate-400 text-slate-100 shadow-sm"
                                : "bg-slate-900 border-slate-700 text-slate-400 hover:text-white"
                            }`}
                          >
                            <span className="w-2 h-2 rounded-full bg-slate-400" />
                            <span>ស្លាប់ (ទទួលមរណភាព)</span>
                          </button>
                        </div>
                      </div>

                      <div className={`grid ${!editIsLiving ? "grid-cols-3" : "grid-cols-2"} gap-2`}>
                        <div>
                          <label className="block text-[11px] text-slate-300 font-semibold mb-1">
                            ភេទ
                          </label>
                          <select
                            value={editGender}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditGender(val);
                              triggerAutoSave({ gender: val });
                            }}
                            className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-[#d4af37]"
                          >
                            <option value="UNKNOWN">មិនបញ្ជាក់</option>
                            <option value="MALE">ប្រុស</option>
                            <option value="FEMALE">ស្រី</option>
                            <option value="OTHER">ផ្សេងទៀត</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] text-slate-300 font-semibold mb-1">
                            ឆ្នាំកំណើត
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={4}
                            value={editBirthYear}
                            onChange={(e) => {
                              const cleaned = cleanYearInput(e.target.value);
                              setEditBirthYear(cleaned);
                              triggerAutoSave({ birthYear: cleaned });
                            }}
                            placeholder="ឧ. 1970"
                            className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-[#d4af37]"
                          />
                        </div>

                        {!editIsLiving && (
                          <div>
                            <label className="block text-[11px] text-slate-300 font-semibold mb-1">
                              ឆ្នាំទទួលមរណភាព
                            </label>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength={4}
                              value={editDeathYear}
                              onChange={(e) => {
                                const cleaned = cleanYearInput(e.target.value);
                                setEditDeathYear(cleaned);
                                triggerAutoSave({ deathYear: cleaned });
                              }}
                              placeholder="ឧ. 2020"
                              className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-[#d4af37]"
                            />
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-300 font-semibold mb-1">
                          ប្រវត្តិសង្ខេប / កំណត់ចំណាំ
                        </label>
                        <textarea
                          rows={3}
                          value={editBio}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditBio(val);
                            triggerAutoSave({ bio: val });
                          }}
                          placeholder="កំណត់ត្រាជីវប្រវត្តិ ឬរឿងរ៉ាវចងចាំ..."
                          className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-[#d4af37]"
                        />
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
                        <span className="text-[10px] text-slate-400 italic">
                          រក្សាទុកស្វ័យប្រវត្តិតាមការបញ្ចូល
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setIsEditing(false)}
                            className="px-3 py-1.5 text-slate-400 hover:text-white cursor-pointer"
                          >
                            បិទ
                          </button>
                          <button
                            type="submit"
                            disabled={savingProfile}
                            className="px-4 py-1.5 rounded-lg bg-[#d4af37] text-slate-950 font-semibold disabled:opacity-50 hover:bg-[#e5c158] cursor-pointer"
                          >
                            {savingProfile
                              ? "កំពុងរក្សាទុក..."
                              : "រក្សាទុក"}
                          </button>
                        </div>
                      </div>
                    </form>
                  ) : (
                    /* Profile View */
                    <div className="space-y-4 text-xs">
                      <div
                        className={`grid grid-cols-2 gap-2 p-3 rounded-xl border ${
                          treeTheme === "light"
                            ? "bg-[#f0f6ff] border-[#dbe7f5] text-[#1c2e48]"
                            : "bg-slate-900/80 border-slate-800 text-slate-300"
                        }`}
                      >
                        <div>
                          <span
                            className={`text-[10px] block ${
                              treeTheme === "light" ? "text-[#6a7f99]" : "text-slate-500"
                            }`}
                          >
                            ស្ថានភាព
                          </span>
                          <span
                            className={`font-semibold ${
                              treeTheme === "light" ? "text-[#1c2e48]" : "text-slate-200"
                            }`}
                          >
                            {activeProfile.isLiving ? "នៅរស់" : "ស្លាប់ (ទទួលមរណភាព)"}
                          </span>
                        </div>
                        <div>
                          <span
                            className={`text-[10px] block ${
                              treeTheme === "light" ? "text-[#6a7f99]" : "text-slate-500"
                            }`}
                          >
                            ឆ្នាំកំណើត / មរណភាព
                          </span>
                          <span
                            className={`font-semibold ${
                              treeTheme === "light" ? "text-[#1c2e48]" : "text-slate-200"
                            }`}
                          >
                            {activeProfile.birthYear || "—"} -{" "}
                            {activeProfile.deathYear || (activeProfile.isLiving ? "បច្ចុប្បន្ន" : "—")}
                          </span>
                        </div>
                      </div>

                      {activeProfile.biography && (
                        <div
                          className={`p-3 rounded-xl border leading-relaxed text-[11px] ${
                            treeTheme === "light"
                              ? "bg-[#f8fbff] border-[#dbe7f5] text-[#1c2e48]"
                              : "bg-slate-900/60 border-slate-800 text-slate-300"
                          }`}
                        >
                          <span
                            className={`text-[10px] uppercase tracking-wider font-semibold block mb-1 ${
                              treeTheme === "light" ? "text-[#2f7de1]" : "text-[#d4af37]"
                            }`}
                          >
                            {language === "km" ? "ប្រវត្តិរូបសង្ខេប" : "Biography"}
                          </span>
                          {activeProfile.biography}
                        </div>
                      )}

                      {/* Verified Kinship Relationships */}
                      <div className="space-y-3">
                        {/* Parents */}
                        <div>
                          <span className={`text-[10px] uppercase tracking-wider font-bold block mb-1 ${treeTheme === "light" ? "text-slate-500" : "text-slate-400"}`}>
                            {language === "km" ? "ឪពុកម្តាយ" : "Parents"} ({activeProfile.parents.length})
                          </span>
                          {activeProfile.parents.length === 0 ? (
                            <p className="text-[11px] text-slate-400 italic">
                              {language === "km" ? "មិនទាន់មានទិន្នន័យឪពុកម្តាយ" : "No parents recorded"}
                            </p>
                          ) : (
                            <div className="space-y-1">
                              {activeProfile.parents.map((parent) => (
                                <button
                                  key={parent.id}
                                  type="button"
                                  onClick={() => handleSelectSearchResult(parent.id)}
                                  className={`w-full text-left p-2.5 rounded-xl border flex items-center justify-between text-xs font-khmer transition-all cursor-pointer ${
                                    treeTheme === "light"
                                      ? "bg-[#f8fbff] hover:bg-[#eef5fc] border-[#dbe7f5] text-[#1c2e48]"
                                      : "bg-slate-900 hover:bg-[#d4af37]/20 border-slate-800 text-slate-200"
                                  }`}
                                >
                                  <span className="font-semibold">
                                    {parent.khmerName ||
                                      `${parent.lastName} ${parent.firstName}`.trim()}
                                  </span>
                                  <ArrowRight className={`w-3.5 h-3.5 ${treeTheme === "light" ? "text-[#2f7de1]" : "text-[#d4af37]"}`} />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Siblings */}
                        <div>
                          <span className={`text-[10px] uppercase tracking-wider font-bold block mb-1 ${treeTheme === "light" ? "text-slate-500" : "text-slate-400"}`}>
                            {t.tree.siblings} ({activeProfileSiblings.length})
                          </span>
                          {activeProfileSiblings.length === 0 ? (
                            <p className="text-[11px] text-slate-400 italic">
                              {language === "km" ? "មិនមានបងប្អូនកត់ត្រាឡើយ" : "No siblings recorded"}
                            </p>
                          ) : (
                            <div className="space-y-1">
                              {activeProfileSiblings.map((sib) => (
                                <button
                                  key={sib.id}
                                  type="button"
                                  onClick={() => handleSelectSearchResult(sib.id)}
                                  className={`w-full text-left p-2.5 rounded-xl border flex items-center justify-between text-xs font-khmer transition-all cursor-pointer ${
                                    treeTheme === "light"
                                      ? "bg-[#f8fbff] hover:bg-[#eef5fc] border-[#dbe7f5] text-[#1c2e48]"
                                      : "bg-slate-900 hover:bg-[#d4af37]/20 border-slate-800 text-slate-200"
                                  }`}
                                >
                                  <span className="font-semibold">
                                    {sib.khmerName ||
                                      `${sib.lastName} ${sib.firstName}`.trim()}
                                  </span>
                                  <ArrowRight className={`w-3.5 h-3.5 ${treeTheme === "light" ? "text-[#2f7de1]" : "text-[#d4af37]"}`} />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Children */}
                        <div>
                          <span className={`text-[10px] uppercase tracking-wider font-bold block mb-1 ${treeTheme === "light" ? "text-slate-500" : "text-slate-400"}`}>
                            {language === "km" ? "កូនៗ" : "Children"} ({activeProfile.children.length})
                          </span>
                          {activeProfile.children.length === 0 ? (
                            <p className="text-[11px] text-slate-400 italic">
                              {language === "km" ? "មិនទាន់មានកូនកត់ត្រា" : "No children recorded"}
                            </p>
                          ) : (
                            <div className="space-y-1">
                              {activeProfile.children.map((child) => (
                                <button
                                  key={child.id}
                                  type="button"
                                  onClick={() => handleSelectSearchResult(child.id)}
                                  className={`w-full text-left p-2.5 rounded-xl border flex items-center justify-between text-xs font-khmer transition-all cursor-pointer ${
                                    treeTheme === "light"
                                      ? "bg-[#f8fbff] hover:bg-[#eef5fc] border-[#dbe7f5] text-[#1c2e48]"
                                      : "bg-slate-900 hover:bg-[#d4af37]/20 border-slate-800 text-slate-200"
                                  }`}
                                >
                                  <span className="font-semibold">
                                    {child.khmerName ||
                                      `${child.lastName} ${child.firstName}`.trim()}
                                  </span>
                                  <ArrowRight className={`w-3.5 h-3.5 ${treeTheme === "light" ? "text-[#2f7de1]" : "text-[#d4af37]"}`} />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Spouses */}
                        {activeProfile.spouses.length > 0 && (
                          <div>
                            <span className={`text-[10px] uppercase tracking-wider font-bold block mb-1 ${treeTheme === "light" ? "text-rose-600" : "text-rose-400"}`}>
                              {language === "km" ? "ស្វាមី/ភរិយា" : "Spouses / Partners"} ({activeProfile.spouses.length})
                            </span>
                            <div className="space-y-1">
                              {activeProfile.spouses.map((spouse) => (
                                <button
                                  key={spouse.id}
                                  type="button"
                                  onClick={() => handleSelectSearchResult(spouse.id)}
                                  className={`w-full text-left p-2.5 rounded-xl border flex items-center justify-between text-xs font-khmer transition-all cursor-pointer ${
                                    treeTheme === "light"
                                      ? "bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-950"
                                      : "bg-slate-900 hover:bg-rose-950/40 border-rose-900/40 text-slate-200"
                                  }`}
                                >
                                  <span className="font-semibold">
                                    {spouse.khmerName ||
                                      `${spouse.lastName} ${spouse.firstName}`.trim()}
                                  </span>
                                  <ArrowRight className={`w-3.5 h-3.5 ${treeTheme === "light" ? "text-rose-600" : "text-rose-400"}`} />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Memories & Archives Section */}
                        <div className="pt-2 border-t border-slate-800">
                          <span className="text-[10px] text-[#d4af37] uppercase tracking-wider font-semibold block mb-2 flex items-center gap-1.5">
                            <ImageIcon className="w-3 h-3" />
                            <span>{t.tree.memories}</span>
                          </span>

                          {activeProfile.memories && activeProfile.memories.length > 0 ? (
                            <div className="grid grid-cols-2 gap-2">
                              {activeProfile.memories.map((m) => (
                                <div
                                  key={m.id}
                                  className="group relative rounded-lg border border-slate-800 overflow-hidden bg-slate-950 hover:border-[#d4af37]/60 transition-all"
                                >
                                  <div className="aspect-video w-full overflow-hidden bg-slate-900">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={m.mediaUrl}
                                      alt={m.title}
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                    />
                                  </div>
                                  <div className="p-1.5">
                                    <p className="text-[10px] font-semibold text-slate-200 truncate">
                                      {m.title}
                                    </p>
                                    {m.year && (
                                      <p className="text-[9px] text-slate-500">{m.year}</p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[11px] text-slate-500 italic">
                              {t.tree.noMemories}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Profile Drawer Footer Actions */}
                <div className={`pt-4 border-t space-y-2 mt-4 ${treeTheme === "light" ? "border-slate-200" : "border-slate-800"}`}>
                  {/* Claim This Person As Yourself */}
                  {!isEditing && (
                    <button
                      type="button"
                      onClick={() => handleClaimIdentity(activeProfile.id)}
                      className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                        linkedPersonId === activeProfile.id
                          ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                          : treeTheme === "light"
                          ? "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200"
                          : "bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 border-blue-500/40"
                      }`}
                    >
                      <User className="w-3.5 h-3.5 text-blue-600" />
                      <span>
                        {linkedPersonId === activeProfile.id
                          ? (language === "km" ? "✓ នេះជាអត្តសញ្ញាណរបស់អ្នក" : "✓ This is your identity")
                          : (language === "km" ? "ជ្រើសរើសជាខ្លួនខ្ញុំ (This is Me)" : "This is Me (Claim Identity)")}
                      </span>
                    </button>
                  )}

                  {/* Connect New Relative To This Anchor */}
                  {canAddRelative && !isEditing && (
                    <button
                      type="button"
                      onClick={() => handleOpenAddModal(activeProfile.id)}
                      className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer ${
                        treeTheme === "light"
                          ? "bg-[#2f7de1] hover:bg-[#256ac2] text-white shadow-blue-500/20 active:scale-[0.99]"
                          : "text-slate-950 bg-[#d4af37] hover:bg-[#e5c158] shadow-[#d4af37]/20"
                      }`}
                    >
                      <Plus className="w-4 h-4" />
                      <span>
                        {language === "km"
                          ? `+ បន្ថែមសាច់ញាតិភ្ជាប់ជាមួយ ${activeProfile.khmerName || activeProfile.firstName}`
                          : `+ Add Relative Linked to ${activeProfile.firstName}`}
                      </span>
                    </button>
                  )}

                  {/* Kinship Calc */}
                  <button
                    type="button"
                    onClick={() => {
                      setKinshipP1(activeProfile.id);
                      setShowKinshipModal(true);
                      setKinshipResult(null);
                    }}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 border cursor-pointer ${
                      treeTheme === "light"
                        ? "bg-white hover:bg-slate-50 text-[#1c2e48] border-slate-200"
                        : "text-slate-200 bg-slate-900 hover:bg-[#d4af37] hover:text-slate-950 border-slate-700"
                    }`}
                  >
                    <GitCompare className="w-3.5 h-3.5 text-[#2f7de1]" />
                    <span>
                      {language === "km"
                        ? "គណនាទំនាក់ទំនងជាមួយ..."
                        : "Calculate Kinship With..."}
                    </span>
                  </button>

                  {/* Edit Record Button (Council or Self) */}
                  {canEditActive && !isEditing && (
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="w-full py-2 px-3 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-950 hover:bg-slate-900 transition-colors flex items-center justify-center gap-1.5 border border-slate-800"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-[#d4af37]" />
                      <span>{language === "km" ? "កែប្រែប្រវត្តិរូប" : "Edit Record"}</span>
                    </button>
                  )}

                  {/* Remove Person Button (Council Only) */}
                  {canDeleteActive && !isEditing && (
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null);
                        setShowDeleteModal(true);
                      }}
                      className="w-full py-2 px-3 rounded-lg text-xs font-medium text-rose-400 hover:text-rose-200 bg-rose-950/20 hover:bg-rose-950/40 transition-colors flex items-center justify-center gap-1.5 border border-rose-900/40"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{language === "km" ? "លុបសមាជិកចេញ" : "Remove Person"}</span>
                    </button>
                  )}
                </div>
              </>
            ) : null}
          </div>
        )}
      </div>

      {/* Add Family Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="tree-modal-light max-w-lg w-full p-5 sm:p-6 space-y-4 animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 max-h-[90vh] sm:max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl border-t sm:border border-slate-200 shadow-2xl">
            {/* Mobile Drag Handle */}
            <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-2 sm:hidden shrink-0" />
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-white">
                <div className="w-7 h-7 rounded-lg bg-[#d4af37]/20 border border-[#d4af37]/40 text-[#d4af37] flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold font-heritage">
                    បន្ថែមសមាជិកគ្រួសារ
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    {addStep === "FORM"
                      ? "បញ្ចូលព័ត៌មានលម្អិត និងជ្រើសរើសទំនាក់ទំនង"
                      : "ពិនិត្យឡើងវិញ និងបញ្ជាក់ការបង្កើត"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {addError && (
              <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-200 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{addError}</span>
              </div>
            )}

            {addStep === "FORM" ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!addFirstName.trim() || !addLastName.trim()) {
                    setAddError("សូមបញ្ចូលនាមត្រកូល និងនាមខ្លួន (Please provide both last and first name)");
                    return;
                  }
                  if (addRelType !== "NONE" && people.length > 0 && !addAnchorId) {
                    setAddError("សូមជ្រើសរើសសាច់ញាតិបង្គោល (Please select an anchor relative)");
                    return;
                  }
                  setAddError(null);
                  setAddStep("CONFIRM");
                }}
                className="space-y-3 text-xs"
              >
                {/* Draft Auto-Saved Indicator */}
                <div className="flex items-center justify-between pb-1 border-b border-slate-800/80">
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>ទម្រង់ត្រូវបានកត់ត្រាទុកស្វ័យប្រវត្តិ</span>
                  </div>
                  <span className="text-[10px] text-slate-500 italic">
                    មិនបាត់បង់ទិន្នន័យពេលបិទ
                  </span>
                </div>

                {/* Real Name Inputs: Last Name (កុយ) & First Name (វិរៈស័ក្ក) */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-300 font-semibold mb-1">
                      នាមត្រកូល (Last Name) *
                    </label>
                    <input
                      type="text"
                      required
                      value={addLastName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAddLastName(val);
                        updateAddRelativeDraft({ lastName: val });
                      }}
                      placeholder="ឧ. កុយ"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-[#d4af37]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-300 font-semibold mb-1">
                      នាមខ្លួន (First Name) *
                    </label>
                    <input
                      type="text"
                      required
                      value={addFirstName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAddFirstName(val);
                        updateAddRelativeDraft({ firstName: val });
                      }}
                      placeholder="ឧ. វិរៈស័ក្ក"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-[#d4af37]"
                    />
                  </div>
                </div>

                {/* Life Status (នៅរស់ / ស្លាប់) */}
                <div>
                  <label className="block text-[11px] text-slate-300 font-semibold mb-1.5">
                    ស្ថានភាពជីវិត *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAddIsLiving(true);
                        setAddDeathYear("");
                        updateAddRelativeDraft({ isLiving: true, deathYear: "" });
                      }}
                      className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                        addIsLiving
                          ? "bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-sm"
                          : "bg-slate-900 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600"
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                      <span>នៅរស់</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAddIsLiving(false);
                        updateAddRelativeDraft({ isLiving: false });
                      }}
                      className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                        !addIsLiving
                          ? "bg-slate-700/60 border-slate-400 text-slate-100 shadow-sm"
                          : "bg-slate-900 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600"
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                      <span>ស្លាប់ (ទទួលមរណភាព)</span>
                    </button>
                  </div>
                </div>

                {/* Gender & Years */}
                <div className={`grid ${!addIsLiving ? "grid-cols-3" : "grid-cols-2"} gap-3`}>
                  <div>
                    <label className="block text-[11px] text-slate-300 font-semibold mb-1">
                      ភេទ
                    </label>
                    <select
                      value={addGender}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAddGender(val);
                        updateAddRelativeDraft({ gender: val });
                      }}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-[#d4af37]"
                    >
                      <option value="UNKNOWN">មិនបញ្ជាក់</option>
                      <option value="MALE">ប្រុស</option>
                      <option value="FEMALE">ស្រី</option>
                      <option value="OTHER">ផ្សេងទៀត</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-300 font-semibold mb-1">
                      ឆ្នាំកំណើត
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={4}
                      value={addBirthYear}
                      onChange={(e) => {
                        const cleaned = cleanYearInput(e.target.value);
                        setAddBirthYear(cleaned);
                        updateAddRelativeDraft({ birthYear: cleaned });
                      }}
                      placeholder="ឧ. 1970"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-[#d4af37]"
                    />
                  </div>

                  {!addIsLiving && (
                    <div>
                      <label className="block text-[11px] text-slate-300 font-semibold mb-1">
                        ឆ្នាំទទួលមរណភាព
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={4}
                        value={addDeathYear}
                        onChange={(e) => {
                          const cleaned = cleanYearInput(e.target.value);
                          setAddDeathYear(cleaned);
                          updateAddRelativeDraft({ deathYear: cleaned });
                        }}
                        placeholder="ឧ. 2020"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-[#d4af37]"
                      />
                    </div>
                  )}
                </div>

                {/* Relationship section */}
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
                  <span className="text-[11px] font-bold text-[#d4af37] block uppercase tracking-wider">
                    ទំនាក់ទំនងសាច់ញាតិក្នុងដើមឈើ
                  </span>

                  {people.length === 0 ? (
                    <div className="text-[11px] text-slate-400">
                      ដើមឈើគ្រួសារបច្ចុប្បន្ននៅទទេរ។ បុគ្គលនេះនឹងក្លាយជាមេគ្រួសារ ឬបុព្វបុរសដំបូង។
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-[11px] text-slate-300 mb-1">
                          ប្រភេទទំនាក់ទំនង *
                        </label>
                        <select
                          value={addRelType}
                          onChange={(e) => setAddRelType(e.target.value as typeof addRelType)}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-[#d4af37]"
                        >
                          <option value="CHILD">
                            កូន របស់...
                          </option>
                          <option value="PARENT">
                            ឪពុក ឬ ម្តាយ របស់...
                          </option>
                          <option value="SPOUSE">
                            ស្វាមី ឬ ភរិយា របស់...
                          </option>
                          <option value="SIBLING">
                            បងប្អូនបង្កើត របស់...
                          </option>
                          {isCouncil && (
                            <option value="NONE">
                              បុព្វបុរសដំបូង / មែកធាងថ្មី
                            </option>
                          )}
                        </select>
                      </div>

                      {addRelType !== "NONE" && (
                        <div>
                          <label className="block text-[11px] text-slate-300 mb-1">
                            សាច់ញាតិបង្គោលក្នុងដើមឈើ *
                          </label>
                          <select
                            value={addAnchorId}
                            onChange={(e) => setAddAnchorId(e.target.value)}
                            disabled={!isCouncil && Boolean(linkedPersonId)}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-[#d4af37] disabled:opacity-60"
                          >
                            <option value="">
                              -- ជ្រើសរើសសាច់ញាតិ --
                            </option>
                            {people.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.khmerName || `${p.lastName} ${p.firstName}`.trim()}
                                {p.birthYear ? ` - b. ${p.birthYear}` : ""}
                              </option>
                            ))}
                          </select>
                          {!isCouncil && linkedPersonId && (
                            <p className="text-[10px] text-slate-400 mt-1 italic">
                              * សមាជិកទូទៅអាចបន្ថែមទំនាក់ទំនងភ្ជាប់ជាមួយប្រវត្តិរូបផ្ទាល់ខ្លួនប៉ុណ្ណោះ
                            </p>
                          )}
                        </div>
                      )}

                      {addRelType === "CHILD" && (
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="checkbox"
                            id="alsoLinkSpouseCheck"
                            checked={addAlsoLinkSpouse}
                            onChange={(e) => setAddAlsoLinkSpouse(e.target.checked)}
                            className="w-4 h-4 rounded text-[#d4af37] bg-slate-950 border-slate-700"
                          />
                          <label
                            htmlFor="alsoLinkSpouseCheck"
                            className="text-[11px] text-slate-300 cursor-pointer"
                          >
                            ភ្ជាប់ជាកូនរបស់ស្វាមី/ភរិយារបស់គាត់ផងដែរ (ប្រសិនបើមាន)
                          </label>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Notes & Bio */}
                <div>
                  <label className="block text-[11px] text-slate-300 font-semibold mb-1">
                    កំណត់ចំណាំ ឬរឿងរ៉ាវ (ស្រេចចិត្ត)
                  </label>
                  <textarea
                    rows={2}
                    value={addBio}
                    onChange={(e) => setAddBio(e.target.value)}
                    placeholder="កំណត់ចំណាំបន្ថែម..."
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-[#d4af37]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-lg text-slate-400 hover:text-white"
                  >
                    បោះបង់
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-lg bg-[#d4af37] text-slate-950 font-semibold hover:bg-[#e5c158] transition-all cursor-pointer"
                  >
                    ពិនិត្យ និងបញ្ជាក់
                  </button>
                </div>
              </form>
            ) : (
              /* Confirmation Screen before saving */
              <div className="space-y-4 text-xs">
                <div className="p-4 rounded-xl bg-slate-900 border border-[#d4af37]/40 space-y-3">
                  <div className="flex items-center gap-2 text-[#d4af37] font-semibold text-xs">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      សូមបញ្ជាក់ការបង្កើតសមាជិក និងខ្សែស្រឡាយ
                    </span>
                  </div>

                  <div className="space-y-2 text-slate-300 text-xs">
                    <div className="p-2.5 rounded-lg bg-slate-950 flex justify-between">
                      <span className="text-slate-400">ឈ្មោះសមាជិកថ្មី៖</span>
                      <span className="font-bold text-white">
                        {addLastName} {addFirstName} {addKhmerName ? `(${addKhmerName})` : ""}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-950 flex justify-between">
                      <span className="text-slate-400">ស្ថានភាពជីវិត៖</span>
                      <span className={`font-semibold ${addIsLiving ? "text-emerald-400" : "text-slate-400"}`}>
                        {addIsLiving ? "នៅរស់" : "ស្លាប់ (ទទួលមរណភាព)"}
                      </span>
                    </div>

                    {addBirthYear && (
                      <div className="p-2.5 rounded-lg bg-slate-950 flex justify-between">
                        <span className="text-slate-400">ឆ្នាំកំណើត៖</span>
                        <span className="font-semibold text-white">{addBirthYear}</span>
                      </div>
                    )}

                    {!addIsLiving && addDeathYear && (
                      <div className="p-2.5 rounded-lg bg-slate-950 flex justify-between">
                        <span className="text-slate-400">ឆ្នាំទទួលមរណភាព៖</span>
                        <span className="font-semibold text-white">{addDeathYear}</span>
                      </div>
                    )}

                    {addRelType !== "NONE" && selectedAnchorPerson && (
                      <div className="p-2.5 rounded-lg bg-slate-950 space-y-1">
                        <span className="text-slate-400 block">ទំនាក់ទំនងដែលនឹងបង្កើត៖</span>
                        <p className="font-semibold text-[#d4af37]">
                          {addRelType === "CHILD" && "👉 ជា កូន របស់"}
                          {addRelType === "PARENT" && "👉 ជា ឪពុក/ម្តាយ របស់"}
                          {addRelType === "SPOUSE" && "👉 ជា ស្វាមី/ភរិយា របស់"}
                          {addRelType === "SIBLING" && "👉 ជា បងប្អូនបង្កើត របស់"}{" "}
                          <span className="text-white underline">
                            {selectedAnchorPerson.khmerName ||
                              `${selectedAnchorPerson.lastName} ${selectedAnchorPerson.firstName}`.trim()}
                          </span>
                        </p>
                      </div>
                    )}

                    {addRelType === "NONE" && (
                      <div className="p-2.5 rounded-lg bg-slate-950">
                        <span className="text-slate-400 block">ទំនាក់ទំនង៖</span>
                        <span className="font-semibold text-amber-400">
                          មេគ្រួសារដំបូង / មែកធាងឯករាជ្យ
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    disabled={submittingAdd}
                    onClick={() => setAddStep("FORM")}
                    className="px-4 py-2 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                  >
                    ត្រឡប់ក្រោយ
                  </button>
                  <button
                    type="button"
                    disabled={submittingAdd}
                    onClick={handleConfirmAddMember}
                    className="px-5 py-2 rounded-lg bg-[#d4af37] text-slate-950 font-semibold hover:bg-[#e5c158] transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                  >
                    {submittingAdd ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                        <span>កំពុងបញ្ចូល...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>បញ្ជាក់ និងបង្កើតសមាជិក</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Relative Confirmation Modal */}
      {showDeleteModal && activeProfile && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="tree-modal-light max-w-md w-full p-5 sm:p-6 space-y-4 animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 rounded-t-3xl sm:rounded-2xl border-t sm:border border-rose-300">
            {/* Mobile Drag Handle */}
            <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-2 sm:hidden shrink-0" />
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-white font-heritage">
                  {language === "km"
                    ? "បញ្ជាក់ការលុបសមាជិកចេញពីពង្សាវតារ"
                    : "Remove Relative from Family Tree"}
                </h3>
                <p className="text-xs text-rose-300 mt-1">
                  {language === "km"
                    ? `តើអ្នកប្រាកដជាចង់លុប "${activeProfile.firstName} ${activeProfile.lastName}" មែនឬ?`
                    : `Are you sure you want to remove "${activeProfile.firstName} ${activeProfile.lastName}"?`}
                </p>
              </div>
            </div>

            {deleteError && (
              <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-200 text-xs">
                {deleteError}
              </div>
            )}

            {/* Impact explanation */}
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2 text-xs text-slate-300">
              <span className="text-[11px] font-semibold text-slate-200 block">
                {language === "km" ? "ព័ត៌មានដែលរងផលប៉ះពាល់៖" : "Impacted Connections:"}
              </span>
              <ul className="space-y-1 text-[11px] text-slate-400 list-disc list-inside">
                <li>
                  {language === "km"
                    ? `ខ្សែភ្ជាប់ទំនាក់ទំនងផ្ទាល់ចំនួន ${
                        activeProfile.parents.length +
                        activeProfile.children.length +
                        activeProfile.spouses.length
                      } នឹងត្រូវដកចេញ`
                    : `${
                        activeProfile.parents.length +
                        activeProfile.children.length +
                        activeProfile.spouses.length
                      } direct relationship connections will be removed`}
                </li>
                <li>
                  {language === "km"
                    ? `រូបថត/អនុស្សាវរីយ៍ចំនួន ${activeProfile.memories?.length || 0} នឹងត្រូវដកស្លាកឈ្មោះចេញ ប៉ុន្តែរូបភាពនៅតែរក្សាទុកដដែល`
                    : `${activeProfile.memories?.length || 0} memory tags will be unlinked (media remains safely preserved)`}
                </li>
              </ul>
              <div className="p-2 rounded-lg bg-emerald-950/30 border border-emerald-800/40 text-emerald-300 text-[10px] leading-relaxed mt-2">
                {language === "km"
                  ? "🛡️ ការពារសុវត្ថិភាព៖ ការលុបនេះនឹងមិនប៉ះពាល់ ឬលុបសមាជិកគ្រួសារដទៃឡើយ។ បណ្ណសារគ្រួសារទាំងអស់ត្រូវបានការពារដោយសុវត្ថិភាព។"
                  : "🛡️ Safe deletion: No other family members or archival memories will be deleted."}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={deletingPerson}
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2.5 rounded-lg text-slate-400 hover:text-white text-xs"
              >
                {language === "km" ? "បោះបង់" : "Cancel"}
              </button>
              <button
                type="button"
                disabled={deletingPerson}
                onClick={handleConfirmDeletePerson}
                className="px-5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                {deletingPerson ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{language === "km" ? "កំពុងលុប..." : "Removing..."}</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{language === "km" ? "បាទ/ចាស, លុបសមាជិកនេះ" : "Yes, Remove Person"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kinship Calculator Modal */}
      {showKinshipModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="tree-modal-light max-w-lg w-full p-5 sm:p-6 space-y-5 animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 rounded-t-3xl sm:rounded-2xl border-t sm:border border-slate-200">
            {/* Mobile Drag Handle */}
            <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-2 sm:hidden shrink-0" />
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-white">
                <GitCompare className="w-5 h-5 text-[#d4af37]" />
                <h3 className="text-base font-bold font-heritage">
                  {language === "km" ? "គណនាចំណងញាតិពង្សាវតារ" : "Ancestral Kinship Calculator"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowKinshipModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  {language === "km" ? "សាច់ញាតិទី ១" : "Person 1"}
                </label>
                <select
                  value={kinshipP1}
                  onChange={(e) => setKinshipP1(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                >
                  <option value="">
                    {language === "km" ? "-- ជ្រើសរើសមនុស្សទី ១ --" : "-- Select Person 1 --"}
                  </option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.khmerName || `${p.lastName} ${p.firstName}`.trim()}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  {language === "km" ? "សាច់ញាតិទី ២" : "Person 2"}
                </label>
                <select
                  value={kinshipP2}
                  onChange={(e) => setKinshipP2(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                >
                  <option value="">
                    {language === "km" ? "-- ជ្រើសរើសមនុស្សទី ២ --" : "-- Select Person 2 --"}
                  </option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.khmerName || `${p.lastName} ${p.firstName}`.trim()}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                disabled={!kinshipP1 || !kinshipP2 || calculatingKinship}
                onClick={handleCalculateKinship}
                className="px-5 py-2.5 rounded-xl font-semibold text-xs text-slate-950 bg-[#d4af37] hover:bg-[#e5c158] transition-all disabled:opacity-40"
              >
                {calculatingKinship
                  ? language === "km" ? "កំពុងគណនា..." : "Calculating..."
                  : language === "km" ? "គណនាទំនាក់ទំនង" : "Calculate Relationship"}
              </button>
            </div>

            {kinshipError && (
              <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 text-xs">
                {kinshipError}
              </div>
            )}

            {kinshipResult && (
              <div className="p-4 rounded-xl bg-slate-900/90 border border-[#d4af37]/30 space-y-3">
                <div className="flex items-center gap-2 text-[#d4af37]">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    {language === "km"
                      ? kinshipResult.relationshipNameKm
                      : kinshipResult.relationshipNameEn}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                  <div className="p-2.5 rounded-lg bg-slate-950">
                    <span className="text-[10px] text-slate-500 block">
                      {language === "km" ? "គម្លាតជំហាន" : "Degrees of Separation"}
                    </span>
                    <span className="font-semibold text-white">
                      {kinshipResult.degreeOfSeparation >= 0
                        ? `${kinshipResult.degreeOfSeparation} step(s)`
                        : "Disconnected"}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950">
                    <span className="text-[10px] text-slate-500 block">
                      {language === "km" ? "គម្លាតជំនាន់" : "Generational Shift"}
                    </span>
                    <span className="font-semibold text-white">
                      {kinshipResult.generationDifference === 0
                        ? "Same Generation"
                        : `${Math.abs(kinshipResult.generationDifference)} generation(s)`}
                    </span>
                  </div>
                </div>

                {kinshipResult.path.length > 0 && (
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-2 font-semibold">
                      {language === "km" ? "ផ្លូវទំនាក់ទំនងផ្ទៀងផ្ទាត់រួច៖" : "Verified Relationship Path:"}
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {kinshipResult.path.map((step, idx) => (
                        <React.Fragment key={step.personId}>
                          <span className="px-2 py-1 rounded-md bg-slate-950 border border-slate-800 text-[11px] text-slate-200">
                            {step.personName}
                          </span>
                          {idx < kinshipResult.path.length - 1 && (
                            <ArrowRight className="w-3 h-3 text-[#d4af37]" />
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TreeParamResolver({ params }: { params?: Promise<{ spaceId: string }> }) {
  const resolved = params ? use(params) : undefined;
  return (
    <ReactFlowProvider>
      <FamilyTreeCanvas spaceId={resolved?.spaceId} />
    </ReactFlowProvider>
  );
}

export default function FamilyTreePage({
  params,
}: {
  params?: Promise<{ spaceId: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="h-screen w-screen bg-[#f2f8ff] flex items-center justify-center font-khmer">
          <div className="w-10 h-10 border-2 border-[#2f7de1] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <TreeParamResolver params={params} />
    </Suspense>
  );
}
