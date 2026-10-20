"use client";

import React, { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { User, Heart } from "lucide-react";

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
  const { person, generation, isHighlighted } = nodeData;

  const isFemale = person.gender === "FEMALE";
  const isMale = person.gender === "MALE";

  return (
    <div
      className={`relative w-[220px] rounded-2xl transition-all duration-300 select-none ${
        selected || isHighlighted
          ? "ring-2 ring-[#d4af37] shadow-xl shadow-[#d4af37]/30 scale-105"
          : "hover:ring-1 hover:ring-[#d4af37]/60 hover:shadow-lg hover:shadow-black/60"
      }`}
    >
      {/* Top Handle for Parent Incoming Connections */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-[#d4af37] !border-2 !border-[#0c0f14] !-top-1.5"
      />

      {/* Side Handles for Spouse Connections */}
      <Handle
        type="source"
        position={Position.Left}
        id="spouse-left"
        className="!w-2.5 !h-2.5 !bg-rose-500 !border-2 !border-[#0c0f14] !-left-1.5"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="spouse-right"
        className="!w-2.5 !h-2.5 !bg-rose-500 !border-2 !border-[#0c0f14] !-right-1.5"
      />

      {/* Main Node Card Body */}
      <div className="heritage-card p-3.5 bg-gradient-to-b from-[#182030] to-[#0f141f] border border-[#d4af37]/30 rounded-2xl overflow-hidden relative">
        {/* Subtle accent header line */}
        <div
          className={`absolute top-0 left-0 right-0 h-1 ${
            isFemale
              ? "bg-gradient-to-r from-rose-500/80 via-[#d4af37] to-rose-500/80"
              : isMale
              ? "bg-gradient-to-r from-blue-500/80 via-[#d4af37] to-blue-500/80"
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
                alt={`${person.firstName} ${person.lastName}`}
                className="w-11 h-11 rounded-full object-cover border-2 border-[#d4af37]/40 shadow-sm"
              />
            ) : (
              <div
                className={`w-11 h-11 rounded-full flex items-center justify-center border border-[#d4af37]/30 shadow-sm ${
                  isFemale
                    ? "bg-rose-950/40 text-rose-300"
                    : isMale
                    ? "bg-blue-950/40 text-blue-300"
                    : "bg-slate-800 text-slate-300"
                }`}
              >
                <User className="w-5 h-5 text-[#d4af37]" />
              </div>
            )}

            {/* Living or Generation dot indicator */}
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#0c0f14] ${
                person.isLiving ? "bg-emerald-500" : "bg-slate-600"
              }`}
              title={person.isLiving ? "Living" : "Deceased"}
            />
          </div>

          {/* Name & Details */}
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-bold text-slate-100 truncate font-heritage leading-snug">
              {person.firstName} {person.lastName}
            </h4>
            {person.khmerName && (
              <p className="text-[10px] text-slate-400 truncate font-khmer leading-tight">
                {person.khmerName}
              </p>
            )}

            <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
              <span>
                {person.birthYear
                  ? `${person.birthYear} — ${person.deathYear || (person.isLiving ? "Pres." : "")}`
                  : person.isLiving
                  ? "Living"
                  : "Deceased"}
              </span>
            </div>
          </div>
        </div>

        {/* Footer info: Generation Tag */}
        <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[9px] text-slate-500">
          <span className="font-mono text-[#d4af37]/80 font-medium">
            Gen {generation}
          </span>
          {nodeData.spousesCount > 0 && (
            <span className="flex items-center gap-1 text-rose-400/80">
              <Heart className="w-2.5 h-2.5 fill-rose-500/20" />
              <span>{nodeData.spousesCount}</span>
            </span>
          )}
        </div>
      </div>

      {/* Bottom Handle for Children Outgoing Connections */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-[#d4af37] !border-2 !border-[#0c0f14] !-bottom-1.5"
      />
    </div>
  );
});
