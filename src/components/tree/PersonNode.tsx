"use client";

import React, { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Users, ChevronUp, ChevronDown, UserPlus, Pencil, Trash2, Plus } from "lucide-react";
import { TreePerson } from "@/lib/tree-layout";

// =========================================================================
// 1. HeritagePersonNode (Individual Person Node)
// =========================================================================

export interface PersonNodeData {
  person: TreePerson;
  generation: number;
  layoutMode?: "horizontal" | "vertical";
  isBiologicalChild?: boolean;
  relationshipTypeToParents?: "PARENT_CHILD" | "ADOPTIVE_PARENT_CHILD" | "NONE";
  parentsCount: number;
  childrenCount: number;
  spousesCount: number;
  isHighlighted?: boolean;
  isCollapsed?: boolean;
  onSelectPerson?: (personId: string) => void;
  onEditPerson?: (personId: string) => void;
  onDeletePerson?: (personId: string) => void;
  onAddSpouse?: (personId: string) => void;
  onAddRelative?: (personId: string) => void;
  onToggleCollapse?: (personId: string) => void;
}

export const HeritagePersonNode = memo(function HeritagePersonNode({
  data,
  selected,
}: NodeProps) {
  const nodeData = data as unknown as PersonNodeData;
  const person = nodeData?.person;
  const generation = nodeData?.generation ?? 0;
  const isHighlighted = nodeData?.isHighlighted ?? false;
  const childrenCount = nodeData?.childrenCount ?? 0;
  const isCollapsed = nodeData?.isCollapsed ?? false;

  if (!person) {
    return (
      <div className="w-[210px] p-3 rounded-xl bg-white border border-red-400 text-xs text-red-500 font-khmer">
        កំពុងផ្ទុក...
      </div>
    );
  }

  const khmerName = person.khmerName?.trim();
  const latinName = `${person.lastName} ${person.firstName}`.trim();
  const displayName = khmerName || latinName;

  return (
    <div
      className={`relative group w-[210px] bg-white rounded-xl border border-slate-200/90 transition-all duration-200 select-none overflow-hidden font-khmer ${
        selected || isHighlighted
          ? "ring-2 ring-blue-500 shadow-md scale-[1.02]"
          : "hover:border-blue-300 hover:shadow-md"
      }`}
    >
      {/* Top Handle */}
      <Handle
        id="parent-in"
        type="target"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-white !-top-1.5 cursor-pointer"
      />
      {/* Side Handles */}
      <Handle
        id="spouse-in"
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-blue-400 !border-2 !border-white !-left-1"
      />
      <Handle
        id="spouse-out"
        type="source"
        position={Position.Right}
        className="!w-2 !h-2 !bg-blue-400 !border-2 !border-white !-right-1"
      />

      {/* Top Teal Accent Bar */}
      <div className="h-[3px] w-full bg-[#0d9488]" />

      {/* Top Badges Row */}
      <div className="px-3 pt-2.5 pb-1 flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#e0f2fe] text-[#0284c7] border border-[#bae6fd]/60 shrink-0">
            ជំនាន់ទី {generation + 1}
          </span>
          <span
            className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#f1f5f9] text-[#475569] border border-slate-200/60 truncate max-w-[85px]"
            title={displayName}
          >
            {displayName}
          </span>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            nodeData.onAddRelative?.(person.id);
          }}
          className="p-0.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer shrink-0"
          title="បន្ថែមសមាជិក"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Person Name Row */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          nodeData.onSelectPerson?.(person.id);
        }}
        className="px-3 pt-1 pb-1.5 flex items-center justify-between cursor-pointer group/name"
        title={displayName}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
          <h4 className="font-bold text-[14.5px] text-slate-900 font-khmer leading-snug truncate">
            {displayName}
          </h4>
        </div>
        {/* Quick Edit/Delete on Hover */}
        <div className="opacity-0 group-hover/name:opacity-100 flex items-center gap-0.5 transition-opacity shrink-0 ml-1">
          <button
            type="button"
            title="កែប្រែ"
            onClick={(e) => {
              e.stopPropagation();
              nodeData.onEditPerson?.(person.id);
            }}
            className="p-0.5 rounded hover:bg-slate-100 text-slate-500 cursor-pointer"
          >
            <Pencil className="w-3 h-3" />
          </button>
          <button
            type="button"
            title="លុប"
            onClick={(e) => {
              e.stopPropagation();
              nodeData.onDeletePerson?.(person.id);
            }}
            className="p-0.5 rounded hover:bg-rose-50 text-rose-500 cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Dotted Separator */}
      <div className="mx-3 border-t border-dotted border-slate-200" />

      {/* Spouse Action Row */}
      <div className="p-2.5 pt-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            nodeData.onAddSpouse?.(person.id);
          }}
          className="w-full py-1.5 px-3 rounded-lg bg-[#f0f6ff] hover:bg-[#e0edff] border border-blue-100/90 flex items-center justify-center gap-1.5 text-blue-600 text-[11.5px] font-medium transition-colors cursor-pointer shadow-2xs"
        >
          <UserPlus className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          <span>+ បន្ថែមប្តី / ប្រពន្ធ</span>
        </button>
      </div>

      {/* Footer Row: Children Pill */}
      <div className="px-3 pb-2.5 flex items-center justify-end">
        {childrenCount > 0 ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              nodeData.onToggleCollapse?.(person.id);
            }}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer border border-slate-200/60"
            title={isCollapsed ? "ពន្លាតមែកធាងកូន" : "បង្រួមមែកធាងកូន"}
          >
            {isCollapsed ? (
              <ChevronUp className="w-3 h-3 text-slate-500" />
            ) : (
              <ChevronDown className="w-3 h-3 text-slate-500" />
            )}
            <span>{childrenCount} កូន</span>
          </button>
        ) : (
          <span className="text-[10px] text-slate-400 font-khmer">
            0 កូន
          </span>
        )}
      </div>

      {/* Bottom Handle */}
      <Handle
        id="child-out"
        type="source"
        position={Position.Bottom}
        className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-white !-bottom-1.5 cursor-pointer"
      />
    </div>
  );
});

// =========================================================================
// 2. HeritageCoupleNode (Exact Card Layout matching reference screenshot)
// =========================================================================

export interface CoupleNodeData {
  primaryPerson: TreePerson;
  spousePerson?: TreePerson | null;
  husband?: TreePerson | null;
  wife?: TreePerson | null;
  additionalSpousesCount: number;
  generation: number; // 0-indexed
  layoutMode: "horizontal" | "vertical";
  isBiologicalChild: boolean;
  relationshipTypeToParents: "PARENT_CHILD" | "ADOPTIVE_PARENT_CHILD" | "NONE";
  biologicalChildrenCount: number;
  totalChildrenCount: number;
  hasChildren: boolean;
  isCollapsed: boolean;
  isRootAncestor: boolean;
  isHighlighted?: boolean;
  onSelectPerson?: (personId: string) => void;
  onEditPerson?: (personId: string) => void;
  onDeletePerson?: (personId: string) => void;
  onAddSpouse?: (personId: string) => void;
  onAddRelative?: (personId: string) => void;
  onToggleCollapse?: (personId: string) => void;
}

export const HeritageCoupleNode = memo(function HeritageCoupleNode({
  data,
  selected,
}: NodeProps) {
  const nodeData = data as unknown as CoupleNodeData;
  const primary = nodeData?.primaryPerson;
  const spouse =
    nodeData?.spousePerson ||
    (primary?.id === nodeData?.husband?.id ? nodeData?.wife : null) ||
    (primary?.id === nodeData?.wife?.id ? nodeData?.husband : null);
  const generation = nodeData?.generation ?? 0;
  const isHighlighted = nodeData?.isHighlighted ?? false;
  const isCollapsed = nodeData?.isCollapsed ?? false;
  const childrenCount = nodeData?.biologicalChildrenCount ?? nodeData?.totalChildrenCount ?? 0;

  if (!primary) {
    return (
      <div className="w-[210px] p-3 rounded-xl bg-white border border-red-400 text-xs text-red-500 font-khmer">
        កំពុងផ្ទុក...
      </div>
    );
  }

  const primaryName =
    primary.khmerName?.trim() || `${primary.lastName} ${primary.firstName}`.trim();
  const spouseName = spouse
    ? spouse.khmerName?.trim() || `${spouse.lastName} ${spouse.firstName}`.trim()
    : "";

  return (
    <div
      className={`relative group w-[210px] bg-white rounded-xl border border-slate-200/90 transition-all duration-200 select-none overflow-hidden font-khmer ${
        selected || isHighlighted
          ? "ring-2 ring-blue-500 shadow-md scale-[1.02]"
          : "hover:border-blue-300 hover:shadow-md"
      }`}
    >
      {/* Top Handle for Parent-Child Incoming */}
      <Handle
        id="parent-in"
        type="target"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-white !-top-1.5 cursor-pointer"
      />
      {/* Side Handles */}
      <Handle
        id="spouse-in"
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-blue-400 !border-2 !border-white !-left-1"
      />
      <Handle
        id="spouse-out"
        type="source"
        position={Position.Right}
        className="!w-2 !h-2 !bg-blue-400 !border-2 !border-white !-right-1"
      />

      {/* Top Teal Accent Bar */}
      <div className="h-[3px] w-full bg-[#0d9488]" />

      {/* Top Badges Row */}
      <div className="px-3 pt-2.5 pb-1 flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#e0f2fe] text-[#0284c7] border border-[#bae6fd]/60 shrink-0">
            ជំនាន់ទី {generation + 1}
          </span>
          <span
            className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#f1f5f9] text-[#475569] border border-slate-200/60 truncate max-w-[85px]"
            title={primaryName}
          >
            {primaryName}
          </span>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            nodeData.onAddRelative?.(primary.id);
          }}
          className="p-0.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer shrink-0"
          title="បន្ថែមសមាជិកគ្រួសារ"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Person Name Row */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          nodeData.onSelectPerson?.(primary.id);
        }}
        className="px-3 pt-1 pb-1.5 flex items-center justify-between cursor-pointer group/name"
        title={primaryName}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
          <h4 className="font-bold text-[14.5px] text-slate-900 font-khmer leading-snug truncate">
            {primaryName}
          </h4>
        </div>
        {/* Quick Edit/Delete on Hover */}
        <div className="opacity-0 group-hover/name:opacity-100 flex items-center gap-0.5 transition-opacity shrink-0 ml-1">
          <button
            type="button"
            title="កែប្រែ"
            onClick={(e) => {
              e.stopPropagation();
              nodeData.onEditPerson?.(primary.id);
            }}
            className="p-0.5 rounded hover:bg-slate-100 text-slate-500 cursor-pointer"
          >
            <Pencil className="w-3 h-3" />
          </button>
          <button
            type="button"
            title="លុប"
            onClick={(e) => {
              e.stopPropagation();
              nodeData.onDeletePerson?.(primary.id);
            }}
            className="p-0.5 rounded hover:bg-rose-50 text-rose-500 cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Dotted Separator */}
      <div className="mx-3 border-t border-dotted border-slate-200" />

      {/* Spouse Action Row */}
      <div className="p-2.5 pt-2">
        {spouse ? (
          <div
            onClick={(e) => {
              e.stopPropagation();
              nodeData.onSelectPerson?.(spouse.id);
            }}
            className="w-full py-1.5 px-3 rounded-lg bg-[#f0f6ff] hover:bg-[#e0edff] border border-blue-100/90 flex items-center justify-between gap-1.5 text-blue-700 text-[11.5px] font-medium transition-colors cursor-pointer"
            title={`ប្តី/ប្រពន្ធ៖ ${spouseName}`}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <Users className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span className="truncate">{spouseName}</span>
            </div>
            {nodeData.additionalSpousesCount > 0 && (
              <span className="px-1.5 py-0.2 rounded text-[8.5px] font-bold bg-blue-200 text-blue-900 shrink-0">
                +{nodeData.additionalSpousesCount}
              </span>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              nodeData.onAddSpouse?.(primary.id);
            }}
            className="w-full py-1.5 px-3 rounded-lg bg-[#f0f6ff] hover:bg-[#e0edff] border border-blue-100/90 flex items-center justify-center gap-1.5 text-blue-600 text-[11.5px] font-medium transition-colors cursor-pointer shadow-2xs"
          >
            <UserPlus className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span>+ បន្ថែមប្តី / ប្រពន្ធ</span>
          </button>
        )}
      </div>

      {/* Footer Row: Children Pill */}
      <div className="px-3 pb-2.5 flex items-center justify-end">
        {childrenCount > 0 ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              nodeData.onToggleCollapse?.(primary.id);
            }}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer border border-slate-200/60"
            title={isCollapsed ? "ពន្លាតមែកធាងកូន" : "បង្រួមមែកធាងកូន"}
          >
            {isCollapsed ? (
              <ChevronUp className="w-3 h-3 text-slate-500" />
            ) : (
              <ChevronDown className="w-3 h-3 text-slate-500" />
            )}
            <span>{childrenCount} កូន</span>
          </button>
        ) : (
          <span className="text-[10px] text-slate-400 font-khmer">
            0 កូន
          </span>
        )}
      </div>

      {/* Bottom Handle for Children Outgoing */}
      <Handle
        id="child-out"
        type="source"
        position={Position.Bottom}
        className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-white !-bottom-1.5 cursor-pointer"
      />
    </div>
  );
});

