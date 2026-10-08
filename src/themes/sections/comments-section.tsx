import { Lock } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { deleteCommentAction } from "@/comments/actions";
import type { CommentsShown } from "@/comments/visibility";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { formatMoment } from "@/events/time";

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
          {comments.comments.map((each) => (
            <li key={each.id}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="font-medium">{each.name}</p>
                {each.byHost && <span className="rounded-full bg-theme-accent px-2 py-0.5 text-xs font-medium text-theme-on-accent">{t("comments.host")}</span>}
                <p className="text-sm text-theme-text-faint">
                  <time dateTime={each.createdAt.toISOString()}>{formatMoment(each.createdAt, timeZone, locale)}</time>
                </p>
                {/* Taking one down cannot be undone, so it is confirmed. */}
                {each.deletable && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button type="button" className="ml-auto cursor-pointer text-sm text-theme-text-muted underline underline-offset-2 hover:opacity-80">
                        {t("comments.delete")}
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <form action={deleteCommentAction.bind(null, slug, each.id)}>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t("comments.deleteTitle")}</AlertDialogTitle>
                          <AlertDialogDescription>{t("comments.deleteText")}</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="pt-4">
                          <AlertDialogCancel type="button">{t("comments.keep")}</AlertDialogCancel>
                          <Button type="submit" variant="destructive">
                            {t("comments.deleteConfirm")}
                          </Button>
                        </AlertDialogFooter>
                      </form>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
              <p className="mt-1 leading-relaxed break-words whitespace-pre-wrap">{each.body}</p>
            </li>
          ))}
        </ol>
      )}
      {comments.canPost && form}
    </div>
  );
}
