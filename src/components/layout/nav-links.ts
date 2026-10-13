/** Primary site navigation. The "Discover My Initial" call to action is rendered separately. */
export const PRIMARY_NAV_LINKS = [
  { href: "/methodology", label: "Methodology" },
  { href: "/privacy", label: "Privacy" },
] as const;

export const DISCOVER_HREF = "/discover";
export const DISCOVER_CTA_LABEL = "Discover My Initial";

/** True when `pathname` is `href` or a nested route beneath it. */
export function isActivePath(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}
