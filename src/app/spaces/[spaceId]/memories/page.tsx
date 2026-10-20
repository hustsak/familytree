"use client";

import React, { useState, useEffect, use, useMemo, Suspense } from "react";
import Link from "next/link";
import { Navigation } from "@/components/Navigation";
import { useLanguage } from "@/lib/i18n/context";
import {
  BookOpen,
  Image as ImageIcon,
  FileText,
  Bookmark,
  Calendar,
  Music,
  Plus,
  Search,
  MapPin,
  Clock,
  Tag,
  X,
  Upload,
  Trash2,
  User,
  Eye,
  AlertCircle,
  Sparkles,
} from "lucide-react";

interface TaggedPerson {
  id: string;
  firstName: string;
  lastName: string;
  khmerName?: string | null;
  photoUrl?: string | null;
  birthYear?: number | null;
}

interface MemoryItem {
  id: string;
  spaceId: string;
  title: string;
  titleKm?: string | null;
  description?: string | null;
  descriptionKm?: string | null;
  type: "PHOTO" | "DOCUMENT" | "STORY" | "EVENT" | "AUDIO";
  status: "PUBLISHED" | "PENDING_REVIEW" | "ARCHIVED";
  storagePath?: string | null;
  mediaUrl?: string | null;
  signedMediaUrl?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  originalFileName?: string | null;
  eventDate?: string | null;
  eventYear?: number | null;
  location?: string | null;
  branchTag?: string | null;
  createdById: string;
  createdAt: string;
  createdBy: {
    id: string;
    fullName: string;
    avatarUrl?: string | null;
  };
  taggedPeople: {
    person: TaggedPerson;
  }[];
}

interface SimplePerson {
  id: string;
  firstName: string;
  lastName: string;
  khmerName?: string | null;
}

function MemoriesContent({ spaceId }: { spaceId: string }) {
  const { language } = useLanguage();

  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // View state
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"grid" | "timeline">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBranch, setSelectedBranch] = useState<string>("ALL");

  // Relatives list for tagging
  const [relatives, setRelatives] = useState<SimplePerson[]>([]);

  // Contribute Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Form Fields
  const [newTitle, setNewTitle] = useState("");
  const [newTitleKm, setNewTitleKm] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDescriptionKm, setNewDescriptionKm] = useState("");
  const [newType, setNewType] = useState<"PHOTO" | "DOCUMENT" | "STORY" | "EVENT" | "AUDIO">("PHOTO");
  const [newEventYear, setNewEventYear] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newBranchTag, setNewBranchTag] = useState("");
  const [selectedRelativeIds, setSelectedRelativeIds] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);

  // Detail Modal State
  const [activeMemory, setActiveMemory] = useState<MemoryItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch Memories
  const fetchMemories = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await fetch(`/api/spaces/${spaceId}/memories`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to load archive");
      }
      const data = await res.json();
      setMemories(data.memories || []);
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Fetch Relatives for tagging and Memories on space change
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        setLoading(true);
        setErrorMsg(null);
        const [memRes, treeRes] = await Promise.all([
          fetch(`/api/spaces/${spaceId}/memories`),
          fetch(`/api/spaces/${spaceId}/tree`),
        ]);

        if (isMounted && memRes.ok) {
          const mData = await memRes.json();
          setMemories(mData.memories || []);
        }
        if (isMounted && treeRes.ok) {
          const tData = await treeRes.json();
          setRelatives(tData.people || []);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const e = err as Error;
          setErrorMsg(e.message || "An error occurred");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [spaceId]);

  // Handle File selection & preview
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setUploadError("File size exceeds 15MB limit.");
      return;
    }

    setUploadError(null);
    setSelectedFile(file);

    if (file.type.startsWith("image/")) {
      const previewUrl = URL.createObjectURL(file);
      setFilePreview(previewUrl);
    } else {
      setFilePreview(null);
    }
  };

  // Submit Memory
  const handleCreateMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setIsSubmitting(true);
    setUploadError(null);

    try {
      let storagePath: string | null = null;
      let originalFileName: string | null = null;
      let fileSize: number | null = null;
      let mimeType: string | null = null;

      // 1. Upload file if attached
      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);

        const uploadRes = await fetch(`/api/spaces/${spaceId}/media/upload`, {
          method: "POST",
          body: formData,
        });

        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) {
          throw new Error(uploadData.error || "File upload failed");
        }

        storagePath = uploadData.storagePath;
        originalFileName = uploadData.originalFileName;
        fileSize = uploadData.fileSize;
        mimeType = uploadData.mimeType;
      }

      // 2. Save Memory Record
      const res = await fetch(`/api/spaces/${spaceId}/memories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          titleKm: newTitleKm.trim() || null,
          description: newDescription.trim() || null,
          descriptionKm: newDescriptionKm.trim() || null,
          type: newType,
          storagePath,
          fileSize,
          mimeType,
          originalFileName,
          eventYear: newEventYear ? parseInt(newEventYear, 10) : null,
          location: newLocation.trim() || null,
          branchTag: newBranchTag.trim() || null,
          taggedPersonIds: selectedRelativeIds,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Failed to save memory");
      }

      // Reset form
      setNewTitle("");
      setNewTitleKm("");
      setNewDescription("");
      setNewDescriptionKm("");
      setNewEventYear("");
      setNewLocation("");
      setNewBranchTag("");
      setSelectedRelativeIds([]);
      setSelectedFile(null);
      setFilePreview(null);
      setShowAddModal(false);

      // Refresh memories
      await fetchMemories();
    } catch (err: unknown) {
      const e = err as Error;
      setUploadError(e.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Memory
  const handleDeleteMemory = async (memoryId: string) => {
    if (!confirm("Are you sure you wish to delete this memory? This cannot be undone.")) return;
    setDeletingId(memoryId);
    try {
      const res = await fetch(`/api/spaces/${spaceId}/memories/${memoryId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete memory");
      }
      setActiveMemory(null);
      await fetchMemories();
    } catch (err: unknown) {
      const e = err as Error;
      alert(e.message);
    } finally {
      setDeletingId(null);
    }
  };

  // Distinct branch tags
  const branchTags = useMemo(() => {
    const tags = new Set<string>();
    memories.forEach((m) => {
      if (m.branchTag) tags.add(m.branchTag);
    });
    return Array.from(tags);
  }, [memories]);

  // Filtered Memories
  const filteredMemories = useMemo(() => {
    return memories.filter((m) => {
      if (activeTab !== "ALL" && m.type !== activeTab) return false;
      if (selectedBranch !== "ALL" && m.branchTag !== selectedBranch) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = m.title.toLowerCase().includes(q);
        const matchesTitleKm = m.titleKm ? m.titleKm.includes(q) : false;
        const matchesDesc = m.description ? m.description.toLowerCase().includes(q) : false;
        const matchesLoc = m.location ? m.location.toLowerCase().includes(q) : false;
        const matchesTag = m.taggedPeople.some(
          (tp) =>
            tp.person.firstName.toLowerCase().includes(q) ||
            tp.person.lastName.toLowerCase().includes(q) ||
            (tp.person.khmerName && tp.person.khmerName.includes(q))
        );
        if (!matchesTitle && !matchesTitleKm && !matchesDesc && !matchesLoc && !matchesTag) {
          return false;
        }
      }
      return true;
    });
  }, [memories, activeTab, selectedBranch, searchQuery]);

  // Chronological timeline
  const timelineMemories = useMemo(() => {
    return [...filteredMemories].sort((a, b) => {
      const yA = a.eventYear ?? (a.eventDate ? new Date(a.eventDate).getFullYear() : 9999);
      const yB = b.eventYear ?? (b.eventDate ? new Date(b.eventDate).getFullYear() : 9999);
      return yA - yB;
    });
  }, [filteredMemories]);

  return (
    <div className="min-h-screen bg-[#0c0f14] flex flex-col">
      <Navigation activeSpaceId={spaceId} />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-widest text-[#d4af37] font-semibold flex items-center gap-1.5">
                <BookOpen className="w-4 h-4" />
                {language === "km" ? "ប័ណ្ណសារគ្រួសារ & ការចងចាំ" : "Family Heritage Vault"}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-heritage gold-gradient-text mt-1">
              {language === "km" ? "ការចងចាំ & ឯកសារប្រវត្តិសាស្ត្រ" : "Memories & Historical Archive"}
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              {language === "km"
                ? "រក្សាទុកនូវរូបថតឯកជន ឯកសារប្រវត្តិសាស្ត្រ រឿងរ៉ាវ និងព្រឹត្តិការណ៍សំខាន់ៗដែលភ្ជាប់ជាមួយសាច់ញាតិពិតប្រាកដ។"
                : "A private digital archive preserving verified photos, historical documents, oral lore, and milestones linked to relatives across generations."}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-950 bg-gradient-to-r from-[#fef08a] via-[#d4af37] to-[#b45309] hover:opacity-95 transition-all flex items-center gap-2 shadow-md shadow-[#d4af37]/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{language === "km" ? "បន្ថែមការចងចាំ" : "Contribute Memory"}</span>
            </button>
          </div>
        </div>

        {/* Toolbar & Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 my-6">
          {/* Type Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            {[
              { id: "ALL", label: language === "km" ? "ទាំងអស់" : "All Archives", icon: Bookmark },
              { id: "PHOTO", label: language === "km" ? "រូបថត" : "Photos", icon: ImageIcon },
              { id: "DOCUMENT", label: language === "km" ? "ឯកសារ" : "Documents", icon: FileText },
              { id: "STORY", label: language === "km" ? "រឿងរ៉ាវ" : "Stories", icon: Sparkles },
              { id: "EVENT", label: language === "km" ? "ព្រឹត្តិការណ៍" : "Events", icon: Calendar },
              { id: "AUDIO", label: language === "km" ? "សំឡេង" : "Audio", icon: Music },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
                    activeTab === tab.id
                      ? "bg-[#d4af37] text-slate-950 shadow-sm"
                      : "bg-slate-900/90 text-slate-400 hover:text-slate-200 border border-slate-800"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Controls: Search, Branch, View toggle */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 md:w-56">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={language === "km" ? "ស្វែងរកការចងចាំ..." : "Search memories..."}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#d4af37]"
              />
            </div>

            {/* Branch Filter */}
            {branchTags.length > 0 && (
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-[#d4af37]"
              >
                <option value="ALL">{language === "km" ? "គ្រប់សាខា" : "All Branches"}</option>
                {branchTags.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            )}

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-900 p-0.5 rounded-xl border border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                  viewMode === "grid" ? "bg-[#d4af37] text-slate-950 font-semibold" : "text-slate-400 hover:text-white"
                }`}
              >
                {language === "km" ? "ក្រឡាចត្រង្គ" : "Vault"}
              </button>
              <button
                type="button"
                onClick={() => setViewMode("timeline")}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                  viewMode === "timeline" ? "bg-[#d4af37] text-slate-950 font-semibold" : "text-slate-400 hover:text-white"
                }`}
              >
                {language === "km" ? "បន្ទាត់ពេលវេលា" : "Timeline"}
              </button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        {loading ? (
          <div className="py-24 text-center">
            <div className="w-10 h-10 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-400">{language === "km" ? "កំពុងផ្ទុកប័ណ្ណសារ..." : "Loading family memories..."}</p>
          </div>
        ) : errorMsg ? (
          <div className="heritage-card p-6 max-w-md mx-auto text-center my-12">
            <AlertCircle className="w-8 h-8 text-rose-400 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-white mb-1">Error Loading Memories</h3>
            <p className="text-xs text-slate-400 mb-4">{errorMsg}</p>
            <button
              type="button"
              onClick={fetchMemories}
              className="px-4 py-2 rounded-lg bg-[#d4af37] text-slate-950 text-xs font-semibold"
            >
              Retry
            </button>
          </div>
        ) : filteredMemories.length === 0 ? (
          <div className="heritage-card p-12 text-center max-w-lg mx-auto my-12">
            <BookOpen className="w-12 h-12 text-[#d4af37]/60 mx-auto mb-3" />
            <h3 className="text-base font-bold font-heritage text-white mb-2">
              {language === "km" ? "មិនទាន់មានការចងចាំនៅឡើយទេ" : "No Memories Recorded Yet"}
            </h3>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              {language === "km"
                ? "ចាប់ផ្តើមរក្សាទុកនូវអនុស្សាវរីយ៍ រូបថតចាស់ៗ ឯកសារ និងព្រឹត្តិការណ៍សំខាន់ៗនៃគ្រួសាររបស់អ្នក។"
                : "Be the first relative to preserve a precious family photograph, historical certificate, ancestral story, or milestone."}
            </p>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#d4af37] text-slate-950 hover:bg-[#e5c158] transition-all shadow-md shadow-[#d4af37]/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{language === "km" ? "បន្ថែមការចងចាំដំបូង" : "Contribute First Memory"}</span>
            </button>
          </div>
        ) : viewMode === "grid" ? (
          /* Grid Vault View */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredMemories.map((mem) => (
              <div
                key={mem.id}
                onClick={() => setActiveMemory(mem)}
                className="heritage-card overflow-hidden group cursor-pointer hover:border-[#d4af37]/60 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Media Preview or Banner */}
                  <div className="h-48 w-full bg-slate-950/80 relative overflow-hidden flex items-center justify-center border-b border-slate-800">
                    {mem.signedMediaUrl && (mem.type === "PHOTO" || (mem.mimeType && mem.mimeType.startsWith("image/"))) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={mem.signedMediaUrl}
                        alt={mem.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-slate-500">
                        {mem.type === "DOCUMENT" && <FileText className="w-10 h-10 text-[#d4af37]" />}
                        {mem.type === "STORY" && <Sparkles className="w-10 h-10 text-[#d4af37]" />}
                        {mem.type === "EVENT" && <Calendar className="w-10 h-10 text-[#d4af37]" />}
                        {mem.type === "AUDIO" && <Music className="w-10 h-10 text-[#d4af37]" />}
                        {mem.type === "PHOTO" && <ImageIcon className="w-10 h-10 text-[#d4af37]" />}
                        <span className="text-[11px] font-mono uppercase tracking-wider">{mem.type}</span>
                      </div>
                    )}

                    {/* Type Badge */}
                    <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-950/80 backdrop-blur-md text-[#d4af37] border border-[#d4af37]/30">
                      {mem.type}
                    </span>

                    {/* Year Tag if available */}
                    {mem.eventYear && (
                      <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-950/80 backdrop-blur-md text-white border border-slate-700">
                        {mem.eventYear}
                      </span>
                    )}
                  </div>

                  {/* Body Info */}
                  <div className="p-4">
                    <h3 className="text-sm font-bold font-heritage text-white group-hover:text-[#d4af37] transition-colors line-clamp-1">
                      {mem.title}
                    </h3>
                    {mem.titleKm && (
                      <p className="text-xs font-khmer text-slate-400 mt-0.5 line-clamp-1">
                        {mem.titleKm}
                      </p>
                    )}

                    {(mem.description || mem.descriptionKm) && (
                      <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                        {mem.description || mem.descriptionKm}
                      </p>
                    )}

                    {/* Metadata tags: Location & Branch */}
                    <div className="flex flex-wrap items-center gap-2 mt-3 text-[11px] text-slate-500">
                      {mem.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-[#d4af37]" />
                          <span>{mem.location}</span>
                        </span>
                      )}
                      {mem.branchTag && (
                        <span className="flex items-center gap-1">
                          <Tag className="w-3 h-3 text-emerald-400" />
                          <span>{mem.branchTag}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tagged Relatives Footer */}
                <div className="px-4 py-3 border-t border-slate-800/80 bg-slate-950/40 flex items-center justify-between text-xs">
                  <div className="flex items-center -space-x-1.5 overflow-hidden">
                    {mem.taggedPeople.length === 0 ? (
                      <span className="text-[10px] text-slate-500 italic">No relatives tagged</span>
                    ) : (
                      mem.taggedPeople.slice(0, 4).map((tp) => (
                        <div
                          key={tp.person.id}
                          title={`${tp.person.firstName} ${tp.person.lastName}`}
                          className="w-6 h-6 rounded-full border border-slate-800 bg-slate-900 flex items-center justify-center text-[10px] text-[#d4af37] overflow-hidden"
                        >
                          {tp.person.photoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={tp.person.photoUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span>{tp.person.firstName[0]}</span>
                          )}
                        </div>
                      ))
                    )}
                    {mem.taggedPeople.length > 4 && (
                      <span className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 text-[10px] text-slate-300 flex items-center justify-center">
                        +{mem.taggedPeople.length - 4}
                      </span>
                    )}
                  </div>

                  <span className="text-[10px] text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(mem.createdAt).toLocaleDateString()}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Timeline Chronological View */
          <div className="max-w-3xl mx-auto py-6 relative">
            {/* Center line */}
            <div className="absolute top-0 bottom-0 left-6 sm:left-1/2 -translate-x-1/2 w-0.5 bg-gradient-to-b from-[#d4af37] via-slate-700 to-slate-900" />

            <div className="space-y-8 relative">
              {timelineMemories.map((mem, idx) => {
                const isEven = idx % 2 === 0;
                return (
                  <div
                    key={mem.id}
                    className={`flex flex-col sm:flex-row items-start ${
                      isEven ? "sm:flex-row-reverse" : ""
                    } gap-6 group`}
                  >
                    {/* Event Year Node Indicator */}
                    <div className="absolute left-6 sm:left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-[#0c0f14] border-2 border-[#d4af37] flex items-center justify-center text-[10px] font-bold text-[#d4af37] z-10 shadow-lg shadow-[#d4af37]/20 group-hover:scale-110 transition-transform">
                      {mem.eventYear ? String(mem.eventYear).slice(-2) : "•"}
                    </div>

                    {/* Event Card Content */}
                    <div
                      onClick={() => setActiveMemory(mem)}
                      className={`ml-12 sm:ml-0 sm:w-1/2 ${
                        isEven ? "sm:pl-8 text-left" : "sm:pr-8 text-left"
                      } cursor-pointer`}
                    >
                      <div className="heritage-card p-4 hover:border-[#d4af37]/60 transition-all">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="text-[10px] font-mono font-bold text-[#d4af37] uppercase tracking-wider">
                            {mem.eventYear ? `Year ${mem.eventYear}` : mem.type}
                          </span>
                          {mem.location && (
                            <span className="text-[10px] text-slate-400 flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-[#d4af37]" />
                              <span>{mem.location}</span>
                            </span>
                          )}
                        </div>

                        <h3 className="text-sm font-bold text-white group-hover:text-[#d4af37] transition-colors">
                          {mem.title}
                        </h3>
                        {mem.titleKm && (
                          <p className="text-xs font-khmer text-slate-400 mt-0.5">
                            {mem.titleKm}
                          </p>
                        )}

                        {(mem.description || mem.descriptionKm) && (
                          <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                            {mem.description || mem.descriptionKm}
                          </p>
                        )}

                        {/* Tagged Relatives in this event */}
                        {mem.taggedPeople.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-2.5 border-t border-slate-800">
                            {mem.taggedPeople.map((tp) => (
                              <span
                                key={tp.person.id}
                                className="px-2 py-0.5 rounded-full text-[10px] bg-slate-900 border border-slate-800 text-slate-300"
                              >
                                {tp.person.firstName} {tp.person.lastName}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Contribute Memory Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="heritage-card-elevated max-w-xl w-full p-6 sm:p-8 relative max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => {
                setShowAddModal(false);
                setFilePreview(null);
                setSelectedFile(null);
              }}
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#d4af37]/10 border border-[#d4af37]/30 text-[#d4af37] flex items-center justify-center">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold font-heritage text-white">
                  {language === "km" ? "បន្ថែមការចងចាំ ឬឯកសារប្រវត្តិសាស្ត្រ" : "Contribute Family Memory"}
                </h3>
                <p className="text-xs text-slate-400">
                  {language === "km"
                    ? "ផ្ទុកឡើងរូបថត ឯកសារ ឬរឿងរ៉ាវប្រវត្តិសាស្ត្រពិតប្រាកដ"
                    : "Preserve genuine archival photos, certificates, stories, or milestone recordings."}
                </p>
              </div>
            </div>

            {uploadError && (
              <div className="p-3 mb-4 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{uploadError}</span>
              </div>
            )}

            <form onSubmit={handleCreateMemory} className="space-y-4 text-xs">
              {/* File Attachment / Drag Drop */}
              <div>
                <label className="block text-slate-300 font-medium mb-1.5">
                  {language === "km" ? "ឯកសារភ្ជាប់ (រូបភាព, PDF, ឬ សំឡេង)" : "Attach Media File (Photo, PDF document, or Audio)"}
                </label>
                <div className="border-2 border-dashed border-slate-700 hover:border-[#d4af37] rounded-xl p-4 text-center cursor-pointer transition-colors relative bg-slate-900/50">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf,audio/mpeg"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  {filePreview ? (
                    <div className="space-y-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={filePreview} alt="Preview" className="max-h-36 mx-auto rounded-lg object-contain" />
                      <p className="text-[11px] text-slate-400">{selectedFile?.name}</p>
                    </div>
                  ) : selectedFile ? (
                    <div className="text-slate-300">
                      <FileText className="w-8 h-8 text-[#d4af37] mx-auto mb-1" />
                      <p className="font-semibold">{selectedFile.name}</p>
                      <p className="text-[10px] text-slate-500">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  ) : (
                    <div className="text-slate-400">
                      <Upload className="w-8 h-8 text-[#d4af37] mx-auto mb-1.5" />
                      <p className="font-medium text-slate-200">
                        {language === "km" ? "ចុចដើម្បីជ្រើសរើសឯកសារ" : "Click or drop file to upload"}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-1">Supports JPG, PNG, WEBP, PDF, MP3 (Max 15MB)</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Title & Type */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-slate-300 font-medium mb-1">
                    {language === "km" ? "ចំណងជើង (អង់គ្លេស/ទូទៅ)" : "Title (English)"} *
                  </label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Grandfather wedding ceremony in Battambang"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-[#d4af37]"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    {language === "km" ? "ប្រភេទ" : "Category"}
                  </label>
                  <select
                    value={newType}
                    onChange={(e) =>
                      setNewType(
                        e.target.value as "PHOTO" | "DOCUMENT" | "STORY" | "EVENT" | "AUDIO"
                      )
                    }
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-[#d4af37]"
                  >
                    <option value="PHOTO">Photo</option>
                    <option value="DOCUMENT">Document</option>
                    <option value="STORY">Story</option>
                    <option value="EVENT">Event</option>
                    <option value="AUDIO">Audio</option>
                  </select>
                </div>
              </div>

              {/* Khmer Title */}
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  {language === "km" ? "ចំណងជើងជាភាសាខ្មែរ" : "Title (Khmer, Optional)"}
                </label>
                <input
                  type="text"
                  value={newTitleKm}
                  onChange={(e) => setNewTitleKm(e.target.value)}
                  placeholder="ឧ. ពិធីមង្គលការលោកតា នៅខេត្តបាត់ដំបង"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-khmer focus:outline-none focus:border-[#d4af37]"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  {language === "km" ? "ការពណ៌នា ឬសាច់រឿង" : "Story / Description"}
                </label>
                <textarea
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Write historical background, context, or recollections..."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-[#d4af37]"
                />
              </div>

              {/* Year, Location, Branch */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    {language === "km" ? "ឆ្នាំនៃព្រឹត្តិការណ៍" : "Event Year (Known)"}
                  </label>
                  <input
                    type="number"
                    min="1800"
                    max="2030"
                    value={newEventYear}
                    onChange={(e) => setNewEventYear(e.target.value)}
                    placeholder="e.g. 1972"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-[#d4af37]"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    {language === "km" ? "ទីតាំង" : "Location"}
                  </label>
                  <input
                    type="text"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    placeholder="e.g. Phnom Penh, Cambodia"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-[#d4af37]"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    {language === "km" ? "ស្លាកសាខា" : "Branch Tag"}
                  </label>
                  <input
                    type="text"
                    value={newBranchTag}
                    onChange={(e) => setNewBranchTag(e.target.value)}
                    placeholder="e.g. Paternal"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-[#d4af37]"
                  />
                </div>
              </div>

              {/* Tag Verified Relatives */}
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  {language === "km" ? "ភ្ជាប់សាច់ញាតិដែលទាក់ទង" : "Tag Verified Relatives in this Memory"}
                </label>
                <div className="max-h-36 overflow-y-auto bg-slate-900 border border-slate-700 rounded-xl p-2.5 space-y-1.5 divide-y divide-slate-800">
                  {relatives.length === 0 ? (
                    <p className="text-slate-500 italic p-1">No verified relatives available in tree</p>
                  ) : (
                    relatives.map((person) => {
                      const isSelected = selectedRelativeIds.includes(person.id);
                      return (
                        <label
                          key={person.id}
                          className="flex items-center gap-2.5 p-1.5 hover:bg-slate-800/60 rounded-lg cursor-pointer text-slate-300"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              setSelectedRelativeIds((prev) =>
                                isSelected ? prev.filter((id) => id !== person.id) : [...prev, person.id]
                              );
                            }}
                            className="rounded border-slate-700 text-[#d4af37] focus:ring-[#d4af37]"
                          />
                          <span className="font-medium text-white">
                            {person.firstName} {person.lastName}
                          </span>
                          {person.khmerName && (
                            <span className="text-[11px] text-slate-400 font-khmer">({person.khmerName})</span>
                          )}
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-[#d4af37] text-slate-950 font-semibold hover:bg-[#e5c158] transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-[#d4af37]/20"
                >
                  {isSubmitting ? "Preserving..." : "Save Memory"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Memory Detail Modal */}
      {activeMemory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="heritage-card-elevated max-w-2xl w-full p-6 sm:p-8 relative max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setActiveMemory(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Media Presentation */}
            {activeMemory.signedMediaUrl && (
              <div className="mb-6 rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center max-h-96">
                {activeMemory.type === "PHOTO" || (activeMemory.mimeType && activeMemory.mimeType.startsWith("image/")) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={activeMemory.signedMediaUrl}
                    alt={activeMemory.title}
                    className="max-h-96 w-auto object-contain mx-auto"
                  />
                ) : activeMemory.type === "AUDIO" || (activeMemory.mimeType && activeMemory.mimeType.startsWith("audio/")) ? (
                  <div className="p-6 w-full text-center">
                    <Music className="w-12 h-12 text-[#d4af37] mx-auto mb-3" />
                    <audio controls className="w-full mt-2">
                      <source src={activeMemory.signedMediaUrl} type={activeMemory.mimeType || "audio/mpeg"} />
                      Your browser does not support audio playback.
                    </audio>
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <FileText className="w-12 h-12 text-[#d4af37] mx-auto mb-3" />
                    <p className="text-xs text-slate-300 font-medium mb-3">{activeMemory.originalFileName || "Document"}</p>
                    <a
                      href={activeMemory.signedMediaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-[#d4af37] hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5"
                    >
                      <Eye className="w-4 h-4" />
                      <span>View Private Document</span>
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Header Titles */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/30">
                  {activeMemory.type}
                </span>
                {activeMemory.eventYear && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-900 text-slate-300 border border-slate-800">
                    Year {activeMemory.eventYear}
                  </span>
                )}
                {activeMemory.branchTag && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/40 text-emerald-300 border border-emerald-800/40">
                    {activeMemory.branchTag}
                  </span>
                )}
              </div>

              <h2 className="text-xl font-bold font-heritage text-white">{activeMemory.title}</h2>
              {activeMemory.titleKm && (
                <p className="text-sm font-khmer text-slate-400 mt-0.5">{activeMemory.titleKm}</p>
              )}
            </div>

            {/* Description & Story */}
            {(activeMemory.description || activeMemory.descriptionKm) && (
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-300 text-xs leading-relaxed my-4 space-y-2">
                {activeMemory.description && <p>{activeMemory.description}</p>}
                {activeMemory.descriptionKm && (
                  <p className="font-khmer text-slate-400 pt-2 border-t border-slate-800/80">
                    {activeMemory.descriptionKm}
                  </p>
                )}
              </div>
            )}

            {/* Metadata Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 my-4 text-[11px] text-slate-300">
              {activeMemory.location && (
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">Location</span>
                  <span className="font-medium text-white flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 text-[#d4af37]" />
                    {activeMemory.location}
                  </span>
                </div>
              )}

              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-500 block">Preserved By</span>
                <span className="font-medium text-white flex items-center gap-1 mt-0.5">
                  <User className="w-3 h-3 text-[#d4af37]" />
                  {activeMemory.createdBy.fullName}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-500 block">Added on</span>
                <span className="font-medium text-white flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3 text-[#d4af37]" />
                  {new Date(activeMemory.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Tagged Relatives */}
            {activeMemory.taggedPeople.length > 0 && (
              <div className="my-4">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
                  Tagged Relatives ({activeMemory.taggedPeople.length})
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {activeMemory.taggedPeople.map(({ person }) => (
                    <Link
                      key={person.id}
                      href={`/spaces/${spaceId}/relatives`}
                      className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-[#d4af37]/60 transition-colors flex items-center gap-2.5"
                    >
                      <div className="w-8 h-8 rounded-full border border-slate-700 bg-slate-800 flex items-center justify-center text-xs text-[#d4af37] overflow-hidden shrink-0">
                        {person.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={person.photoUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span>{person.firstName[0]}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-white truncate">
                          {person.firstName} {person.lastName}
                        </p>
                        {person.khmerName && (
                          <p className="text-[10px] font-khmer text-slate-400 truncate">
                            {person.khmerName}
                          </p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800 mt-6 text-xs">
              <span className="text-slate-500 text-[10px]">Family Vault Encrypted & Private</span>
              <button
                type="button"
                onClick={() => handleDeleteMemory(activeMemory.id)}
                disabled={deletingId === activeMemory.id}
                className="px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deletingId === activeMemory.id ? "Deleting..." : "Delete Memory"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MemoriesParamResolver({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = use(params);
  return <MemoriesContent spaceId={spaceId} />;
}

export default function FamilyMemoriesPage({
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
      <MemoriesParamResolver params={params} />
    </Suspense>
  );
}
