"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { postCommentAction, type CommentState } from "@/comments/actions";
import { MAX_BODY } from "@/comments/comment";

// The form under the comments: what the guest, or the host, has to say, and "Post". The text is the
// form's own state, so a refusal leaves it as it was, with the reason under it; once the comment is
// posted the page is drawn again with it, and the box starts empty.
export function CommentForm({ slug }: { slug: string }) {
  const t = useTranslations("EventPage.comments");
  const [body, setBody] = useState("");
  const [state, send, sending] = useActionState(async (previous: CommentState, formData: FormData) => {
    const outcome = await postCommentAction(slug, previous, formData);
    if (outcome?.posted) setBody("");
    return outcome;
  }, undefined);

  return (
    <form action={send} className="flex flex-col gap-3">
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium tracking-wider text-theme-text-faint uppercase">{t("label")}</span>
        <textarea
          name="body"
          rows={3}
          maxLength={MAX_BODY}
          required
          value={body}
          onChange={(typed) => setBody(typed.target.value)}
          className="block w-full rounded-xl border border-theme-glass-border bg-theme-glass-strong px-4 py-3 text-base text-theme-text"
        />
      </label>
      {state?.error && (
        <p role="alert" className="text-sm font-medium">
          {t(`errors.${state.error}`)}
        </p>
      )}
      <button
        type="submit"
        disabled={sending}
        className="h-11 cursor-pointer self-end rounded-2xl bg-theme-accent px-6 text-base font-medium text-theme-on-accent transition-opacity hover:opacity-90 disabled:cursor-default disabled:opacity-50 motion-reduce:transition-none"
      >
        {t("post")}
      </button>
    </form>
  );
}
