# Test clips

Small videos for the browser tests of the album (M7 ticket 06 onwards). They were made
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

The fourth was added in M8 ticket 03, with ffmpeg 8.1.3 in the same throwaway container:

```sh
# An HEVC clip with sound, 2 s at 1920x1080 (about 400 KB): gets a 1080p copy before it is ready, and a 720p copy after.
docker run --rm -v "$PWD/e2e/fixtures:/out" node:22-alpine sh -c 'apk add --no-cache ffmpeg && cd /out && ffmpeg -y -f lavfi -i testsrc2=size=1920x1080:rate=30 -f lavfi -i sine=frequency=440:sample_rate=48000 -t 2 -c:v libx265 -preset veryfast -b:v 1500k -pix_fmt yuv420p -tag:v hvc1 -c:a aac -b:a 64k -shortest clip-hevc-1080p.mp4'
```

The fifth was added in M8 ticket 04, with ffmpeg 8.1.3 in the same throwaway container:

```sh
# An HEVC clip with no sound, 1 s at 3840x2160 and ten frames a second (about 570 KB): gets a 4K copy when the operator's switch is on.
docker run --rm -v "$PWD/e2e/fixtures:/out" node:22-alpine sh -c 'apk add --no-cache ffmpeg && cd /out && ffmpeg -y -f lavfi -i testsrc2=size=3840x2160:rate=10 -t 1 -c:v libx265 -preset veryfast -b:v 2000k -pix_fmt yuv420p -tag:v hvc1 -an clip-hevc-4k.mp4'
```

The sixth was added in M8 ticket 05, with ffmpeg 8.1.3 in the same throwaway container. Its
`libx265` lists `yuv420p10le` among its pixel formats (`ffmpeg -hide_banner -h encoder=libx265`),
so the clip is 10-bit. The ticket's command was refused by `zscale` ("no path between
colorspaces") until the first `zscale` was told the test pattern's matrix and range as well
(`min=bt709`, `rin=tv`):

```sh
# An HLG HDR clip with sound, 2 s at 1920x1080, 10-bit HEVC tagged BT.2020 (about 380 KB): keeps HLG in its original, and its copies are tone-mapped to BT.709.
docker run --rm -v "$PWD/e2e/fixtures:/out" node:22-alpine sh -c 'apk add --no-cache ffmpeg && cd /out && ffmpeg -y -f lavfi -i testsrc2=size=1920x1080:rate=30 -f lavfi -i sine=frequency=440:sample_rate=48000 -t 2 -vf "zscale=tin=bt709:min=bt709:pin=bt709:rin=tv:t=arib-std-b67:p=bt2020:m=bt2020nc:r=tv:npl=100,format=yuv420p10le" -c:v libx265 -preset veryfast -b:v 1500k -tag:v hvc1 -color_primaries bt2020 -color_trc arib-std-b67 -colorspace bt2020nc -color_range tv -c:a aac -b:a 64k -shortest clip-hdr.mp4'
```

`ffprobe -v error -show_streams -select_streams v:0 clip-hdr.mp4` then said, among the rest:

```
codec_name=hevc
profile=Main 10
codec_tag_string=hvc1
width=1920
height=1080
pix_fmt=yuv420p10le
color_range=tv
color_space=bt2020nc
color_transfer=arib-std-b67
color_primaries=bt2020
r_frame_rate=30/1
avg_frame_rate=30/1
duration=2.000000
```

What the tests rely on: `clip-h264.mp4` is H.264 at 640×480 and plays in headless Chrome;
`clip-hevc.mov` reports a display-matrix rotation of 90 and holds the string `+35.6895+139.6917`
twice (keys `location` and `location-eng`), and headless Chrome cannot decode it;
`clip-long.mp4` is 61 seconds long; `clip-hevc-1080p.mp4` is HEVC at 1920×1080 with sound, 2
seconds long, so its two copies come out at 1920×1080 and 1280×720; `clip-hevc-4k.mp4` is HEVC
at 3840×2160, so with the 4K switch on its three copies come out at 3840×2160, 1920×1080 and
1280×720. `clip-hdr.mp4` is HEVC at 1920×1080 with sound, `color_transfer` `arib-std-b67` and
`color_primaries` `bt2020`, so it is HDR (HLG) and not H.264: its 1080p copy is made before it
is ready and its 720p copy after, both H.264 `yuv420p` tagged `bt709`, while its original keeps
the HLG tags. Nothing here carries a Dolby Vision record: no encoder in the image writes one.
The test profile's `app` uses 64 KB upload parts (`UPLOAD_TEST_PART_BYTES`), so all but the long
clip span several parts.
