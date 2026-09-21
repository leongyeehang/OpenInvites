import type { ReactNode } from "react";

// One narrow column for every screen a person sees before or without being signed in.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <main className="mx-auto flex min-h-svh w-full max-w-sm flex-col justify-center gap-6 px-4 py-12">{children}</main>;
}
