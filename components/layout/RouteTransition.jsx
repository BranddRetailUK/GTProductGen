"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { ROUTE_TRANSITION_EXIT_CLASS } from "./route-transition";

export default function RouteTransition({ children }) {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.body.classList.remove(ROUTE_TRANSITION_EXIT_CLASS);
    }
  }, [pathname]);

  return (
    <div key={pathname} className="route-transition-page">
      {children}
    </div>
  );
}
