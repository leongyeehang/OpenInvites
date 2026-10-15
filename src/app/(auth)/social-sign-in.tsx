import { getTranslations } from "next-intl/server";
import { signInSocial } from "@/auth/actions";
import type { SocialProviderId } from "@/auth/providers";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const LABEL_KEY: Record<SocialProviderId, "continueWithGoogle" | "continueWithGithub"> = {
  google: "continueWithGoogle",
  github: "continueWithGithub",
};

// Rendered on both the sign-in and sign-up pages; nothing renders when the operator has
// configured no provider. A click posts straight to the server action, which sends the
// browser to the provider - there is no client-side auth library here. The browser comes back to
// `next`, when the sign-in page was given one.
export async function SocialSignIn({
  providers,
  namespace,
  next,
}: {
  providers: SocialProviderId[];
  namespace: "Auth.signIn" | "Auth.signUp";
  next?: string;
}) {
  if (providers.length === 0) return null;
  const t = await getTranslations(namespace);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Separator className="flex-1" />
        {t("orContinueWith")}
        <Separator className="flex-1" />
      </div>
      {providers.map((provider) => (
        <form key={provider} action={signInSocial.bind(null, provider, next)}>
          <Button type="submit" variant="outline" className="w-full">
            {t(LABEL_KEY[provider])}
          </Button>
        </form>
      ))}
    </div>
  );
}
