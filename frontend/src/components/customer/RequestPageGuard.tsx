"use client";

import { useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { NavStateContext } from "@/context/NavStateContext";
import DynamicRequestForm from "@/components/customer/DynamicRequestForm";

export default function RequestPageGuard() {
  const router = useRouter();
  const { isProUser, isLoggedIn } = useContext(NavStateContext);
  const redirected = useRef(false);
  const [mounted, setMounted] = useState(false);

  // The form reads browser state. Defer rendering until hydration while keeping
  // its module in the route bundle for the Cloudflare Pages adapter.
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (isLoggedIn && isProUser && !redirected.current) {
      redirected.current = true;
      router.replace("/");
    }
  }, [isLoggedIn, isProUser, router]);

  if (!mounted || (isLoggedIn && isProUser)) {
    return null;
  }

  return <DynamicRequestForm />;
}
