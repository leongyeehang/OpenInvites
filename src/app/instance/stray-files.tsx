"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";
import { AlertDialog, AlertDialogCancel, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DeleteDialogContent } from "@/components/delete-dialog-content";
import { findStrayFilesAction, removeStrayFilesAction, type StrayFilesState } from "@/instance/actions";
import { formatSize } from "@/lib/sizes";

const HEADING = "strays-heading";

// The stray-file check on the Storage card (M7 ticket 10; plan ruling 10): pressed, it lists the
// files in storage that no photo, video or picture names, older than an hour, with the total; a
// destructive Remove confirms before anything goes, and the list then says what went.
export function StrayFiles() {
  const t = useTranslations("Instance.storage");
  const locale = useLocale();
  const [state, act, pending] = useActionState(
    async (previous: StrayFilesState, formData: FormData) => (formData.get("intent") === "remove" ? removeStrayFilesAction(previous, formData) : findStrayFilesAction()),
    undefined,
  );
  return (
    <section aria-labelledby={HEADING} className="flex flex-col gap-3">
      <h3 id={HEADING} tabIndex={-1} className="font-medium outline-none">
        {t("straysTitle")}
      </h3>
      <form action={act} className="flex flex-col gap-2">
        <input type="hidden" name="intent" value="check" />
        <Button type="submit" variant="outline" disabled={pending} className="self-start" aria-describedby="strays-hint">
          {t("checkStrays")}
        </Button>
        <p id="strays-hint" className="text-sm text-muted-foreground">
          {t("checkStraysHint")}
        </p>
      </form>
      {state && (
        <div role="status" className="flex flex-col gap-2 text-sm">
          {state.removed !== undefined && <p>{t("straysRemoved", { count: state.removed })}</p>}
          {state.files.length === 0 && state.removed === undefined && <p>{t("straysNone")}</p>}
          {state.files.length > 0 && (
            <>
              <p>{t("straysFound", { count: state.files.length, size: formatSize(state.total, locale) })}</p>
              <ul className="flex flex-col gap-1 font-mono text-xs break-all">
                {state.files.map((file) => (
                  <li key={file.key}>
                    {file.key} · {formatSize(file.size, locale)}
                  </li>
                ))}
              </ul>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="self-start">
                    {t("removeStrays", { count: state.files.length, size: formatSize(state.total, locale) })}
                  </Button>
                </AlertDialogTrigger>
                <DeleteDialogContent focusAfter={HEADING}>
                  <form action={act}>
                    <input type="hidden" name="intent" value="remove" />
                    <input type="hidden" name="keys" value={JSON.stringify(state.files.map((file) => file.key))} />
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("removeStraysTitle", { count: state.files.length, size: formatSize(state.total, locale) })}</AlertDialogTitle>
                      <AlertDialogDescription>{t("removeStraysText")}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="pt-4">
                      <AlertDialogCancel type="button">{t("neverMind")}</AlertDialogCancel>
                      <Button type="submit" variant="destructive" disabled={pending}>
                        {t("removeStraysConfirm")}
                      </Button>
                    </AlertDialogFooter>
                  </form>
                </DeleteDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      )}
    </section>
  );
}
