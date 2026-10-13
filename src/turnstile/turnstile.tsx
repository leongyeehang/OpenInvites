"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useEffectEvent, useRef, useState } from "react";

// What Cloudflare's script puts on the page: the part of its API the widget uses.
type TurnstileApi = {
  render(container: HTMLElement, options: Record<string, unknown>): string | undefined;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

// Cloudflare's script, fetched from the one address it may be fetched from, once per page however
// many widgets it has. A page whose script failed may try again with its next widget.
const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<TurnstileApi> | undefined;

function loadTurnstile(): Promise<TurnstileApi> {
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = Object.assign(document.createElement("script"), { src: SCRIPT, async: true });
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile did not start")));
    script.onerror = () => reject(new Error("Turnstile could not be loaded"));
    document.head.append(script);
  }).catch((error: unknown) => {
    loading = undefined;
    throw error;
  });
  return loading;
}

// How long the script may take before the form says it could not load: a request an ad blocker
// holds rather than refuses never fails. Should it arrive after all, the widget appears.
const PATIENCE_MS = 10_000;

// The languages the widget speaks that are the instance's (Cloudflare's codes).
const LANGUAGES: Record<string, string> = { en: "en", "zh-Hans": "zh-cn", "zh-Hant": "zh-tw" };

// Cloudflare Turnstile's widget (spec, "Turnstile"), rendered only when the operator has set its
// keys: managed, in the viewer's language, light or dark as their system is. It stands beside the
// submit of the form it guards and writes its token into a hidden field of that form, `form` when
// it stands outside it (the Thread's composer). The form keeps its submit disabled until
// `onToken` says a token is there, and changes `resets` after each post the token went with: a
// token passes one check, so the widget starts again. When the script cannot load (an ad blocker,
// most often), or has not come in ten seconds, it says so, and the form stays waiting.
export function Turnstile({ siteKey, form, onToken, resets }: { siteKey: string; form?: string; onToken: (present: boolean) => void; resets?: unknown }) {
  const t = useTranslations("Turnstile");
  const locale = useLocale();
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<string | undefined>(undefined);
  // The token, with the post it is for: once that post has gone, it is spent.
  const [token, setToken] = useState({ value: "", resets });
  const [unavailable, setUnavailable] = useState(false);

  const tell = useEffectEvent((present: boolean) => onToken(present));
  const solved = useEffectEvent((value: string) => {
    setToken({ value, resets });
    onToken(true);
  });
  const lost = useEffectEvent(() => {
    setToken({ value: "", resets });
    onToken(false);
  });

  useEffect(() => {
    let gone = false;
    const slow = setTimeout(() => setUnavailable(true), PATIENCE_MS);
    loadTurnstile().then(
      (turnstile) => {
        clearTimeout(slow);
        if (gone || !container.current) return;
        setUnavailable(false);
        widget.current = turnstile.render(container.current, {
          sitekey: siteKey,
          theme: "auto",
          language: LANGUAGES[locale] ?? "auto",
          "response-field": false,
          callback: (value: string) => solved(value),
          "expired-callback": () => lost(),
          "error-callback": () => lost(),
          "timeout-callback": () => lost(),
        });
      },
      () => {
        clearTimeout(slow);
        if (!gone) setUnavailable(true);
      },
    );
    return () => {
      gone = true;
      clearTimeout(slow);
      if (widget.current !== undefined) window.turnstile?.remove(widget.current);
      widget.current = undefined;
      tell(false);
    };
  }, [siteKey, locale]);

  // After a post the token went with, the widget starts again for the next.
  useEffect(() => {
    if (widget.current === undefined) return;
    window.turnstile?.reset(widget.current);
    tell(false);
  }, [resets]);

  return (
    <div className="flex flex-col gap-2">
      <div ref={container} role="group" aria-label={t("label")} />
      <input type="hidden" name="cf-turnstile-response" form={form} value={token.resets === resets ? token.value : ""} />
      {unavailable && (
        <p role="alert" className="text-sm font-medium">
          {t("unavailable")}
        </p>
      )}
    </div>
  );
}
