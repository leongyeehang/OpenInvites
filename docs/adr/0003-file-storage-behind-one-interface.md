# Uploaded files go through one storage interface, local disk by default

Hosts upload background images. A public instance needs S3-compatible object storage; a home self-hoster should need nothing beyond a disk volume. All file reads and writes go through a single storage interface with two implementations: local disk (default, a Docker volume) and S3-compatible. The application code never touches either directly. This keeps the two-container Compose setup the only requirement for self-hosting while letting the public instance scale storage independently.
