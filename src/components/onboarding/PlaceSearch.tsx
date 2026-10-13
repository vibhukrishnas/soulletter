"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Button, Callout, FieldError, FieldHint, Input, Label, MapPinIcon, Spinner, cn, joinIds } from "@/components/ui";
import { ApiClientError, searchPlaces, type PlaceResult } from "@/lib/client/api";
import { GEOCODE_ATTRIBUTION, MIN_GEOCODE_QUERY_LENGTH } from "@/server/geocode/types";
import { FIELD_IDS } from "./field-ids";

const DEBOUNCE_MS = 300;

type SearchStatus =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; count: number }
  | { kind: "unavailable"; message: string }
  | { kind: "error"; message: string };

export interface PlaceSearchProps {
  error?: string;
  onSelect: (place: PlaceResult) => void;
  /** Switches the birthplace mode to manual coordinates. */
  onUseManualEntry: () => void;
}

/**
 * Birthplace autocomplete (WAI-ARIA 1.2 combobox with a listbox popup).
 * Keyboard: ↓/↑ move through suggestions, Enter selects, Escape closes (or clears).
 * The search text is only sent to SoulLetter's own geocoding endpoint, never stored.
 */
export function PlaceSearch({ error, onSelect, onUseManualEntry }: PlaceSearchProps) {
  const uid = useId();
  const inputId = FIELD_IDS.placeSearch;
  const listId = `${inputId}-listbox-${uid}`;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const statusId = `${inputId}-status`;

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [status, setStatus] = useState<SearchStatus>({ kind: "idle" });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controller = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      controller.current?.abort();
    },
    [],
  );

  function cancelPending() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    controller.current?.abort();
    controller.current = null;
  }

  function runSearch(text: string) {
    const ac = new AbortController();
    controller.current = ac;
    setStatus({ kind: "loading" });
    searchPlaces(text, ac.signal)
      .then(({ results: found }) => {
        if (ac.signal.aborted) return;
        setResults(found);
        setActive(-1);
        setOpen(found.length > 0);
        setStatus({ kind: "done", count: found.length });
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted || (e instanceof Error && e.name === "AbortError")) return;
        setResults([]);
        setOpen(false);
        if (e instanceof ApiClientError) {
          const code = e.error.code;
          if (code === "GEOCODING_DISABLED" || code === "GEOCODING_FAILED") {
            setStatus({ kind: "unavailable", message: e.error.message });
          } else if (code === "RATE_LIMITED") {
            const wait = e.error.retryAfterSeconds;
            setStatus({
              kind: "error",
              message: `Too many searches in a short time.${wait ? ` Please wait about ${wait} seconds.` : ""}`,
            });
          } else if (code === "VALIDATION_ERROR") {
            setStatus({ kind: "error", message: e.error.message });
          } else {
            setStatus({ kind: "unavailable", message: e.error.message });
          }
        } else {
          setStatus({ kind: "unavailable", message: "Place search is temporarily unavailable." });
        }
      });
  }

  function handleChange(text: string) {
    setQuery(text);
    cancelPending();
    if (text.trim().length < MIN_GEOCODE_QUERY_LENGTH) {
      setResults([]);
      setOpen(false);
      setActive(-1);
      setStatus({ kind: "idle" });
      return;
    }
    timer.current = setTimeout(() => runSearch(text.trim()), DEBOUNCE_MS);
  }

  function select(place: PlaceResult) {
    cancelPending();
    setOpen(false);
    setActive(-1);
    setResults([]);
    setQuery("");
    setStatus({ kind: "idle" });
    onSelect(place);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case "ArrowDown": {
        if (results.length === 0) return;
        e.preventDefault();
        if (!open) {
          setOpen(true);
          setActive(0);
        } else {
          setActive((i) => (i + 1) % results.length);
        }
        break;
      }
      case "ArrowUp": {
        if (results.length === 0) return;
        e.preventDefault();
        if (!open) {
          setOpen(true);
          setActive(results.length - 1);
        } else {
          setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
        }
        break;
      }
      case "Enter": {
        if (open && active >= 0 && results[active]) {
          e.preventDefault();
          select(results[active]);
        } else if (open || query) {
          // Do not submit the step while the user is still searching.
          e.preventDefault();
        }
        break;
      }
      case "Escape": {
        if (open) {
          e.preventDefault();
          setOpen(false);
          setActive(-1);
        } else if (query) {
          e.preventDefault();
          handleChange("");
        }
        break;
      }
      case "Tab":
        setOpen(false);
        break;
    }
  }

  const optionId = (i: number) => `${listId}-option-${i}`;
  const statusText =
    status.kind === "loading"
      ? "Searching…"
      : status.kind === "done"
        ? status.count === 0
          ? "No places found. Try another spelling, or enter coordinates manually."
          : `${status.count} ${status.count === 1 ? "place" : "places"} found. Use the up and down arrow keys to choose.`
        : "";

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={inputId} required>
        Search for your birthplace
      </Label>
      <FieldHint id={hintId}>
        Type at least {MIN_GEOCODE_QUERY_LENGTH} letters of a town or city, then pick a result. You can adjust the
        details afterwards.
      </FieldHint>
      <div className="relative">
        <Input
          id={inputId}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
          aria-describedby={joinIds(error ? errorId : null, hintId, statusId)}
          aria-required
          invalid={Boolean(error)}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="e.g. Varanasi"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => setOpen(false)}
          className="pr-11"
        />
        <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-gold-300">
          {status.kind === "loading" ? <Spinner size="sm" /> : <MapPinIcon aria-hidden="true" className="size-5" />}
        </span>
        <ul
          id={listId}
          role="listbox"
          aria-label="Place suggestions"
          hidden={!open || results.length === 0}
          className="absolute inset-x-0 top-full z-30 mt-1.5 max-h-72 overflow-y-auto rounded-control border border-line-strong bg-night-800 p-1 shadow-raised"
        >
          {results.map((place, i) => (
            <li
              key={place.id}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select(place)}
              onMouseEnter={() => setActive(i)}
              className={cn(
                "flex cursor-pointer flex-col gap-0.5 rounded-[0.6rem] px-3 py-2.5 text-left",
                i === active ? "bg-gold-300/12 text-ivory-50 outline-1 outline-gold-300/50" : "text-ivory-100",
              )}
            >
              <span className="text-[0.9375rem] leading-snug">{place.label}</span>
              <span className="text-sm text-mist-300">Time zone: {place.timeZone}</span>
            </li>
          ))}
        </ul>
      </div>
      <p id={statusId} role="status" aria-live="polite" className="min-h-5 text-sm text-mist-300">
        {statusText}
      </p>
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}

      {status.kind === "unavailable" ? (
        <Callout tone="info" title="Place search isn't available right now">
          <p>{status.message}</p>
          <p className="mt-1">Your details are safe — you can enter the coordinates and time zone yourself instead.</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={onUseManualEntry}>
            Enter coordinates manually
          </Button>
        </Callout>
      ) : null}
      {status.kind === "error" ? <p className="text-sm text-caution-200">{status.message}</p> : null}

      <p className="text-xs text-mist-400">{GEOCODE_ATTRIBUTION}</p>
    </div>
  );
}
