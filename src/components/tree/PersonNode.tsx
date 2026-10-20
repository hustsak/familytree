"use client";

import React, { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { User, Heart, Users } from "lucide-react";

export interface PersonNodeData {
  person: {
    id: string;
    firstName: string;
    lastName: string;
    khmerName?: string | null;
    gender: "MALE" | "FEMALE" | "OTHER" | "UNKNOWN";
    birthYear?: number | null;
    deathYear?: number | null;
    isLiving: boolean;
    photoUrl?: string | null;
  };
  generation: number;
  parentsCount: number;
  childrenCount: number;
  spousesCount: number;
  isHighlighted?: boolean;
}

export const HeritagePersonNode = memo(function HeritagePersonNode({
  data,
  selected,
}: NodeProps) {
  const nodeData = data as unknown as PersonNodeData;
  const person = nodeData?.person;
  const generation = nodeData?.generation ?? 0;
  const isHighlighted = nodeData?.isHighlighted ?? false;

  if (!person) {
    return (
      <div className="w-[240px] p-3 rounded-xl bg-slate-900 border border-red-500 text-xs text-white">
        Loading relative...
      </div>
    );
  }

  const isFemale = person.gender === "FEMALE";
  const isMale = person.gender === "MALE";

  const khmerName = person.khmerName?.trim();
  const latinName = `${person.lastName} ${person.firstName}`.trim();

  return (
    <div
      className={`relative w-[240px] rounded-2xl transition-all duration-300 select-none cursor-pointer ${
        selected || isHighlighted
          ? "ring-2 ring-[#d4af37] shadow-xl shadow-[#d4af37]/40 scale-105"
          : "hover:ring-1 hover:ring-[#d4af37]/70 hover:shadow-lg hover:shadow-black/70"
      }`}
    >
      {/* Top Handle for Parent-Child Incoming Connections */}
      <Handle
        id="parent-in"
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-[#d4af37] !border-2 !border-[#0c0f14] !-top-1.5"
      />

      {/* Side Handles for Horizontal Spouse Connections */}
      <Handle
        id="spouse-in"
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-rose-500 !border-2 !border-[#0c0f14] !-left-1.5"
      />
      <Handle
        id="spouse-out"
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-rose-500 !border-2 !border-[#0c0f14] !-right-1.5"
      />

      {/* Main Node Card Body */}
      <div className="heritage-card p-3.5 bg-gradient-to-b from-[#182030] to-[#0f141f] border border-[#d4af37]/35 rounded-2xl overflow-hidden relative shadow-lg shadow-black/40">
        {/* Subtle gender accent header line */}
        <div
          className={`absolute top-0 left-0 right-0 h-1 ${
            isFemale
              ? "bg-gradient-to-r from-rose-500 via-[#d4af37] to-rose-500"
              : isMale
              ? "bg-gradient-to-r from-blue-500 via-[#d4af37] to-blue-500"
              : "bg-[#d4af37]"
          }`}
        />

        <div className="flex items-center gap-3">
          {/* Avatar / Portrait */}
          <div className="relative shrink-0">
            {person.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={person.photoUrl}
                alt={khmerName || latinName}
                className="w-11 h-11 rounded-full object-cover border-2 border-[#d4af37]/50 shadow-sm"
              />
            ) : (
              <div
                className={`w-11 h-11 rounded-full flex items-center justify-center border border-[#d4af37]/40 shadow-sm ${
                  isFemale
                    ? "bg-rose-950/50 text-rose-300"
                    : isMale
                    ? "bg-blue-950/50 text-blue-300"
                    : "bg-slate-800 text-slate-300"
                }`}
              >
                <User className="w-5 h-5 text-[#d4af37]" />
              </div>
            )}

            {/* Living dot indicator */}
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0c0f14] ${
                person.isLiving ? "bg-emerald-500" : "bg-slate-500"
              }`}
              title={person.isLiving ? "នៅរស់ (Living)" : "ទទួលមរណភាព (Deceased)"}
            />
          </div>

          {/* Name & Details: Real Name displayed clearly */}
          <div className="min-w-0 flex-1">
            {khmerName ? (
              <>
                <h4
                  className="text-sm font-bold text-white font-khmer leading-snug line-clamp-1"
                  title={khmerName}
                >
                  {khmerName}
                </h4>
                <p
                  className="text-[11px] font-medium text-[#d4af37] font-heritage leading-tight line-clamp-1"
                  title={latinName}
                >
                  {latinName}
                </p>
              </>
            ) : (
              <h4
                className="text-sm font-bold text-white font-khmer leading-snug line-clamp-1"
                title={latinName}
              >
                {latinName || "សាច់ញាតិ (Relative)"}
              </h4>
            )}

            <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-300 font-khmer">
              <span>
                {person.birthYear
                  ? `${person.birthYear} — ${person.deathYear || (person.isLiving ? "បច្ចុប្បន្ន" : "")}`
                  : person.isLiving
                  ? "នៅរស់ (Living)"
                  : "មរណភាព (Deceased)"}
              </span>
            </div>
          </div>
        </div>

        {/* Footer info: Generation Tag and Relation Badges */}
        <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-khmer">
          <span className="font-medium text-[#d4af37]">
            ជំនាន់ទី {generation + 1}
          </span>

          <div className="flex items-center gap-2">
            {nodeData.spousesCount > 0 && (
              <span className="flex items-center gap-0.5 text-rose-400 font-medium" title="ប្តីប្រពន្ធ (Spouse)">
                <Heart className="w-2.5 h-2.5 fill-rose-500/30" />
                <span>{nodeData.spousesCount}</span>
              </span>
            )}
            {nodeData.childrenCount > 0 && (
              <span className="flex items-center gap-0.5 text-emerald-400 font-medium" title="កូន (Children)">
                <Users className="w-2.5 h-2.5" />
                <span>{nodeData.childrenCount}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Handle for Children Outgoing Connections */}
      <Handle
        id="child-out"
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-[#d4af37] !border-2 !border-[#0c0f14] !-bottom-1.5"
      />
    </div>
  );
});
