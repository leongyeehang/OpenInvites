import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireOperator } from "@/auth/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { revokeHostInvitationAction } from "@/instance/actions";
import { HOST_INVITATION_DAYS, hostInvitationDaysLeft, hostInvitationState, type HostInvitationState } from "@/instance/host-invitation";
import { listHostInvitations, registrationMode, type HostInvitation } from "@/instance/repository";
import { isMailConfigured } from "@/mail/config";
import { HostHeader } from "../(host)/host-header";
import { HostInvitationForm, RegistrationForm } from "./instance-forms";

// Outside the host area's layout, which sends a signed-out visitor to sign in: this page does
// not exist for anyone but the operator, so everyone else gets the not-found page, title and all.
export async function generateMetadata(): Promise<Metadata> {
  await requireOperator();
  const t = await getTranslations("Instance");
  return { title: t("title") };
}

export default async function InstancePage() {
  const host = await requireOperator();
  const [t, mode, invitations] = await Promise.all([getTranslations("Instance"), registrationMode(), listHostInvitations()]);
  const now = new Date();

  return (
    <>
      <HostHeader host={host} />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>{t("registration.title")}</h2>
            </CardTitle>
            <CardDescription>{t("registration.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <RegistrationForm mode={mode} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>{t("invitations.title")}</h2>
            </CardTitle>
            <CardDescription>{t("invitations.description", { days: HOST_INVITATION_DAYS })}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <HostInvitationForm canSend={isMailConfigured()} />
            <section aria-labelledby="invitations-heading" className="flex flex-col gap-3">
              <h3 id="invitations-heading" className="font-medium">
                {t("invitations.listTitle")}
              </h3>
              {invitations.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("invitations.empty")}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {invitations.map((invitation) => (
                    <InvitationRow key={invitation.id} invitation={invitation} state={hostInvitationState(invitation, now)} now={now} />
                  ))}
                </ul>
              )}
            </section>
          </CardContent>
        </Card>
      </main>
    </>
  );
}

const BADGE = { pending: "default", used: "secondary", revoked: "destructive", expired: "outline" } as const;

async function InvitationRow({ invitation, state, now }: { invitation: HostInvitation; state: HostInvitationState; now: Date }) {
  const t = await getTranslations("Instance.invitations");
  const detail =
    state === "pending"
      ? t("expiresIn", { days: hostInvitationDaysLeft(invitation.expiresAt, now) })
      : state === "used" && invitation.usedByEmail
        ? t("usedBy", { email: invitation.usedByEmail })
        : undefined;
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl p-3 ring-1 ring-foreground/10">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="break-all font-medium">{invitation.email ?? t("anyone")}</span>
          <Badge variant={BADGE[state]}>{t(`state.${state}`)}</Badge>
        </div>
        {detail && <span className="break-all text-sm text-muted-foreground">{detail}</span>}
      </div>
      {state === "pending" && (
        <form action={revokeHostInvitationAction.bind(null, invitation.id)}>
          <Button type="submit" variant="outline" size="sm">
            {t("revoke")}
          </Button>
        </form>
      )}
    </li>
  );
}
