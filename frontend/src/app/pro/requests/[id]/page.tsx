"use client";

import ProBiddingDetail from "@/components/pro/ProBiddingDetail";
import { useParams } from "next/navigation";

export const runtime = "edge";

export default function RequestDetailPage() {
  const params = useParams<{ id: string }>();
  return <ProBiddingDetail requestId={params.id} />;
}
