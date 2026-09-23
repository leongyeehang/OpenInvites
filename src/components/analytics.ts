// The operator's analytics snippet in the head (spec, "Operator configuration"; ADR-0005). The
// browser runs its scripts as it reads the page the server sent. Some pages are not sent whole:
// Next.js builds a page that ends in notFound(), or in an error, in the browser, and a head that
// arrives that way never runs a script. So the snippet is led by a marker of our own, which runs
// only when the browser read the head itself; AnalyticsFallback runs the snippet when it did not.
export const HEAD_READ_MARKER = "openinvitesHeadRead";

export function analyticsHead(snippet: string): string {
  return `<script>window.${HEAD_READ_MARKER}=true</script>${snippet}`;
}
