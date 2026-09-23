import { notFound } from "next/navigation";
import { NextResponse } from "next/server";
import { baseUrl } from "@/instance/env";
import { HOST_INVITATION_COOKIE, hostInvitationCookieOptions } from "@/instance/host-invitation-token";
import { findHostInvitation } from "@/instance/repository";

// A host invitation's link. It leaves its token in a cookie and hands the visitor the sign-up
// page, which says what the invitation still allows; the sign-up itself, by email, Google, or
// GitHub, reads the cookie and uses the invitation up. A link that was never made is not found.
export async function GET(_request: Request, context: RouteContext<"/host-invitation/[token]">) {
  const { token } = await context.params;
  if (!(await findHostInvitation(token))) notFound();

  const response = NextResponse.redirect(new URL("/sign-up", baseUrl()));
  response.cookies.set(HOST_INVITATION_COOKIE, token, hostInvitationCookieOptions());
  return response;
}
