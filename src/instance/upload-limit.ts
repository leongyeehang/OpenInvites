import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { instanceSettings } from "@/db/schema";
import { DEFAULT_LIMITS, PHOTO_MB } from "./limits";

// MAX_UPLOAD_MB retired in 0.7 (M7 ticket 01): the largest photo is Largest photo on Site settings.
// At the first start after the upgrade its value, when set, becomes that setting, once; the
// environment is ignored from then on.

// The megabytes to start Largest photo with: the setting's number rounded up to a whole megabyte
// and kept within the range, or the default for a blank or anything that is not a positive number.
export function photoLimitFromEnv(raw: string | undefined): number {
  const text = raw?.trim();
  if (!text) return DEFAULT_LIMITS.maxPhotoMb;
  const megabytes = Number(text);
  if (!Number.isFinite(megabytes) || megabytes <= 0) return DEFAULT_LIMITS.maxPhotoMb;
  return Math.min(PHOTO_MB.max, Math.max(PHOTO_MB.min, Math.ceil(megabytes)));
}

// One conditional update, so it is idempotent and safe when two containers start together: only
// the row that has not adopted the setting yet is written. A fresh install takes the same path.
export async function adoptUploadLimitAtStart(): Promise<void> {
  const raw = process.env.MAX_UPLOAD_MB;
  const adopted = await getDb()
    .update(instanceSettings)
    .set({ maxPhotoMb: photoLimitFromEnv(raw), uploadEnvAdopted: true })
    .where(eq(instanceSettings.uploadEnvAdopted, false))
    .returning({ maxPhotoMb: instanceSettings.maxPhotoMb });
  if (adopted.length > 0 && raw?.trim()) {
    console.log(`MAX_UPLOAD_MB=${raw.trim()} read once into Largest photo (${adopted[0].maxPhotoMb} MB); the setting is ignored from now on.`);
  }
}
