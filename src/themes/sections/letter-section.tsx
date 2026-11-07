import { cn } from "@/lib/utils";

// The host's letter to the guest the page is open for (M6 ticket 09, invites/invite.ts letterFor):
// plain text, set as text and never read as markdown or HTML, with the line breaks the host typed
// and the blank lines between its paragraphs. Each layout frames it as its own and heads it
// "For {name}".
export function LetterSection({ body, className }: { body: string; className?: string }) {
  return <p className={cn("break-words whitespace-pre-line", className)}>{body}</p>;
}
