import { notFound } from "next/navigation";
import { preload } from "react-dom";
import { requireHost } from "@/auth/session";
import { findHostEvent } from "@/events/repository";
import { eventLook } from "@/instance/site-look";
import { TITLE_FONT_FILES } from "@/themes/title-fonts";
import { findEventUpload } from "@/uploads/repository";
import { themeUpload } from "@/uploads/uploads";
import { HostFrame } from "../../host-frame";

// An event's management pages (guests, invites, share, hosts, announcements) in the frame of every
// signed-in page, on the event's own Theme held still (M8 ticket 21): its poster's blurred copy or
// its colour behind, its accent on the buttons, its title face for each page's heading
// (manage-heading.tsx). The host sees the invitation they made, not the dashboard's poster. Each
// page puts its own text on the veil or in glass panels. `findHostEvent` is the one gate, as on each
// page, so a co-host sees the event's look too and anyone else meets the not-found page. The title's
// face is asked for from the head, as the event page does (themed-page.tsx). A host who changes the
// poster in the editor, which is another tree, finds this drawn afresh on the way back.
export default async function EventPagesLayout({ children, params }: LayoutProps<"/events/[id]">) {
  const [host, { id }] = await Promise.all([requireHost(), params]);
  const event = await findHostEvent(host.id, id);
  if (!event) notFound();
  const upload = event.theme.poster.kind === "upload" ? await findEventUpload(event.id) : undefined;
  preload(TITLE_FONT_FILES[event.theme.font], { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  return (
    <HostFrame host={host} look={eventLook(event.theme, upload ? themeUpload(upload) : null)}>
      {children}
    </HostFrame>
  );
}
