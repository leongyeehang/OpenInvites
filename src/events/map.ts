// The venue in a maps app, built from the host's free text (spec, "Events and RSVPs"). Apple
// platforms get Apple Maps because that is where their guests already are; everyone else gets a
// Google Maps search. The page decides which from the device it is running on.
export function mapHref(location: string, options: { apple: boolean }): string {
  const query = encodeURIComponent(location);
  return options.apple ? `https://maps.apple.com/?q=${query}` : `https://www.google.com/maps/search/?api=1&query=${query}`;
}
