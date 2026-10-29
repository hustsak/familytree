"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, [router]);

  return (
    <div className="h-screen w-screen bg-[#f2f8ff] flex items-center justify-center font-khmer">
      <div className="w-10 h-10 border-2 border-[#2f7de1] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
