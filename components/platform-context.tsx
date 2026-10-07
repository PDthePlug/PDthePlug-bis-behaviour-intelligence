"use client";

import { createContext, useContext, useMemo } from "react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";

// The signed-in platform uses normal requests and navigation. The public
// explorer supplies a closed, local example transport; it grants no access.
const browserRequest: typeof fetch = (...args) => fetch(...args);
const directHref = (href: string) => href;
export type PlatformNavigationGuard = () => Promise<boolean>;
const ignoreNavigationGuard = (_guard: PlatformNavigationGuard | null): void => undefined;
export const PlatformContext = createContext({ request: browserRequest, href: directHref, example: false, registerNavigationGuard: ignoreNavigationGuard });
export const usePlatform = () => useContext(PlatformContext);

export function PlatformLink(props: ComponentProps<typeof NextLink>) {
  const { href } = usePlatform();
  return <NextLink {...props} href={typeof props.href === "string" ? href(props.href) : props.href} />;
}

export function usePlatformRouter() {
  const router = useRouter();
  const { href } = usePlatform();
  return useMemo(() => ({ ...router, push: (url: string, options?: Parameters<typeof router.push>[1]) => router.push(href(url), options), replace: (url: string, options?: Parameters<typeof router.replace>[1]) => router.replace(href(url), options) }), [router, href]);
}
