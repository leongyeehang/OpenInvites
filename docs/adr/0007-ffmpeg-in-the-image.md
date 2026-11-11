# Videos are processed in the image with ffmpeg

The album takes videos from 0.7 (M7). The maintainer chose, on 2026-11-08, that every clip is processed on the server rather than kept as the phone sent it or re-encoded in the guest's browser: a clip kept as sent plays only where the browser can decode it (an iPhone's high-efficiency recordings fail in Chrome and Firefox), carries the phone's location in its metadata, and starts playing only once the whole file has arrived; re-encoding in the browser costs a phone minutes of battery per clip and gives different formats in different browsers. So the runner image carries Alpine's `ffmpeg` package, the first binary it carries beyond Node and the app's own modules.

Every clip is rewrapped at original quality with its metadata dropped and its index moved to the front, which is instant; a lighter H.264 copy is made only when the original is not H.264, larger than the event's chosen quality, or far above its bit rate. A poster frame and a thumbnail come from the same tool. The work runs in a queue, one clip at a time per container, so the site keeps answering pages.

## Consequences

- The image is larger by about 130 MB: 235 MB before, 368 MB with ffmpeg 8.1.3, measured on 2026-11-09. Processing a clip takes CPU and about 300 MB of memory while it runs; a small site processes a 4K clip slowly but safely, since the queue is serial. An operator can move the processing to a second container from the same image (`VIDEO_PROCESSING=worker`).
- The app requires ffmpeg 6 or later, because a phone's rotation survives a stream copy only from 6. `node:22-alpine` is a floating tag, so the ffmpeg version may move between builds; the app checks the version at start and, without a usable one, refuses videos and says so on Site settings rather than failing to start.
- HDR copies (M8 ticket 05): the image's ffmpeg 8.1.3 on Alpine 3.24 has `zscale`, `tonemap`, `colorspace` and `libplacebo`; the app uses the first two, which run on the CPU, to convert an HDR video's copies, poster and thumbnail to standard colour, and checks for them at start.
- The rule M6's tickets carried, "no new runtime dependency", becomes "a runtime dependency needs an ADR". This is that ADR for ffmpeg. Nothing here contacts anything outside the instance (ADR-0005), and files still go only through the storage interface (ADR-0003).
