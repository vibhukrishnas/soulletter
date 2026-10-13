"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { cn } from "@/components/ui/cn";
import { CloseIcon, MenuIcon } from "@/components/ui/icons";
import { DISCOVER_CTA_LABEL, DISCOVER_HREF, PRIMARY_NAV_LINKS, isActivePath } from "./nav-links";

const MOBILE_MENU_ID = "site-mobile-menu";

/**
 * Main navigation. Inline links on md+; on smaller screens a "Menu" disclosure button
 * (aria-expanded/aria-controls) toggles a panel — no hover-only behaviour. The panel closes
 * on Escape (returning focus to the button), outside click, link activation, and route change.
 */
export function SiteNav() {
  const pathname = usePathname();
  // The menu is open only for the path it was opened on, so navigation closes it without an effect.
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt !== null && openedAt === pathname;
  const navRef = useRef<HTMLElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenedAt(null);
        buttonRef.current?.focus();
      }
    }
    function handlePointerDown(event: PointerEvent) {
      if (navRef.current && event.target instanceof Node && !navRef.current.contains(event.target)) {
        setOpenedAt(null);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  const close = () => setOpenedAt(null);
  const discoverActive = isActivePath(pathname, DISCOVER_HREF);

  return (
    <nav ref={navRef} aria-label="Main" className="flex items-center">
      {/* Desktop */}
      <ul className="hidden items-center gap-1 md:flex">
        {PRIMARY_NAV_LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              aria-current={isActivePath(pathname, link.href) ? "page" : undefined}
              className={cn(
                "relative rounded-full px-3.5 py-2 text-sm text-mist-200 transition-colors duration-200",
                "hover:bg-white/[0.06] hover:text-ivory-50",
                "aria-[current=page]:text-ivory-50 aria-[current=page]:after:absolute aria-[current=page]:after:inset-x-3.5",
                "aria-[current=page]:after:-bottom-0.5 aria-[current=page]:after:h-px aria-[current=page]:after:bg-gold-300/70",
              )}
            >
              {link.label}
            </Link>
          </li>
        ))}
        <li className="ml-2">
          <ButtonLink href={DISCOVER_HREF} size="sm" aria-current={discoverActive ? "page" : undefined}>
            {DISCOVER_CTA_LABEL}
          </ButtonLink>
        </li>
      </ul>

      {/* Mobile */}
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={MOBILE_MENU_ID}
        onClick={() => setOpenedAt(open ? null : pathname)}
        className={cn(
          "inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 px-4 text-sm font-medium text-ivory-50",
          "transition-colors duration-200 hover:border-gold-300/50 hover:bg-white/[0.05] md:hidden",
        )}
      >
        {open ? <CloseIcon className="size-[1.125rem]" /> : <MenuIcon className="size-[1.125rem]" />}
        Menu
      </button>

      <div
        id={MOBILE_MENU_ID}
        hidden={!open}
        className="absolute inset-x-0 top-full border-b border-line bg-night-950/95 shadow-raised md:hidden"
      >
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="px-4 pt-3 pb-6 sm:px-6"
          >
            <ul className="flex flex-col">
              {PRIMARY_NAV_LINKS.map((link) => (
                <li key={link.href} className="border-b border-line">
                  <Link
                    href={link.href}
                    onClick={close}
                    aria-current={isActivePath(pathname, link.href) ? "page" : undefined}
                    className={cn(
                      "flex min-h-12 items-center justify-between rounded-md py-3 text-base text-ivory-100",
                      "hover:text-ivory-50 aria-[current=page]:font-medium aria-[current=page]:text-gold-200",
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <ButtonLink
              href={DISCOVER_HREF}
              onClick={close}
              fullWidth
              className="mt-5"
              aria-current={discoverActive ? "page" : undefined}
            >
              {DISCOVER_CTA_LABEL}
            </ButtonLink>
          </motion.div>
        ) : null}
      </div>
    </nav>
  );
}
