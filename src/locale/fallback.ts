export type MessageTree = { [key: string]: string | MessageTree };

// English is the source language. A string another locale has not translated yet shows in
// English rather than as its key; the translation pass (ticket 20) fills the files in.
export function withEnglishFallback(messages: MessageTree, english: MessageTree): MessageTree {
  const merged: MessageTree = { ...english };
  for (const [key, value] of Object.entries(messages)) {
    const base = english[key];
    merged[key] = typeof value === "object" && typeof base === "object" ? withEnglishFallback(value, base) : value;
  }
  return merged;
}
