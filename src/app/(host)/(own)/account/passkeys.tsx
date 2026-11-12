"use client";

import { KeyRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { removePasskeyAction, renamePasskeyAction } from "@/auth/actions";
import { outcomeOf, passkeyAuth, type PasskeyOutcome } from "@/auth/passkey-client";
import { FormOutcome } from "@/components/form-outcome";
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
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

// One passkey as the page lists it, its dates already in words.
export type ListedPasskey = { id: string; name: string | null; created: string | null; lastUsed: string | null };

// The host's passkeys (M4 ticket 08): each with when it was added and last used, Rename and Remove,
// then Add a passkey, which asks the device to make one for this instance.
export function Passkeys({ passkeys }: { passkeys: ListedPasskey[] }) {
  const t = useTranslations("Account.passkeys");
  const router = useRouter();
  const [adding, startAdding] = useTransition();
  const [outcome, setOutcome] = useState<PasskeyOutcome | "removed">();

  const add = () =>
    startAdding(async () => {
      setOutcome(undefined);
      const result = await passkeyAuth.passkey.addPasskey({ name: `${t("unnamed")} ${passkeys.length + 1}` });
      const done = outcomeOf(result);
      setOutcome(done === "cancelled" ? undefined : done);
      if (done === "done") router.refresh();
    });

  return (
    <div className="flex flex-col gap-4">
      {passkeys.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("none")}</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border">
          {passkeys.map((each) => (
            <PasskeyRow key={each.id} passkey={each} onRemoved={() => setOutcome("removed")} />
          ))}
        </ul>
      )}
      {outcome && outcome !== "cancelled" && (
        <p role={outcome === "done" || outcome === "removed" ? "status" : "alert"} className="text-sm">
          {outcome === "done" ? t("added") : outcome === "removed" ? t("removed") : outcome === "tooFast" ? t("tooFast") : t("failed")}
        </p>
      )}
      <Button type="button" variant="outline" onClick={add} disabled={adding} className="self-start">
        <KeyRound aria-hidden />
        {adding ? t("adding") : t("add")}
      </Button>
    </div>
  );
}

function PasskeyRow({ passkey, onRemoved }: { passkey: ListedPasskey; onRemoved: () => void }) {
  const t = useTranslations("Account.passkeys");
  const name = passkey.name ?? t("unnamed");
  const [renaming, setRenaming] = useState(false);
  const [state, rename, saving] = useActionState(async (previous: Awaited<ReturnType<typeof renamePasskeyAction>>, formData: FormData) => {
    const result = await renamePasskeyAction(passkey.id, previous, formData);
    if (!result?.error) setRenaming(false);
    return result;
  }, undefined);
  const [removing, startRemoving] = useTransition();

  return (
    <li className="flex flex-col gap-3 p-4">
      {renaming ? (
        <form action={rename} className="flex flex-col gap-3">
          <Field>
            <FieldLabel htmlFor={`passkey-${passkey.id}`}>{t("nameLabel")}</FieldLabel>
            <Input id={`passkey-${passkey.id}`} name="name" defaultValue={name} maxLength={60} required autoFocus />
          </Field>
          <FormOutcome state={state} />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saving}>
              {t("save")}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setRenaming(false)}>
              {t("cancel")}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium break-words">{name}</p>
            <p className="text-sm text-muted-foreground">
              {[passkey.created && t("created", { date: passkey.created }), passkey.lastUsed ? t("lastUsed", { date: passkey.lastUsed }) : t("neverUsed")]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" aria-label={t("renameLabel", { name })} onClick={() => setRenaming(true)}>
              {t("rename")}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" size="sm" variant="outline" aria-label={t("removeLabel", { name })}>
                  {t("remove")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("removeTitle")}</AlertDialogTitle>
                  <AlertDialogDescription>{t("removeText", { name })}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel type="button">{t("keep")}</AlertDialogCancel>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={removing}
                    onClick={() =>
                      startRemoving(async () => {
                        await removePasskeyAction(passkey.id);
                        onRemoved();
                      })
                    }
                  >
                    {t("removeConfirm")}
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}
    </li>
  );
}
