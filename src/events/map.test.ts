import { describe, expect, it } from "vitest";
import { mapHref } from "./map";

describe("mapHref", () => {
  it("searches Apple Maps on an Apple device and Google Maps everywhere else", () => {
    expect(mapHref("Ah Ma’s house, 3rd floor", { apple: true })).toBe(
      "https://maps.apple.com/?q=Ah%20Ma%E2%80%99s%20house%2C%203rd%20floor",
    );
    expect(mapHref("Ah Ma’s house, 3rd floor", { apple: false })).toBe(
      "https://www.google.com/maps/search/?api=1&query=Ah%20Ma%E2%80%99s%20house%2C%203rd%20floor",
    );
  });
});
