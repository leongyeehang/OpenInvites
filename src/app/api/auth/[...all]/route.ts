import { getAuth } from "@/auth/auth";
import { isTurnstileConfigured } from "@/turnstile/config";

// Better Auth's own endpoints: the links in verification emails land here, and so do the
// Google and GitHub OAuth callbacks. Forms call the server actions in src/auth/actions.ts instead.
export async function GET(request: Request): Promise<Response> {
  return getAuth().handler(request);
}

// With Turnstile on, an email sign-up is made through the sign-up form, whose action checks the
// form's token first (spec, "Turnstile"); one posted here would skip the check, so it is refused.
export async function POST(request: Request): Promise<Response> {
  if (isTurnstileConfigured() && new URL(request.url).pathname === "/api/auth/sign-up/email") {
    return Response.json({ code: "CHECK_FAILED", message: "Sign up through the sign-up form." }, { status: 403 });
  }
  return getAuth().handler(request);
}
