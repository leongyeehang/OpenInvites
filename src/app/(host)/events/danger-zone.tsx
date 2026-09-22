"use client";

import { useTranslations } from "next-intl";
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
import { cancelEventAction, deleteEventAction } from "@/events/actions";

// Calling an event off and deleting it: the two things a host cannot take back, so both say
// what they cost before they happen. Cancelling is offered only while there is something to
// call off; an event that has been cancelled stays cancelled.
export function DangerZone({ eventId, title, cancellable, rsvps }: {
  eventId: string;
  title: string;
  cancellable: boolean;
  rsvps: number;
}) {
  const t = useTranslations("Events.manage");
  return (
    <div className="flex flex-wrap gap-2">
      {cancellable && (
        <Confirm
          trigger={<Button variant="outline">{t("cancel")}</Button>}
          title={t("cancelTitle", { title })}
          description={t("cancelText")}
          confirm={t("cancelConfirm")}
          cancel={t("keep")}
          action={cancelEventAction.bind(null, eventId)}
        />
      )}
      <Confirm
        trigger={<Button variant="destructive">{t("delete")}</Button>}
        title={t("deleteTitle", { title })}
        description={t("deleteText", { count: rsvps })}
        confirm={t("deleteConfirm")}
        cancel={t("keep")}
        action={deleteEventAction.bind(null, eventId)}
      />
    </div>
  );
}

function Confirm({ trigger, title, description, confirm, cancel, action }: {
  trigger: React.ReactNode;
  title: string;
  description: string;
  confirm: string;
  cancel: string;
  action: () => Promise<void>;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <form action={action}>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-4">
            <AlertDialogCancel type="button">{cancel}</AlertDialogCancel>
            <Button type="submit" variant="destructive">
              {confirm}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
