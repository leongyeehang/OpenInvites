import type { MessageTree } from "./fallback";

// The part of the messages a page's client components read: each namespace named, as a whole or
// as a part of one ("Events.form"), at the place it has in the whole, and nothing else.
export function pickMessages(messages: MessageTree, namespaces: readonly string[]): MessageTree {
  const picked: MessageTree = {};
  for (const namespace of namespaces) {
    const path = namespace.split(".");
    const last = path.pop()!;
    let from = messages;
    let to = picked;
    for (const key of path) {
      from = from[key] as MessageTree;
      to = (to[key] ??= {}) as MessageTree;
    }
    to[last] = from[last];
  }
  return picked;
}
