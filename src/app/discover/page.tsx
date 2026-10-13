import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { DiscoverFlow } from "@/components/onboarding/DiscoverFlow";

export const metadata: Metadata = {
  title: "Discover your symbolic syllable",
  description:
    "Enter your birth details to calculate a sidereal birth chart and see the name syllables traditional and experimental methods associate with it — with every qualification shown.",
};

/**
 * Guided discovery flow. The root layout supplies <main>; all state lives in the client
 * component (and sessionStorage on this device). Birth data never appears in the URL.
 */
export default function DiscoverPage() {
  return (
    <Container size="md" className="py-8 sm:py-12">
      <DiscoverFlow />
    </Container>
  );
}
