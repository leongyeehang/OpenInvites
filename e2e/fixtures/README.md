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

The seventh and eighth were added in M8 ticket 07, with ffmpeg 8.1.3 and exiftool in the same
throwaway container. `photo-exif.jpg` is the one photo here: a still with an iPhone's EXIF,
location included, which the album never reads; `clip-tagged.mov` is `clip-h264.mp4` rewrapped
with an iPhone's capture time, make, model and location in its tags:

```sh
docker run --rm -v "$PWD/e2e/fixtures:/out" node:22-alpine sh -c '
  apk add --no-cache ffmpeg exiftool && cd /out &&
  # A 640x480 frame of testsrc2 with an iPhone 15 Pro's EXIF and a location (about 25 KB).
  ffmpeg -y -f lavfi -i testsrc2=size=640x480 -frames:v 1 -q:v 3 photo-exif.jpg &&
  exiftool -overwrite_original -Make=Apple "-Model=iPhone 15 Pro" "-LensModel=iPhone 15 Pro back camera 6.86mm f/1.78" \
    "-DateTimeOriginal=2026:01:10 16:42:05" -OffsetTimeOriginal=+08:00 -ExposureTime=1/120 -FNumber=1.78 -ISO=80 \
    -FocalLength=6.86 -GPSLatitude=35.6895 -GPSLatitudeRef=N -GPSLongitude=139.6917 -GPSLongitudeRef=E photo-exif.jpg &&
  # clip-h264.mp4 remuxed into a .mov with an iPhone's tags and a location (about 1.3 MB).
  ffmpeg -y -i clip-h264.mp4 -c copy -map_metadata -1 -metadata com.apple.quicktime.creationdate=2026-01-10T16:20:00+0800 \
    -metadata com.apple.quicktime.make=Apple "-metadata" "com.apple.quicktime.model=iPhone 15 Pro" \
    -metadata location=+35.6895+139.6917/ -movflags +use_metadata_tags clip-tagged.mov'
```

`exiftool -s` then read the photo's Make `Apple`, Model `iPhone 15 Pro`, LensModel `iPhone 15 Pro
back camera 6.86mm f/1.78`, DateTimeOriginal `2026:01:10 16:42:05`, OffsetTimeOriginal `+08:00`,
ExposureTime `1/120`, FNumber `1.8`, ISO `80`, FocalLength `6.9 mm` and a GPSPosition of 35 deg 41'
22.20" N, 139 deg 41' 30.12" E; and `ffprobe -show_entries format_tags` read the clip's
`com.apple.quicktime.creationdate` `2026-01-10T16:20:00+0800`, `com.apple.quicktime.make` `Apple`,
`com.apple.quicktime.model` `iPhone 15 Pro`, and `location` and `location-eng` `+35.6895+139.6917/`.

The ninth was added in M8 ticket 08, with ffmpeg 8.1.3 and Node 22 in the same throwaway
container, made without a phone: `motion-photo.jpg` is an Android motion photo in Google's
container format, a still with a two-second clip joined after it and named in its XMP:

```sh
docker run --rm -v "$PWD/e2e/fixtures:/out" node:22-alpine sh -c '
  apk add --no-cache ffmpeg && cd /tmp &&
  # A 640x480 frame of testsrc2, and two seconds of it as H.264 with no sound.
  ffmpeg -y -f lavfi -i testsrc2=size=640x480 -frames:v 1 -q:v 3 still.jpg &&
  ffmpeg -y -f lavfi -i testsrc2=size=640x480:rate=30 -t 2 -c:v libx264 -preset veryfast -pix_fmt yuv420p -an motion.mp4 &&
  # SOI, an APP1 segment with the XMP of a Google motion photo whose MotionPhoto item is the clip, the still from its byte 2, and the clip.
  node -e "
    const fs = require(\"fs\");
    const still = fs.readFileSync(\"still.jpg\");
    const clip = fs.readFileSync(\"motion.mp4\");
    const q = String.fromCharCode(34);
    const a = (name, value) => \" \" + name + \"=\" + q + value + q;
    const item = (mime, semantic, length) => \"<rdf:li rdf:parseType=\" + q + \"Resource\" + q + \"><Container:Item\" + a(\"Item:Mime\", mime) + a(\"Item:Semantic\", semantic) + a(\"Item:Length\", length) + a(\"Item:Padding\", 0) + \"/></rdf:li>\";
    const xmp = \"<x:xmpmeta\" + a(\"xmlns:x\", \"adobe:ns:meta/\") + \"><rdf:RDF\" + a(\"xmlns:rdf\", \"http://www.w3.org/1999/02/22-rdf-syntax-ns#\") + \"><rdf:Description\" + a(\"rdf:about\", \"\")
      + a(\"xmlns:GCamera\", \"http://ns.google.com/photos/1.0/camera/\") + a(\"xmlns:Container\", \"http://ns.google.com/photos/1.0/container/\") + a(\"xmlns:Item\", \"http://ns.google.com/photos/1.0/container/item/\")
      + a(\"GCamera:MotionPhoto\", 1) + a(\"GCamera:MotionPhotoVersion\", 1) + a(\"GCamera:MotionPhotoPresentationTimestampUs\", 1000000)
      + \"><Container:Directory><rdf:Seq>\" + item(\"image/jpeg\", \"Primary\", 0) + item(\"video/mp4\", \"MotionPhoto\", clip.length) + \"</rdf:Seq></Container:Directory></rdf:Description></rdf:RDF></x:xmpmeta>\";
    const body = Buffer.concat([Buffer.from(\"http://ns.adobe.com/xap/1.0/\0\"), Buffer.from(xmp)]);
    const header = Buffer.from([0xff, 0xd8, 0xff, 0xe1, (body.length + 2) >> 8, (body.length + 2) & 255]);
    fs.writeFileSync(\"/out/motion-photo.jpg\", Buffer.concat([header, body, still.subarray(2), clip]));
    console.log(\"still\", still.length, \"clip\", clip.length);
  "'
```

It printed `still 24699 clip 214956`; the photo is 240,493 bytes, its clip the last 214,956.

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
`photo-exif.jpg` is 640×480 and carries the EXIF above, the GPS IFD included; `clip-tagged.mov`
is `clip-h264.mp4`'s streams, 640×480 at 30 frames a second for 4 seconds, with the tags above,
its location the string `+35.6895+139.6917/`. The test profile's `app` uses 64 KB upload parts
(`UPLOAD_TEST_PART_BYTES`), so all but the long clip span several parts.
`motion-photo.jpg` is a JPEG that `motionRange` (`src/album/motion.ts`) finds a 2-second H.264
clip in, 640×480 with no sound, from byte 25,537 to the end; sharp reads it as a 640×480 JPEG,
which the clip after its end does not disturb.

The last two were added in the whole-branch review's fix pass of M8 (finding 4), with ffmpeg 8.1.3
and Node 22 in the same throwaway container: `clip-hevc-tagged.mov` is `clip-hevc-1080p.mp4`
remuxed with `clip-tagged.mov`'s iPhone tags, so that its copies, one made from the clip as sent
and one from the stored original, can be read for them; `motion-photo-tagged.jpg` is
`motion-photo.jpg` made again with its clip tagged as an Android phone tags one, so that its
motion can be:

```sh
docker run --rm -v "$PWD/e2e/fixtures:/out" node:22-alpine sh -c '
set -e; apk add --no-cache ffmpeg; cd /out
# clip-hevc-1080p.mp4 remuxed into a .mov with an iPhone's tags and a location (the streams' creation
# time asked for here did not survive the copy: ffprobe reads none on them).
ffmpeg -v error -y -i clip-hevc-1080p.mp4 -c copy -tag:v hvc1 -map_metadata -1 \
  -metadata com.apple.quicktime.creationdate=2026-01-10T16:20:00+0800 -metadata com.apple.quicktime.make=Apple \
  -metadata "com.apple.quicktime.model=iPhone 15 Pro" -metadata location=+35.6895+139.6917/ -metadata location-eng=+35.6895+139.6917/ \
  -metadata:s creation_time=2026-01-10T08:20:00Z -movflags +use_metadata_tags clip-hevc-tagged.mov
cd /tmp
ffmpeg -v error -y -f lavfi -i testsrc2=size=640x480 -frames:v 1 -q:v 3 still.jpg
# Two seconds of testsrc2 as H.264 with no sound, tagged as an Android phone tags its clips.
ffmpeg -v error -y -f lavfi -i testsrc2=size=640x480:rate=30 -t 2 -c:v libx264 -preset veryfast -pix_fmt yuv420p -an \
  -metadata creation_time=2026-01-10T08:20:00Z -metadata location=+35.6895+139.6917/ -metadata com.android.version=14 \
  -metadata com.android.manufacturer=Google -metadata com.android.model=Pixel\ 8 -metadata:s creation_time=2026-01-10T08:20:00Z \
  -movflags +use_metadata_tags motion.mp4
node -e "
  const fs = require(\"fs\");
  const still = fs.readFileSync(\"still.jpg\");
  const clip = fs.readFileSync(\"motion.mp4\");
  const q = String.fromCharCode(34);
  const a = (name, value) => \" \" + name + \"=\" + q + value + q;
  const item = (mime, semantic, length) => \"<rdf:li rdf:parseType=\" + q + \"Resource\" + q + \"><Container:Item\" + a(\"Item:Mime\", mime) + a(\"Item:Semantic\", semantic) + a(\"Item:Length\", length) + a(\"Item:Padding\", 0) + \"/></rdf:li>\";
  const xmp = \"<x:xmpmeta\" + a(\"xmlns:x\", \"adobe:ns:meta/\") + \"><rdf:RDF\" + a(\"xmlns:rdf\", \"http://www.w3.org/1999/02/22-rdf-syntax-ns#\") + \"><rdf:Description\" + a(\"rdf:about\", \"\")
    + a(\"xmlns:GCamera\", \"http://ns.google.com/photos/1.0/camera/\") + a(\"xmlns:Container\", \"http://ns.google.com/photos/1.0/container/\") + a(\"xmlns:Item\", \"http://ns.google.com/photos/1.0/container/item/\")
    + a(\"GCamera:MotionPhoto\", 1) + a(\"GCamera:MotionPhotoVersion\", 1) + a(\"GCamera:MotionPhotoPresentationTimestampUs\", 1000000)
    + \"><Container:Directory><rdf:Seq>\" + item(\"image/jpeg\", \"Primary\", 0) + item(\"video/mp4\", \"MotionPhoto\", clip.length) + \"</rdf:Seq></Container:Directory></rdf:Description></rdf:RDF></x:xmpmeta>\";
  const body = Buffer.concat([Buffer.from(\"http://ns.adobe.com/xap/1.0/\0\"), Buffer.from(xmp)]);
  const header = Buffer.from([0xff, 0xd8, 0xff, 0xe1, (body.length + 2) >> 8, (body.length + 2) & 255]);
  fs.writeFileSync(\"/out/motion-photo-tagged.jpg\", Buffer.concat([header, body, still.subarray(2), clip]));
  console.log(\"still\", still.length, \"clip\", clip.length);
"
'
```

It printed `still 24699 clip 215316`. `ffprobe -show_entries format_tags:stream_tags` then read
`clip-hevc-tagged.mov`'s `com.apple.quicktime.creationdate`, `com.apple.quicktime.make`,
`com.apple.quicktime.model`, `location` and `location-eng`, and the motion clip's
`creation_time` (on the container and its stream), `location`, `location-eng`,
`com.android.version`, `com.android.manufacturer` and `com.android.model`, beside the container's
own `major_brand`, `minor_version`, `compatible_brands`, `encoder`, `handler_name`, `vendor_id` and
`language`.
