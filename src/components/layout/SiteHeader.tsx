import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Container } from "./Container";
import { SiteNav } from "./SiteNav";

/** Sticky site header: logo (home link) and main navigation. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-night-950/80 backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link href="/" aria-label="SoulLetter home" className="-mx-1 rounded-md px-1 py-1.5">
          <Logo size="sm" />
        </Link>
        <SiteNav />
      </Container>
    </header>
  );
}
