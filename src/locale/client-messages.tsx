import { NextIntlClientProvider, type Messages, type NamespaceKeys, type NestedKeyOf } from "next-intl";
import { getMessages } from "next-intl/server";
import type { ReactNode } from "react";
import type { MessageTree } from "./fallback";
import { pickMessages } from "./pick-messages";

// A namespace of messages/en.json, or a part of one ("Events.form"), as useTranslations takes it.
export type MessageNamespace = NamespaceKeys<Messages, NestedKeyOf<Messages>>;

// The messages the client components inside it read, sent to the browser with the page, and no
// others: server components read theirs on the server, and every message in every namespace would
// otherwise travel with every page. A page wraps what it renders in one, naming the namespaces its
// client components pass to useTranslations, and a part it renders only for some visitors (the
// host's Design drawer) in one of its own. client-messages.test.ts fails when a client component
// uses a namespace its page does not pass, or a page passes one no client component of it uses.
export async function ClientMessages({ namespaces, children }: { namespaces: readonly MessageNamespace[]; children: ReactNode }) {
  const messages = (await getMessages()) as MessageTree;
  return <NextIntlClientProvider messages={pickMessages(messages, namespaces)}>{children}</NextIntlClientProvider>;
}
