"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { ROUTE_TRANSITION_MS } from "./route-transition";
import { useStorefrontRouteLoading } from "./StorefrontRouteLoadingProvider";

function isModifiedClick(event) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

function shouldSkipTransition(href) {
  return !href?.startsWith("/") || href.startsWith("//");
}

function prefersReducedMotion() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function AnimatedRouteLink({
  href,
  className,
  children,
  onClick,
  prefetch
}) {
  const router = useRouter();
  const { startRouteLoading } = useStorefrontRouteLoading();
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  function handleClick(event) {
    onClick?.(event);
    if (event.defaultPrevented) return;
    if (event.button !== 0 || isModifiedClick(event) || shouldSkipTransition(href)) return;
    event.preventDefault();
    startRouteLoading(href);

    const navigate = () => router.push(href);
    if (prefersReducedMotion()) {
      navigate();
      return;
    }

    timerRef.current = window.setTimeout(navigate, ROUTE_TRANSITION_MS);
  }

  return (
    <Link href={href} className={className} onClick={handleClick} prefetch={prefetch}>
      {children}
    </Link>
  );
}
