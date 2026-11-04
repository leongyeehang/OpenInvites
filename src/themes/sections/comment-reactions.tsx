"use client";

import { SmilePlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Popover } from "radix-ui";
import { useOptimistic, useRef, useState, useTransition } from "react";
import { REACTION_NAMES, REACTIONS, type Reaction, type ReactionGroup } from "@/comments/reactions";
import { cn } from "@/lib/utils";

const CHIP =
  "inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-theme-text";

// What one press does to the reactions shown, before the page comes back drawn again with them:
// the viewer's emoji taken back, or given. The names follow with the page.
function pressed(groups: ReactionGroup[], emoji: Reaction): ReactionGroup[] {
  const found = groups.find((group) => group.emoji === emoji);
  if (found?.mine) {
    return groups.flatMap((group) => (group.emoji !== emoji ? [group] : group.count > 1 ? [{ ...group, count: group.count - 1, mine: false }] : []));
  }
  if (found) return groups.map((group) => (group.emoji === emoji ? { ...group, count: group.count + 1, mine: true } : group));
  return REACTIONS.flatMap((each) => {
    if (each === emoji) return [{ emoji, count: 1, names: [], mine: true }];
    const group = groups.find((other) => other.emoji === each);
    return group ? [group] : [];
  });
}

// The reactions under a comment (M4 ticket 04): each emoji someone gave, with how many, the names
// in its tooltip and under "Who reacted"; for a viewer who may react, each a button that gives or
// takes back theirs, and a button opening the six. `react` is the action bound to this comment.
export function CommentReactions({
  reactions,
  canReact,
  react,
}: {
  reactions: ReactionGroup[];
  canReact: boolean;
  react: (emoji: Reaction) => Promise<{ error?: "tooFast" | "closed" }>;
}) {
  const t = useTranslations("EventPage.comments");
  const [shown, press] = useOptimistic(reactions, pressed);
  const [, startTransition] = useTransition();
  const [refused, setRefused] = useState<"tooFast" | "closed">();
  const [picking, setPicking] = useState(false);
  const add = useRef<HTMLButtonElement>(null);

  if (!canReact && reactions.length === 0) return null;

  const name = (emoji: Reaction) => t(`reactions.names.${REACTION_NAMES[emoji]}`);
  const label = (group: ReactionGroup) => t(group.mine ? "reactions.labelMine" : "reactions.label", { name: name(group.emoji), count: group.count });
  const toggle = (emoji: Reaction) => {
    // The viewer's last of an emoji taken back takes its button with it: the focus goes to Add.
    const going = shown.find((group) => group.emoji === emoji && group.mine && group.count === 1);
    if (going && document.activeElement?.closest("[data-reaction]")) add.current?.focus();
    startTransition(async () => {
      setRefused(undefined);
      press(emoji);
      const { error } = await react(emoji);
      if (error) setRefused(error);
    });
  };

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {shown.map((group) =>
          canReact ? (
            <button
              key={group.emoji}
              type="button"
              data-reaction
              aria-pressed={group.mine}
              aria-label={label(group)}
              title={group.names.join(", ") || undefined}
              onClick={() => toggle(group.emoji)}
              className={cn(
                CHIP,
                "cursor-pointer",
                group.mine ? "border-theme-accent bg-theme-accent/20 font-medium" : "border-theme-glass-border bg-theme-glass hover:bg-theme-glass-strong",
              )}
            >
              <span aria-hidden>{group.emoji}</span>
              <span aria-hidden>{group.count}</span>
            </button>
          ) : (
            <span key={group.emoji} role="img" aria-label={label(group)} title={group.names.join(", ") || undefined} className={cn(CHIP, "border-theme-glass-border bg-theme-glass")}>
              <span aria-hidden>{group.emoji}</span>
              <span aria-hidden>{group.count}</span>
            </span>
          ),
        )}

        {canReact && (
          <Popover.Root open={picking} onOpenChange={setPicking}>
            <Popover.Trigger
              ref={add}
              aria-label={t("reactions.add")}
              className={cn(CHIP, "cursor-pointer border-theme-glass-border bg-theme-glass px-2 text-theme-text-muted hover:bg-theme-glass-strong hover:text-theme-text")}
            >
              <SmilePlus className="size-4" aria-hidden />
            </Popover.Trigger>
            {/* Not portalled: the page's theme is set on its own element, and the six sit on it. */}
            <Popover.Content
              side="top"
              align="start"
              sideOffset={6}
              aria-label={t("reactions.menu")}
              className="z-40 rounded-full border border-theme-glass-border bg-theme-glass-strong p-1 shadow-lg backdrop-blur-xl motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in motion-safe:data-[state=open]:zoom-in-95"
            >
              <div role="group" aria-label={t("reactions.menu")} className="flex gap-0.5">
                {REACTIONS.map((emoji) => {
                  const mine = shown.some((group) => group.emoji === emoji && group.mine);
                  return (
                    <button
                      key={emoji}
                      type="button"
                      aria-pressed={mine}
                      aria-label={name(emoji)}
                      onClick={() => {
                        setPicking(false);
                        toggle(emoji);
                      }}
                      className={cn(
                        "grid size-10 cursor-pointer place-items-center rounded-full text-xl hover:bg-theme-glass focus-visible:outline-2 focus-visible:outline-theme-text motion-safe:transition-transform motion-safe:hover:scale-110",
                        mine && "bg-theme-accent/25",
                      )}
                    >
                      <span aria-hidden>{emoji}</span>
                    </button>
                  );
                })}
              </div>
            </Popover.Content>
          </Popover.Root>
        )}

        {shown.length > 0 && (
          <Popover.Root>
            <Popover.Trigger className="cursor-pointer px-1 text-xs text-theme-text-muted underline underline-offset-2 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-theme-text">
              {t("reactions.who")}
            </Popover.Trigger>
            <Popover.Content
              side="top"
              align="start"
              sideOffset={6}
              aria-label={t("reactions.whoTitle")}
              className="z-40 max-w-72 rounded-2xl border border-theme-glass-border bg-theme-glass-strong p-3 text-sm shadow-lg backdrop-blur-xl"
            >
              <ul className="flex flex-col gap-1.5">
                {shown.map((group) => (
                  <li key={group.emoji} className="flex gap-2">
                    <span aria-hidden>{group.emoji}</span>
                    <span className="sr-only">{name(group.emoji)}:</span>
                    <span>{group.names.join(", ")}</span>
                  </li>
                ))}
              </ul>
            </Popover.Content>
          </Popover.Root>
        )}
      </div>
      {refused && (
        <p role="alert" className="mt-1 text-sm font-medium">
          {refused === "tooFast" ? t("errors.tooFast") : t("reactions.closed")}
        </p>
      )}
    </div>
  );
}
