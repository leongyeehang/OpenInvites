# Test clips

Three small videos for the browser tests of the album (M7 ticket 06 onwards). They were made
with ffmpeg 8.1.3 in a throwaway container, since this repository's development machines need
no ffmpeg; the commands below remake them:

```sh
docker run --rm -v "$PWD/e2e/fixtures:/out" node:22-alpine sh -c '
  apk add --no-cache ffmpeg && cd /out &&
  # A plain H.264 clip with sound, 4 s at 640x480 (about 1.5 MB, so a 1 MB cap refuses it): rewrapped only, never converted.
  ffmpeg -y -f lavfi -i testsrc2=size=640x480:rate=30 -f lavfi -i sine=frequency=440:sample_rate=48000 \
    -t 4 -c:v libx264 -preset veryfast -b:v 3000k -pix_fmt yuv420p -c:a aac -b:a 64k -shortest clip-h264.mp4 &&
  # An HEVC clip in a .mov, shown portrait through a 90-degree rotation on a landscape stream, with
  # a location in its metadata (about 650 KB): needs a lighter copy, must come out upright, and
  # must lose the location. Two passes, since a generated stream carries no side data.
  ffmpeg -y -f lavfi -i testsrc2=size=640x480:rate=30 -f lavfi -i sine=frequency=440:sample_rate=48000 \
    -t 4 -c:v libx265 -preset veryfast -b:v 1200k -pix_fmt yuv420p -tag:v hvc1 -c:a aac -b:a 64k -shortest /tmp/plain.mov &&
  ffmpeg -y -noautorotate -display_rotation 90 -i /tmp/plain.mov -c copy -tag:v hvc1 \
    -metadata location="+35.6895+139.6917/" -metadata location-eng="+35.6895+139.6917/" -movflags +use_metadata_tags clip-hevc.mov &&
  # A clip just over a minute, 64x64 at one frame a second (about 3 KB): refused by the length cap.
  ffmpeg -y -f lavfi -i color=c=gray:size=64x64:rate=1 -t 61 -c:v libx264 -preset veryfast -pix_fmt yuv420p -an clip-long.mp4'
```

What the tests rely on: `clip-h264.mp4` is H.264 at 640×480 and plays in headless Chrome;
`clip-hevc.mov` reports a display-matrix rotation of 90 and holds the string `+35.6895+139.6917`
twice (keys `location` and `location-eng`), and headless Chrome cannot decode it; `clip-long.mp4`
is 61 seconds long. The test profile's `app` uses 64 KB upload parts (`UPLOAD_TEST_PART_BYTES`),
so the first two span several parts.
