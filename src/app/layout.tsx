import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter, Noto_Serif_Devanagari } from "next/font/google";
import { SiteBackdrop } from "@/components/brand/SiteBackdrop";
import { MotionProvider } from "@/components/layout/MotionProvider";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SkipLink } from "@/components/layout/SkipLink";
import "./globals.css";

/* Fonts are self-hosted by next/font: no request reaches Google from the visitor's browser. */

const display = Cormorant_Garamond({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-cormorant",
});

const sans = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

// Only needed where Devanagari syllables are shown, so it is not preloaded on every page.
const devanagari = Noto_Serif_Devanagari({
  subsets: ["devanagari"],
  display: "swap",
  preload: false,
  variable: "--font-noto-serif-devanagari",
});

const DESCRIPTION =
  "SoulLetter calculates your sidereal Vedic birth chart and numerological profile, then shows the name syllables " +
  "traditional methods associate with it. Symbolic interpretations for reflection and entertainment — not predictions.";

export const metadata: Metadata = {
  title: {
    default: "SoulLetter — Symbolic partner-name syllables",
    template: "%s · SoulLetter",
  },
  description: DESCRIPTION,
  applicationName: "SoulLetter",
  openGraph: {
    type: "website",
    siteName: "SoulLetter",
    title: "SoulLetter — Symbolic partner-name syllables",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary",
    title: "SoulLetter — Symbolic partner-name syllables",
    description: DESCRIPTION,
  },
  formatDetection: { telephone: false, address: false, email: false },
};

export const viewport: Viewport = {
  themeColor: "#03051a",
  colorScheme: "dark",
};

/** Content hidden for a Framer Motion entrance must stay visible when JavaScript is off. */
const NO_SCRIPT_STYLES = "[data-reveal]{opacity:1!important;transform:none!important}";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${display.variable} ${sans.variable} ${devanagari.variable}`}
    >
      <body className="relative isolate flex min-h-dvh flex-col font-sans text-ivory-100 antialiased">
        <noscript>
          <style>{NO_SCRIPT_STYLES}</style>
        </noscript>
        <SkipLink targetId="main-content" />
        <SiteBackdrop />
        <MotionProvider>
          <SiteHeader />
          <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col focus:outline-none">
            {children}
          </main>
          <SiteFooter />
        </MotionProvider>
      </body>
    </html>
  );
}
