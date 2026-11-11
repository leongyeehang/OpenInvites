// The video worker (M7 ticket 08): a launcher, not a program. The image carries no TypeScript
// toolchain, and the queue, ffmpeg's driver and the S3 client are bundled into the server, so the
// worker is that same server started in the worker role: it runs the migrations and the start
// checks, then only the video queue, answering no page and sending no mail. It still listens on
// its port, unpublished, which gives it the image's health check. The standalone server changes
// into its own directory before anything else, so this import works from /app/scripts.
process.env.VIDEO_ROLE = "worker";
await import("../server.js");
