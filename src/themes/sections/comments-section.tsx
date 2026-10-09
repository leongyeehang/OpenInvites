import { Lock } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { deleteCommentAction } from "@/comments/actions";
import type { CommentsShown } from "@/comments/visibility";
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
import { formatMoment } from "@/events/time";
import { DeleteCommentForm } from "./delete-comment-form";

// The id of the comments' heading, which every layout gives it: where the focus goes once a
// comment is deleted, since its Delete button goes with it.
export const COMMENTS_HEADING = "comments-heading";

// The comments as every layout shows them (comments/visibility.ts decides what this viewer may
// see): to a guest who has not replied, only how many there are; to everyone else the comments,
// shown as written, with their line breaks and spaces, and dated as everything on the page is,
// then `form`, the box that posts one, where they may. The layout frames it and gives it its
// heading.
export async function CommentsSection({
  comments,
  form,
  slug,
  timeZone,
}: {
  comments: CommentsShown;
  form?: ReactNode;
  // The event's link, which the delete action is bound to, and its zone, which dates each comment.
  slug: string;
  timeZone: string;
}) {
  const [t, locale] = await Promise.all([getTranslations("EventPage"), getLocale()]);

  if (comments.view === "locked") {
    return (
      <>
        <p className="text-lg font-medium">{t("comments.count", { count: comments.count })}</p>
        <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-theme-text-faint">
          <Lock className="size-3.5" aria-hidden /> {t("comments.locked")}
        </p>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {comments.comments.length === 0 ? (
        <p className="text-sm text-theme-text-muted">{t("comments.count", { count: 0 })}</p>
      ) : (
        <ol className="flex flex-col gap-4">
          {comments.comments.map((each) => {
            const when = formatMoment(each.createdAt, timeZone, locale);
            return (
              <li key={each.id}>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="font-medium">{each.name}</p>
                  {each.byHost && <span className="rounded-full bg-theme-accent px-2 py-0.5 text-xs font-medium text-theme-on-accent">{t("comments.host")}</span>}
                  <p className="text-sm text-theme-text-faint">
                    <time dateTime={each.createdAt.toISOString()}>{when}</time>
                  </p>
                  {/* Taking one down cannot be undone, so it is confirmed. Its button says whose and
                      when, as every comment has one. */}
                  {each.deletable && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          type="button"
                          aria-label={t("comments.deleteLabel", { name: each.name, time: when })}
                          className="ml-auto cursor-pointer text-sm text-theme-text-muted underline underline-offset-2 hover:opacity-80"
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
                  )}
                </div>
                <p className="mt-1 leading-relaxed break-words whitespace-pre-wrap">{each.body}</p>
              </li>
            );
          })}
        </ol>
      )}
      {comments.canPost && form}
    </div>
  );
}
