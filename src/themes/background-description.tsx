"use client";

import { useTheme } from "./themed-page";

// The host's picture, described for guests who use a screen reader (spec, story 45). A
// background is painted by CSS, which assistive technology never meets, so its description is
// given here, once, in the poster card with the rest of the invitation. Without a description
// the picture is decoration, and nothing is said. As the poster, the picture is an image in the
// page, and says it itself (poster-card.tsx), so this is not rendered.
export function BackgroundDescription() {
  const { upload } = useTheme().resolved;
  return upload?.altText ? <span role="img" aria-label={upload.altText} className="sr-only" /> : null;
}
