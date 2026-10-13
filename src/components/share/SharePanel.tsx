"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button, Callout, Input, LockIcon, RadioCard, RadioGroup, ShareIcon, Textarea } from "@/components/ui";
import { expiryLabel } from "@/components/reading/format";
import { ApiClientError, createShareLink } from "@/lib/client/api";
import type { ReadingResult } from "@/lib/contracts/reading";
import type { ShareCardModel } from "@/lib/contracts/share";
import { fontsFromDocument, renderShareCardPng, type CardFonts } from "@/lib/share/card-canvas";
import { buildShareCard, shareCardText } from "@/lib/share/card";
import { ShareCardPreview } from "./ShareCardPreview";
import { shareRequestFor, type CardKind } from "./share-request";

type LinkState =
  | { status: "idle" }
  | { status: "creating" }
  | { status: "created"; url: string; expiresAt: string }
  | { status: "error"; message: string };

type ActionState = { status: "idle" } | { status: "working" } | { status: "done"; message: string } | { status: "error"; message: string };

const PRIVACY_NOTE = "Share cards never include your birth date, time, place, name or chart.";

const noopSubscribe = () => () => {};

/** Makes sure the brand fonts (especially Devanagari) are loaded before drawing on canvas. */
async function loadCardFonts(fonts: CardFonts, card: ShareCardModel): Promise<void> {
  try {
    const sample = [card.primary?.devanagari, ...card.alternatives.map((a) => a.devanagari)].filter(Boolean).join("");
    await Promise.all([
      document.fonts?.load(`220px ${fonts.devanagari}`, sample || "अ"),
      document.fonts?.load(`600 84px ${fonts.display}`, card.primary?.roman ?? "SoulLetter"),
      document.fonts?.load(`italic 400 38px ${fonts.display}`, card.primary?.iast ?? "SoulLetter"),
      document.fonts?.load(`400 30px ${fonts.sans}`, "SoulLetter"),
      document.fonts?.load(`600 28px ${fonts.sans}`, "SoulLetter"),
    ]);
  } catch {
    // Fall back to whatever fonts are available.
  }
}

async function cardPng(card: ShareCardModel): Promise<Blob> {
  const fonts = fontsFromDocument();
  await loadCardFonts(fonts, card);
  return renderShareCardPng(card, fonts);
}

export function SharePanel({ result }: { result: ReadingResult }) {
  const partnerRequest = shareRequestFor(result, "partner");
  const nativeRequest = shareRequestFor(result, "native");
  const [chosen, setChosen] = useState<CardKind>(partnerRequest ? "partner" : "native");
  const kind: CardKind = chosen === "partner" ? (partnerRequest ? "partner" : "native") : nativeRequest ? "native" : "partner";
  const request = kind === "partner" ? partnerRequest : nativeRequest;
  const built = request ? buildShareCard(request) : null;
  const card = built?.ok ? built.card : null;

  const [link, setLink] = useState<LinkState>({ status: "idle" });
  const [copy, setCopy] = useState<ActionState>({ status: "idle" });
  const [fallbackText, setFallbackText] = useState<string | null>(null);
  const [image, setImage] = useState<ActionState>({ status: "idle" });
  const [share, setShare] = useState<ActionState>({ status: "idle" });
  const [linkCopy, setLinkCopy] = useState<string>("");
  const fallbackRef = useRef<HTMLTextAreaElement>(null);

  const canNativeShare = useSyncExternalStore(
    noopSubscribe,
    () => typeof navigator !== "undefined" && typeof navigator.share === "function",
    () => false,
  );

  useEffect(() => {
    if (fallbackText !== null) {
      fallbackRef.current?.focus();
      fallbackRef.current?.select();
    }
  }, [fallbackText]);

  function selectKind(next: CardKind) {
    setChosen(next);
    setLink({ status: "idle" });
    setCopy({ status: "idle" });
    setFallbackText(null);
    setImage({ status: "idle" });
    setShare({ status: "idle" });
    setLinkCopy("");
  }

  if (!card) {
    return (
      <section aria-labelledby="share-heading" className="flex flex-col gap-4">
        <h2 id="share-heading" className="font-display text-3xl text-ivory-50">
          Share
        </h2>
        <p className="text-[0.9375rem] text-mist-300">
          {built && !built.ok
            ? `A share card could not be built: ${built.message}`
            : "There is no single syllable to share from this reading. Possibilities that depend on birth time are not turned into a share card."}
        </p>
      </section>
    );
  }

  const linkUrl = link.status === "created" ? link.url : undefined;

  async function handleCopy() {
    if (!card) return;
    const text = shareCardText(card, linkUrl);
    try {
      await navigator.clipboard.writeText(text);
      setFallbackText(null);
      setCopy({ status: "done", message: "Copied to the clipboard." });
    } catch {
      setFallbackText(text);
      setCopy({ status: "error", message: "Copying isn't available here. The text is selected below — copy it manually." });
    }
  }

  async function handleDownload() {
    if (!card) return;
    setImage({ status: "working" });
    try {
      const blob = await cardPng(card);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "soulletter-card.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setImage({ status: "done", message: "Image saved as soulletter-card.png." });
    } catch {
      setImage({
        status: "error",
        message: "We couldn't create the image in this browser. You can still copy the result as text.",
      });
    }
  }

  async function handleShare() {
    if (!card) return;
    const text = shareCardText(card, linkUrl);
    setShare({ status: "working" });
    try {
      let file: File | null = null;
      try {
        const blob = await cardPng(card);
        const candidate = new File([blob], "soulletter-card.png", { type: "image/png" });
        if (typeof navigator.canShare === "function" && navigator.canShare({ files: [candidate] })) file = candidate;
      } catch {
        file = null;
      }
      if (file) await navigator.share({ files: [file], title: "SoulLetter", text });
      else await navigator.share({ title: "SoulLetter", text, ...(linkUrl ? { url: linkUrl } : {}) });
      setShare({ status: "idle" });
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") setShare({ status: "idle" });
      else setShare({ status: "error", message: "Sharing didn't work here. Try copying the result instead." });
    }
  }

  async function handleCreateLink() {
    if (!request) return;
    setLink({ status: "creating" });
    setLinkCopy("");
    try {
      const created = await createShareLink(request);
      const url = new URL(created.path, window.location.origin).toString();
      setLink({ status: "created", url, expiresAt: created.expiresAt });
    } catch (e) {
      if (e instanceof ApiClientError) {
        const message =
          e.error.code === "SHARE_DISABLED"
            ? "Share links aren't enabled on this server. You can still copy the result or download the image."
            : e.error.code === "RATE_LIMITED"
              ? `Too many share links in a short time.${e.error.retryAfterSeconds ? ` Please wait about ${e.error.retryAfterSeconds} seconds.` : ""}`
              : e.error.message;
        setLink({ status: "error", message });
      } else {
        setLink({ status: "error", message: "The share link could not be created. Please try again." });
      }
    }
  }

  async function handleCopyLink() {
    if (link.status !== "created") return;
    try {
      await navigator.clipboard.writeText(link.url);
      setLinkCopy("Link copied.");
    } catch {
      setLinkCopy("Copying isn't available here — select the link and copy it manually.");
    }
  }

  const statusMessages = [copy, image, share]
    .map((s) => (s.status === "done" || s.status === "error" ? s.message : ""))
    .filter(Boolean)
    .join(" ");

  return (
    <section aria-labelledby="share-heading" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <ShareIcon aria-hidden="true" className="size-6 text-gold-300" />
          <h2 id="share-heading" className="font-display text-3xl text-ivory-50">
            Share
          </h2>
        </div>
        <p className="flex items-start gap-2 text-[0.9375rem] text-ivory-100">
          <LockIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-gold-300" />
          {PRIVACY_NOTE}
        </p>
      </div>

      {partnerRequest && nativeRequest ? (
        <RadioGroup legend="Which card would you like to share?" layout="grid">
          <RadioCard
            id="share-kind-partner"
            name="shareKind"
            value="partner"
            label="Symbolic partner syllables"
            description="Experimental symbolic interpretation."
            checked={kind === "partner"}
            onChange={() => selectKind("partner")}
          />
          <RadioCard
            id="share-kind-native"
            name="shareKind"
            value="native"
            label="My naming syllable"
            description="The traditional syllable for your birth Nakshatra Pada."
            checked={kind === "native"}
            onChange={() => selectKind("native")}
          />
        </RadioGroup>
      ) : null}

      <ShareCardPreview card={card} headingId="share-card-headline" className="mx-auto w-full max-w-md" />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button variant="secondary" onClick={handleCopy} data-testid="share-copy">
          Copy result
        </Button>
        <Button
          variant="secondary"
          onClick={handleDownload}
          loading={image.status === "working"}
          loadingText="Preparing image…"
          data-testid="share-download"
        >
          Download image
        </Button>
        {canNativeShare ? (
          <Button
            variant="secondary"
            onClick={handleShare}
            loading={share.status === "working"}
            loadingText="Opening share…"
            data-testid="share-native"
          >
            Share
          </Button>
        ) : null}
        <Button
          variant="secondary"
          onClick={handleCreateLink}
          loading={link.status === "creating"}
          loadingText="Creating link…"
          data-testid="share-link-create"
        >
          Create share link
        </Button>
      </div>

      <p role="status" aria-live="polite" className="min-h-5 text-sm text-mist-300">
        {statusMessages}
      </p>

      {fallbackText !== null ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="share-fallback-text" className="text-sm font-medium text-ivory-50">
            Result text
          </label>
          <Textarea
            ref={fallbackRef}
            id="share-fallback-text"
            readOnly
            rows={8}
            value={fallbackText}
            onFocus={(e) => e.currentTarget.select()}
          />
        </div>
      ) : null}

      {link.status === "created" ? (
        <div className="flex flex-col gap-2 rounded-card border border-line bg-night-800/50 p-4">
          <label htmlFor="share-link-url" className="text-sm font-medium text-ivory-50">
            Your share link
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="share-link-url"
              readOnly
              value={link.url}
              data-testid="share-link-url"
              onFocus={(e) => e.currentTarget.select()}
              className="font-mono text-sm"
              aria-describedby="share-link-expiry"
            />
            <Button variant="secondary" onClick={handleCopyLink} className="shrink-0">
              Copy link
            </Button>
          </div>
          <p id="share-link-expiry" className="text-sm text-mist-300">
            Expires {expiryLabel(link.expiresAt)}. The link shows only the card above.
          </p>
          <p role="status" aria-live="polite" className="min-h-5 text-sm text-mist-300">
            {linkCopy}
          </p>
        </div>
      ) : null}
      {link.status === "error" ? (
        <Callout tone="info" title="Share link not created">
          {link.message}
        </Callout>
      ) : null}
    </section>
  );
}
