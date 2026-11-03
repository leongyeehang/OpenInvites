// Where an event's picture came from (M4 spec, "The poster replaces the background"): a photo or
// flyer the host uploaded, or an emoji pattern the host made in the Poster sheet, drawn in their
// browser and uploaded like any picture. The list is the source; the database enum is built from
// it.
export const UPLOAD_ORIGINS = ["host", "emoji"] as const;

export type UploadOrigin = (typeof UPLOAD_ORIGINS)[number];
