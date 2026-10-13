import { ClosingCta } from "@/components/landing/ClosingCta";
import { FeaturePreviews } from "@/components/landing/FeaturePreviews";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { PrivacyHighlights } from "@/components/landing/PrivacyHighlights";
import { QuickLook } from "@/components/landing/QuickLook";
import { ReadingPrinciples } from "@/components/landing/ReadingPrinciples";

/**
 * Public landing page. The root layout supplies <main id="main-content">, header and footer.
 * Uses the default title from the root layout metadata.
 */
export default function HomePage() {
  return (
    <>
      <Hero />
      <QuickLook />
      <HowItWorks />
      <FeaturePreviews />
      <ReadingPrinciples />
      <PrivacyHighlights />
      <ClosingCta />
    </>
  );
}
