// Written by `pnpm posters` (scripts/posters/build.ts): do not edit by hand. For each gallery
// poster, its files in public/posters/ (the poster, its JPEG for the preview card, and the small
// copy the page blurs behind it) and what was measured from it: its average luminance, and the
// lightest and darkest points of its blurred copy as text on the page meets them, measured as a
// host's upload is (uploads/process.ts).

export type PosterFiles = { src: string; card: string; copy: string; luminance: number; lightest: string; darkest: string };

export const POSTER_FILES: Record<string, PosterFiles> = {
  "candles": { src: "/posters/birthday-candles.b90af178.svg", card: "/posters/birthday-candles.5d6077ae.jpg", copy: "/posters/birthday-candles-copy.15ceca5b.webp", luminance: 0.36, lightest: "#686f5d", darkest: "#847e88" },
  "balloons": { src: "/posters/balloons.25c64485.svg", card: "/posters/balloons.10932898.jpg", copy: "/posters/balloons-copy.404a0419.webp", luminance: 0.62, lightest: "#8b8a8a", darkest: "#93b6c9" },
  "cake": { src: "/posters/birthday-cake.2933e979.svg", card: "/posters/birthday-cake.e5c333a9.jpg", copy: "/posters/birthday-cake-copy.202cecc2.webp", luminance: 0.86, lightest: "#888682", darkest: "#f2dcdc" },
  "candlelight": { src: "/posters/candlelight.18563136.svg", card: "/posters/candlelight.c4543f69.jpg", copy: "/posters/candlelight-copy.7dd440c6.webp", luminance: 0.22, lightest: "#605043", darkest: "#897f7e" },
  "picnic": { src: "/posters/picnic.e9430853.svg", card: "/posters/picnic.1160b617.jpg", copy: "/posters/picnic-copy.119975be.webp", luminance: 0.77, lightest: "#8a8887", darkest: "#f2bcbb" },
  "botanical": { src: "/posters/botanical-arch.7c141e42.svg", card: "/posters/botanical-arch.daf66fa4.jpg", copy: "/posters/botanical-arch-copy.02ea7afe.webp", luminance: 0.88, lightest: "#878681", darkest: "#d0d4c7" },
  "rings": { src: "/posters/rings.f33823c4.svg", card: "/posters/rings.4d11238d.jpg", copy: "/posters/rings-copy.e3981974.webp", luminance: 0.79, lightest: "#898380", darkest: "#dec7a2" },
  "rose": { src: "/posters/rose-garden.a3add76f.svg", card: "/posters/rose-garden.92e2a32e.jpg", copy: "/posters/rose-garden-copy.7c3473fc.webp", luminance: 0.3, lightest: "#845d6d", darkest: "#8a7d88" },
  "playtime": { src: "/posters/playtime-shapes.c4b56e4b.svg", card: "/posters/playtime-shapes.2e2d9485.jpg", copy: "/posters/playtime-shapes-copy.1b4e2387.webp", luminance: 0.86, lightest: "#8a7f5a", darkest: "#fbb6b3" },
  "rainbow": { src: "/posters/rainbow.63a23b91.svg", card: "/posters/rainbow.f1f945fb.jpg", copy: "/posters/rainbow-copy.f4815c3a.webp", luminance: 0.86, lightest: "#8b8b8b", darkest: "#facec6" },
  "disco": { src: "/posters/disco-ball.9bd37fcd.svg", card: "/posters/disco-ball.496627eb.jpg", copy: "/posters/disco-ball-copy.d09e3a18.webp", luminance: 0.21, lightest: "#696070", darkest: "#807b89" },
  "sunset-drive": { src: "/posters/sunset-drive.a3fb6d83.svg", card: "/posters/sunset-drive.df287e9e.jpg", copy: "/posters/sunset-drive-copy.93a1179a.webp", luminance: 0.2, lightest: "#836c46", darkest: "#827a8c" },
  "cocktails": { src: "/posters/cocktails.b99ce008.svg", card: "/posters/cocktails.79e5857b.jpg", copy: "/posters/cocktails-copy.161ca8b6.webp", luminance: 0.41, lightest: "#867752", darkest: "#82989f" },
  "sunshine": { src: "/posters/sunshine.7191c313.svg", card: "/posters/sunshine.c558247a.jpg", copy: "/posters/sunshine-copy.bf40eff5.webp", luminance: 0.75, lightest: "#8a733a", darkest: "#a1ceae" },
  "seaside": { src: "/posters/seaside.9488e8ce.svg", card: "/posters/seaside.3d15c419.jpg", copy: "/posters/seaside-copy.b7d68e53.webp", luminance: 0.65, lightest: "#888176", darkest: "#7e98ab" },
  "sunset-sea": { src: "/posters/sunset-sea.12f9dd2e.svg", card: "/posters/sunset-sea.cdcf742c.jpg", copy: "/posters/sunset-sea-copy.46aa8a26.webp", luminance: 0.45, lightest: "#8a7f5e", darkest: "#888190" },
  "string-lights": { src: "/posters/string-lights.10d29d9f.svg", card: "/posters/string-lights.0489e090.jpg", copy: "/posters/string-lights-copy.4d8ff9e5.webp", luminance: 0.23, lightest: "#747062", darkest: "#7d8393" },
  "aurora": { src: "/posters/aurora.99df6bf2.svg", card: "/posters/aurora.de6fbeee.jpg", copy: "/posters/aurora-copy.6b3de59b.webp", luminance: 0.19, lightest: "#18534b", darkest: "#787a80" },
  "bokeh": { src: "/posters/bokeh.38545889.svg", card: "/posters/bokeh.426aed38.jpg", copy: "/posters/bokeh-copy.5d666cfb.webp", luminance: 0.15, lightest: "#745335", darkest: "#7d7b82" },
  "streamers": { src: "/posters/streamers.5f12ee39.svg", card: "/posters/streamers.9bba6668.jpg", copy: "/posters/streamers-copy.8d0a8ed6.webp", luminance: 0.38, lightest: "#5e4d7e", darkest: "#9385c7" },
};
