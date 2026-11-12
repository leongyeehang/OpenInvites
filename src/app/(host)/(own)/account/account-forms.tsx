"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { changeEmail, changePassword, deleteAccount, updateDisplayName } from "@/auth/actions";
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
import { FormOutcome } from "@/components/form-outcome";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function DisplayNameForm({ name }: { name: string }) {
  const t = useTranslations("Account.displayName");
  const [state, action, pending] = useActionState(updateDisplayName, undefined);
  return (
    <form action={action}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="display-name">{t("label")}</FieldLabel>
          <Input id="display-name" name="name" defaultValue={name} autoComplete="nickname" required maxLength={80} />
        </Field>
        <FormOutcome state={state} />
        <Button type="submit" disabled={pending} className="self-start">
          {t("submit")}
        </Button>
      </FieldGroup>
    </form>
  );
}

export function ChangeEmailForm() {
  const t = useTranslations("Account.email");
  const [state, action, pending] = useActionState(changeEmail, undefined);
  return (
    <form action={action}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="new-email">{t("label")}</FieldLabel>
          <Input id="new-email" name="email" type="email" autoComplete="email" required />
        </Field>
        <FormOutcome state={state} />
        <Button type="submit" disabled={pending} className="self-start">
          {t("submit")}
        </Button>
      </FieldGroup>
    </form>
  );
}

export function ChangePasswordForm() {
  const t = useTranslations("Account.password");
  const [state, action, pending] = useActionState(changePassword, undefined);
  return (
    <form action={action}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="current-password">{t("current")}</FieldLabel>
          <Input id="current-password" name="currentPassword" type="password" autoComplete="current-password" required />
        </Field>
        <Field>
          <FieldLabel htmlFor="new-password">{t("new")}</FieldLabel>
          <Input id="new-password" name="newPassword" type="password" autoComplete="new-password" required minLength={8} />
          <FieldDescription>{t("newHint")}</FieldDescription>
        </Field>
        <FormOutcome state={state} />
        <Button type="submit" disabled={pending} className="self-start">
          {t("submit")}
        </Button>
      </FieldGroup>
    </form>
  );
}

// Confirmation is the host's password: it proves it is them, and Better Auth asks for it anyway.
export function DeleteAccountDialog() {
  const t = useTranslations("Account.delete");
  const [state, action, pending] = useActionState(deleteAccount, undefined);
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">{t("button")}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form action={action}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("confirmDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <FieldGroup className="py-4">
            <Field>
              <FieldLabel htmlFor="delete-password">{t("password")}</FieldLabel>
              <Input id="delete-password" name="password" type="password" autoComplete="current-password" required />
            </Field>
            <FormOutcome state={state} />
          </FieldGroup>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">{t("cancel")}</AlertDialogCancel>
            <Button type="submit" variant="destructive" disabled={pending}>
              {t("confirm")}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
