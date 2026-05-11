"use client";

import { usePathname, useSearchParams } from "next/navigation";
import {
  Suspense,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

import { ROUTE_TRANSITION_EXIT_CLASS } from "./route-transition";

const StorefrontRouteLoadingContext = createContext(null);
const ROUTE_LOADING_TIMEOUT_MS = 8000;

function normalizePathname(pathname) {
  if (!pathname) return "/";
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
}

function RouteLoadingStateSync({ stopRouteLoading }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    stopRouteLoading();
  }, [pathname, searchParams?.toString(), stopRouteLoading]);

  return null;
}

export function useStorefrontRouteLoading() {
  const value = useContext(StorefrontRouteLoadingContext);
  if (!value) {
    throw new Error("useStorefrontRouteLoading must be used within StorefrontRouteLoadingProvider");
  }
  return value;
}

export default function StorefrontRouteLoadingProvider({ children }) {
  const [pendingHref, setPendingHref] = useState(null);

  const stopRouteLoading = useCallback(() => {
    setPendingHref(null);
    if (typeof document !== "undefined") {
      document.body.classList.remove(ROUTE_TRANSITION_EXIT_CLASS);
    }
  }, []);

  const startRouteLoading = useCallback((href) => {
    if (typeof window === "undefined") return;

    try {
      const nextUrl = new URL(href, window.location.href);
      const currentUrl = new URL(window.location.href);
      const nextComparable = `${normalizePathname(nextUrl.pathname)}${nextUrl.search}`;
      const currentComparable = `${normalizePathname(currentUrl.pathname)}${currentUrl.search}`;

      if (nextComparable === currentComparable) return;

      setPendingHref(nextUrl.toString());
      document.body.classList.add(ROUTE_TRANSITION_EXIT_CLASS);
    } catch {
      // ignore invalid URLs
    }
  }, []);

  useEffect(() => {
    if (!pendingHref || typeof window === "undefined") return;
    const timer = window.setTimeout(() => {
      stopRouteLoading();
    }, ROUTE_LOADING_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [pendingHref, stopRouteLoading]);

  const value = useMemo(
    () => ({
      pendingHref,
      startRouteLoading,
      stopRouteLoading
    }),
    [pendingHref, startRouteLoading, stopRouteLoading]
  );

  return (
    <StorefrontRouteLoadingContext.Provider value={value}>
      <Suspense fallback={null}>
        <RouteLoadingStateSync stopRouteLoading={stopRouteLoading} />
      </Suspense>
      {pendingHref ? (
        <div className="products-nav-loader" role="status" aria-live="polite" aria-label="Loading page">
          <div className="pg-route-spinner" />
        </div>
      ) : null}
      {children}
    </StorefrontRouteLoadingContext.Provider>
  );
}
