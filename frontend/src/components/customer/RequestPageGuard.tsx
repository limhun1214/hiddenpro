"use client";

import { useContext, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { NavStateContext } from "@/context/NavStateContext";
import dynamic from "next/dynamic";

const DynamicRequestForm = dynamic(
  () => import("@/components/customer/DynamicRequestForm"),
  { ssr: false },
);

export default function RequestPageGuard() {
  const router = useRouter();
  const { isProUser, isLoggedIn } = useContext(NavStateContext);
  const redirected = useRef(false);

  useEffect(() => {
    if (isLoggedIn && isProUser && !redirected.current) {
      redirected.current = true;
      router.replace("/");
    }
  }, [isLoggedIn, isProUser, router]);

  if (isLoggedIn && isProUser) {
    return null;
  }

  return <DynamicRequestForm />;
}
