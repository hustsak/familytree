"use client";

import React, { Suspense } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { FamilyTreeCanvas } from "@/app/spaces/[spaceId]/tree/page";

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen w-screen bg-[#f2f8ff] flex items-center justify-center font-khmer">
          <div className="w-10 h-10 border-2 border-[#2f7de1] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <ReactFlowProvider>
        <FamilyTreeCanvas />
      </ReactFlowProvider>
    </Suspense>
  );
}
