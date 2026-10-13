import { WARNING_DAYS } from "./plan";

// How old a retention mark must be before the sweep deletes its event: 30 days (WARNING_DAYS). Only
// the Compose test profile's instance without mail sets RETENTION_TEST_FLOOR_DAYS, to 0, so that
// e2e/retention.spec.ts sees an event deleted at the sweep after the one that marked it. It is not
// an operator's setting and is documented only beside that service in compose.yaml.
export function retentionFloorDays(): number {
  const value = process.env.RETENTION_TEST_FLOOR_DAYS?.trim();
  return value && /^\d+$/.test(value) ? Number(value) : WARNING_DAYS;
}
