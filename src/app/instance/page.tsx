import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { ffmpegStatus, type FfmpegStatus } from "@/album/ffmpeg";
import { albumTotalsByEvent } from "@/album/repository";
import { NO_ITEMS, type AlbumTotals } from "@/album/album";
import { videosHavingSizesMade, videosMissingSizes } from "@/album/sizes";
import { videoProcessor } from "@/album/video";
import { requireOperator } from "@/auth/session";
import { AlertDialog, AlertDialogCancel, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { DeleteDialogContent } from "@/components/delete-dialog-content";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { eventPath } from "@/events/slug";
import { siteFeatures } from "@/features";
import { clearAlbumAsOperatorAction, revokeHostInvitationAction } from "@/instance/actions";
import { videoProcessingMode, type VideoProcessingMode } from "@/instance/env";
import { HOST_INVITATION_DAYS, hostInvitationDaysLeft, hostInvitationState, type HostInvitationState } from "@/instance/host-invitation";
import { posterPool } from "@/instance/home";
import { homePage, instanceLimits, listHostInvitations, registrationMode, videoFourKCopy, videoProcessing, videoWorkerSeenAt, type HostInvitation } from "@/instance/repository";
import { areaLook } from "@/instance/site-look";
import { formatSize } from "@/lib/sizes";
import { ClientMessages } from "@/locale/client-messages";
import { isMailConfigured } from "@/mail/config";
import { countUnhandledReports } from "@/reports/repository";
import { storageConfig } from "@/storage/config";
import { unmeasuredCount } from "@/storage/measure";
import { biggestAlbums, diskUse, freeDiskBytes, siteBytes, type BiggestAlbum } from "@/storage/usage";
import { Veil } from "@/themes/glass";
import { HostFrame } from "../(host)/host-frame";
import { FeaturesForm, HomePageForm, HostInvitationForm, LimitsForm, MissingSizesForm, RegistrationForm, StorageForm } from "./instance-forms";
import { StrayFiles } from "./stray-files";

// Outside the host area's layout, which sends a signed-out visitor to sign in: this page does
// not exist for anyone but the operator, so everyone else gets the not-found page, title and all.
// It is in the frame of every signed-in page all the same, wearing the site area's poster (M8
// ticket 20).
export async function generateMetadata(): Promise<Metadata> {
  await requireOperator();
  const t = await getTranslations("Instance");
  return { title: t("title") };
}

export default async function InstancePage() {
  const host = await requireOperator();
  const [t, locale, home, mode, limits, switches, invitations, unhandledReports, storage] = await Promise.all([
    getTranslations("Instance"),
    getLocale(),
    homePage(),
    registrationMode(),
    instanceLimits(),
    siteFeatures(),
    listHostInvitations(),
    countUnhandledReports(),
    storageFacts(),
  ]);
  const now = new Date();

  return (
    <HostFrame host={host} look={areaLook(posterPool(home), "site")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Veil>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        </Veil>
        {/* On the veil, as Account's Sign out is: its focus ring, drawn outside it, would otherwise
            fall on the bare backdrop, which nothing solves it against (the glass part's review). */}
        <Veil>
          <Button asChild variant="outline">
            <Link href="/instance/reports">{t("reports.link", { count: unhandledReports })}</Link>
          </Button>
        </Veil>
      </div>
      <Card id="home-page">
        <CardHeader>
          <CardTitle>
            <h2>{t("homePage.title")}</h2>
          </CardTitle>
          <CardDescription>{t("homePage.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ClientMessages namespaces={["Instance.homePage", "Posters"]}>
            <HomePageForm home={home} />
          </ClientMessages>
        </CardContent>
      </Card>
      <Card id="registration">
        <CardHeader>
          <CardTitle>
            <h2>{t("registration.title")}</h2>
          </CardTitle>
          <CardDescription>{t("registration.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ClientMessages namespaces={["Instance.registration"]}>
            <RegistrationForm mode={mode} />
          </ClientMessages>
        </CardContent>
      </Card>
      <Card id="limits">
        <CardHeader>
          <CardTitle>
            <h2>{t("limits.title")}</h2>
          </CardTitle>
          <CardDescription>{t("limits.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ClientMessages namespaces={["Instance.limits"]}>
            <LimitsForm limits={limits} />
          </ClientMessages>
        </CardContent>
      </Card>
      <Card id="features">
        <CardHeader>
          <CardTitle>
            <h2>{t("features.title")}</h2>
          </CardTitle>
          <CardDescription>{t("features.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ClientMessages namespaces={["Instance.features"]}>
            <FeaturesForm switches={switches} videosAvailable={storage.ffmpeg.available} />
          </ClientMessages>
        </CardContent>
      </Card>
      <Card id="storage">
        <CardHeader>
          <CardTitle>
            <h2>{t("storage.title")}</h2>
          </CardTitle>
          <CardDescription>{t("storage.description")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
            <dt>{t("storage.albums")}</dt>
            <dd>{formatSize(storage.use.albums, locale)}</dd>
            {storage.use.reserved > 0 && (
              <>
                <dt>{t("storage.reserved")}</dt>
                <dd>{formatSize(storage.use.reserved, locale)}</dd>
              </>
            )}
            <dt>{t("storage.pictures")}</dt>
            <dd>{formatSize(storage.use.pictures, locale)}</dd>
            <dt className="font-medium">{t("storage.total")}</dt>
            <dd className="font-medium">{formatSize(storage.use.albums + storage.use.pictures, locale)}</dd>
            {storage.disk !== undefined && (
              <>
                <dt>{t("storage.onDisk")}</dt>
                <dd>{formatSize(storage.disk, locale)}</dd>
              </>
            )}
            {storage.free !== undefined && (
              <>
                <dt>{t("storage.free")}</dt>
                <dd>{formatSize(storage.free, locale)}</dd>
              </>
            )}
          </dl>
          {storage.bucket && <p className="text-sm text-muted-foreground">{t("storage.bucketNote")}</p>}
          <VideosLine status={storage.ffmpeg} />
          {/* Whether HDR videos' copies come out in standard colour (M8 ticket 05). */}
          {storage.ffmpeg.available && <p className="text-sm">{t(storage.ffmpeg.toneMapping ? "storage.hdrConverted" : "storage.hdrFlat")}</p>}
          {storage.ffmpeg.available && <ProcessedByLine mode={storage.mode} seenAt={storage.workerSeenAt} now={now} />}
          <div className="flex flex-col gap-2">
            {/* Every video has its sizes only when none lacks one and none is being given them
                (media part review). */}
            <div role="status" className="flex flex-col gap-1 text-sm">
              {(storage.missing > 0 || storage.making === 0) && <p>{t("storage.missingSizes", { count: storage.missing })}</p>}
              {storage.making > 0 && <p>{t("storage.sizesBeingMade", { count: storage.making })}</p>}
            </div>
            {storage.processing && storage.ffmpeg.available && (
              <ClientMessages namespaces={["Instance.storage"]}>
                <MissingSizesForm count={storage.missing} />
              </ClientMessages>
            )}
          </div>
          {storage.unmeasured > 0 && (
            <p role="status" className="text-sm text-muted-foreground">
              {t("storage.measuring", { count: storage.unmeasured })}
            </p>
          )}
          <section aria-labelledby="storage-biggest-heading" className="flex flex-col gap-3">
            <h3 id="storage-biggest-heading" tabIndex={-1} className="font-medium outline-none">
              {t("storage.biggest")}
            </h3>
            {storage.biggest.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("storage.none")}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {storage.biggest.map((album) => (
                  <BiggestAlbumRow key={album.id} album={album} totals={storage.totals.get(album.id) ?? NO_ITEMS} locale={locale} />
                ))}
              </ul>
            )}
          </section>
          <ClientMessages namespaces={["Instance.storage"]}>
            <StorageForm processing={storage.processing} fourK={storage.fourK} />
            <StrayFiles />
          </ClientMessages>
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
          <ClientMessages namespaces={["Instance.invitations"]}>
            <HostInvitationForm canSend={isMailConfigured()} />
          </ClientMessages>
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
    </HostFrame>
  );
}

// What the Storage card shows (M7 ticket 03): the counted use, what local disk really holds and
// has free (nothing on S3, where the site cannot see a disk), what is still being measured from
// before the upgrade, the albums that take the most, the processing switches, and how many videos
// lack a size their event asks for (M8 ticket 04), counted before Make missing sizes is pressed,
// and how many are having sizes made meanwhile.
async function storageFacts() {
  const [use, disk, free, unmeasured, biggest, processing, fourK, workerSeenAt, missing, making] = await Promise.all([
    siteBytes(),
    diskUse(),
    freeDiskBytes(),
    unmeasuredCount(),
    biggestAlbums(5),
    videoProcessing(),
    videoFourKCopy(),
    videoWorkerSeenAt(),
    videosMissingSizes(),
    videosHavingSizesMade(),
  ]);
  // What each of the biggest albums holds, for the confirmation before clearing one (ticket 10).
  const totals = await albumTotalsByEvent(biggest.map(({ id }) => id));
  return { use, disk, free, unmeasured, biggest, totals, processing, fourK, workerSeenAt, missing: missing.length, making, mode: videoProcessingMode(), bucket: storageConfig().backend === "s3", ffmpeg: ffmpegStatus() };
}

// Whether this server can process videos (ADR-0007, ticket 05).
async function VideosLine({ status }: { status: FfmpegStatus }) {
  const t = await getTranslations("Instance.storage");
  const text = status.available ? t("videosAvailable", { version: status.version }) : status.reason === "old" ? t("videosOld", { version: status.version ?? "?" }) : t("videosMissing");
  return <p className="text-sm">{text}</p>;
}

// Who processes videos (ticket 08): this app, or the worker container and when it last reported;
// a worker not heard from for five minutes is called out.
async function ProcessedByLine({ mode, seenAt, now }: { mode: VideoProcessingMode; seenAt: Date | undefined; now: Date }) {
  const [t, format] = await Promise.all([getTranslations("Instance.storage"), getFormatter()]);
  const who = videoProcessor(mode, seenAt, now);
  const text = who === "app" ? t("processedByApp") : who === "worker" && seenAt ? t("processedByWorker", { time: format.relativeTime(seenAt, now) }) : t("processedByWorkerMissing");
  return <p className="text-sm">{text}</p>;
}

// One of the biggest albums: the event, linked to its page (the operator cannot open another
// host's editor), its hosts with their emails, what it holds, and Clear the album (ticket 10),
// confirmed with what goes; the hosts are emailed. The focus goes to the list's heading once the
// row is gone.
async function BiggestAlbumRow({ album, totals, locale }: { album: BiggestAlbum; totals: AlbumTotals; locale: string }) {
  const t = await getTranslations("Instance.storage");
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl p-3 ring-1 ring-foreground/10">
      <div className="flex min-w-0 flex-col gap-1">
        <Link href={eventPath(album)} className="font-medium underline-offset-4 hover:underline">
          {album.title}
        </Link>
        <span className="break-all text-sm text-muted-foreground">{album.hosts.map((host) => `${host.name} (${host.email})`).join(", ")}</span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm">{t("use", { size: formatSize(album.bytes, locale), count: album.items })}</span>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              {t("clearAlbum")}
            </Button>
          </AlertDialogTrigger>
          <DeleteDialogContent focusAfter="storage-biggest-heading">
            <form action={clearAlbumAsOperatorAction.bind(null, album.id)}>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("clearAlbumTitle", { photos: totals.photos, videos: totals.videos, size: formatSize(album.bytes, locale), title: album.title })}</AlertDialogTitle>
                <AlertDialogDescription>{t("clearAlbumText")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="pt-4">
                <AlertDialogCancel type="button">{t("neverMind")}</AlertDialogCancel>
                <Button type="submit" variant="destructive">
                  {t("clearAlbumConfirm")}
                </Button>
              </AlertDialogFooter>
            </form>
          </DeleteDialogContent>
        </AlertDialog>
      </div>
    </li>
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
