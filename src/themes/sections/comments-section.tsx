import { Lock } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { deleteCommentAction, toggleReactionAction } from "@/comments/actions";
import { mayDelete } from "@/comments/comment";
import { reactionsByComment, type Reactor } from "@/comments/reactions";
import { countComments, listComments, listReactions } from "@/comments/repository";
import { commentsView, takesComments, type CommentsShown, type CommentViewer } from "@/comments/visibility";
import { DeleteDialogContent } from "@/components/delete-dialog-content";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { EventWithHost } from "@/events/repository";
import { formatMoment } from "@/events/time";
import { cn } from "@/lib/utils";
import type { SectionDrawing } from "@/sections";
import { CommentReactions } from "./comment-reactions";
import { DeleteCommentForm } from "./delete-comment-form";
import type { SectionPage } from "./drawings";

// The id of the comments' heading, which every layout gives it: where the focus goes once a
// comment is deleted, since its Delete button goes with it.
export const COMMENTS_HEADING = "comments-heading";

// The comments as every layout shows them (comments/visibility.ts decides what this viewer may
// see): to a guest who has not replied, only how many there are, as to a guest whose reply the
// host has not approved, who is told why; to everyone else the comments, shown as written, with
// their line breaks and spaces, and dated as everything on the page is, each with its reactions,
// then `form`, the box that posts one, where they may. The layout frames it and gives it its heading.
export async function CommentsSection({
  comments,
  form,
  slug,
  timeZone,
  style,
}: {
  comments: CommentsShown;
  form?: ReactNode;
  // The event's link, which the delete action is bound to, and its zone, which dates each comment.
  slug: string;
  timeZone: string;
  // As a list, as they always were, or as chat bubbles (M8 ticket 30).
  style: "list" | "bubbles";
}) {
  const [t, locale] = await Promise.all([getTranslations("EventPage"), getLocale()]);

  if (comments.view === "locked") {
    return (
      <>
        <p className="text-lg font-medium">{t("comments.count", { count: comments.count })}</p>
        <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-theme-text-faint">
          <Lock className="size-3.5" aria-hidden />{" "}
          {comments.approval === "pending"
            ? t("comments.lockedPending")
            : comments.approval === "declined"
              ? t("comments.lockedDeclined")
              : t("comments.locked")}
        </p>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {comments.comments.length === 0 ? (
        <p className="text-sm text-theme-text-muted">{t("comments.count", { count: 0 })}</p>
      ) : (
        <ol data-style={style} className="flex flex-col gap-4">
          {comments.comments.map((each) => {
            const when = formatMoment(each.createdAt, timeZone, locale);
            const name = <p className="font-medium">{each.name}</p>;
            const host = each.byHost && <span className="rounded-full bg-theme-accent px-2 py-0.5 text-xs font-medium text-theme-on-accent">{t("comments.host")}</span>;
            const time = (
              <p className="text-sm text-theme-text-faint">
                <time dateTime={each.createdAt.toISOString()}>{when}</time>
              </p>
            );
            // Taking one down cannot be undone, so it is confirmed. Its button says whose and when,
            // as every comment has one.
            const remove = (className: string) =>
              each.deletable && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      type="button"
                      aria-label={t("comments.deleteLabel", { name: each.name, time: when })}
                      className={cn("cursor-pointer text-sm text-theme-text-muted underline underline-offset-2 hover:opacity-80", className)}
                    >
                      {t("comments.delete")}
                    </button>
                  </AlertDialogTrigger>
                  <DeleteDialogContent focusAfter={COMMENTS_HEADING}>
                    <DeleteCommentForm
                      action={deleteCommentAction.bind(null, slug, each.id)}
                      tooFast={t("comments.errors.tooFast")}
                      footer={
                        <AlertDialogFooter className="pt-4">
                          <AlertDialogCancel type="button">{t("comments.keep")}</AlertDialogCancel>
                          <Button type="submit" variant="destructive">
                            {t("comments.deleteConfirm")}
                          </Button>
                        </AlertDialogFooter>
                      }
                    >
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t("comments.deleteTitle")}</AlertDialogTitle>
                        <AlertDialogDescription>{t("comments.deleteText")}</AlertDialogDescription>
                      </AlertDialogHeader>
                    </DeleteCommentForm>
                  </DeleteDialogContent>
                </AlertDialog>
              );
            const reactions = <CommentReactions reactions={each.reactions} canReact={comments.canReact} react={toggleReactionAction.bind(null, slug, each.id)} />;
            // Bubbles (M8 ticket 30): a host's on the right in the accent, a guest's on the left on
            // the strong glass, the name and time above, the reactions and Delete below.
            if (style === "bubbles") {
              return (
                <li key={each.id} className={cn("flex flex-col", each.byHost ? "items-end" : "items-start")}>
                  <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 px-1", each.byHost && "justify-end")}>
                    {name}
                    {host}
                    {time}
                  </div>
                  <p
                    data-slot="comment-bubble"
                    className={cn(
                      "mt-1 max-w-[85%] rounded-3xl px-4 py-2.5 leading-relaxed break-words whitespace-pre-wrap",
                      each.byHost ? "rounded-br-md bg-theme-accent text-theme-on-accent" : "rounded-bl-md bg-theme-glass-strong",
                    )}
                  >
                    {each.body}
                  </p>
                  <div className={cn("flex flex-wrap items-start gap-x-3 px-1", each.byHost && "flex-row-reverse")}>
                    {reactions}
                    {remove("mt-2.5")}
                  </div>
                </li>
              );
            }
            return (
              <li key={each.id}>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  {name}
                  {host}
                  {time}
                  {remove("ml-auto")}
                </div>
                <p className="mt-1 leading-relaxed break-words whitespace-pre-wrap">{each.body}</p>
                {reactions}
              </li>
            );
          })}
        </ol>
      )}
      {comments.canPost && form}
    </div>
  );
}

// What the comments section shows this viewer, or nothing when the host has turned comments off:
// to the hosts and to a guest whose reply the host has approved, the comments themselves; to anyone
// else only how many there are, so not one of them is sent to that browser, and to a guest whose
// reply is not approved, why.
// Each comment carries its reactions, and whether this viewer gave each: `reactor` is who they react
// as, if they may (M4 ticket 04). Whoever may post may react.
export async function commentsFor(event: EventWithHost, viewer: CommentViewer, reactor: Reactor | undefined): Promise<CommentsShown | undefined> {
  if (!event.commentsEnabled) return undefined;
  if (commentsView(viewer) === "locked") {
    return { view: "locked", count: await countComments(event.id), approval: viewer.kind === "guest" ? viewer.approval : undefined };
  }
  const [comments, reactions] = await Promise.all([listComments(event.id), listReactions(event.id)]);
  const grouped = reactionsByComment(reactions, reactor);
  const canPost = takesComments(event, viewer);
  return {
    view: "open",
    canPost,
    canReact: canPost,
    comments: comments.map(({ id, name, hostId, body, createdAt, rsvpId }) => ({
      reactions: grouped.get(id) ?? [],
      id,
      name,
      byHost: hostId !== null,
      body,
      createdAt,
      deletable: mayDelete(viewer, { rsvpId }),
    })),
  };
}

// The comments as a section (M8 ticket 25), with the box that posts one and what the delete action
// and the dates need: the event's link and zone. The count beside a collapsed heading is how many
// there are, which a viewer they are locked to is told anyway. They are drawn in the host's style,
// the same in every layout (ticket 30).
type CommentsData = { comments: CommentsShown; form: ReactNode; slug: string; timeZone: string };

export const commentsDrawing: SectionDrawing<CommentsData, SectionPage> = {
  load: async ({ event, commentViewer, reactor, commentForm }) => {
    const comments = await commentsFor(event, commentViewer, reactor);
    return comments && { comments, form: commentForm, slug: event.slug, timeZone: event.timeZone };
  },
  shown: ({ comments }) => ({ count: comments.view === "open" ? comments.comments.length : comments.count, locked: comments.view === "locked" }),
  headingId: COMMENTS_HEADING,
  body: (data, _layout, placed) => <CommentsSection {...data} style={placed.section.kind === "comments" ? placed.section.style : "list"} />,
};
