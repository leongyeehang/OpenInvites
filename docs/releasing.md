# Releasing

For the maintainer. A release is a Git tag; the images are built and published by
`.github/workflows/release.yml`, and nothing is pushed from a laptop.

## What a tag does

Pushing a tag of the form `v1.2.3` runs, in order:

1. **Checks**: the whole of `ci.yml` (lint, types, unit tests, the S3 smoke test, and the browser
   suite against the production image). If any of it fails, nothing is published.
2. **Build and push**: the image for `linux/amd64` and `linux/arm64` (the arm64 one built under
   QEMU emulation), pushed to GitHub Container Registry, and to Docker Hub once its secrets are
   set (below), with the release's own tag, `1.2.3`, and no other yet.
3. **Smoke test**: `deploy/smoke-test.sh` starts `deploy/compose.yaml` from the image just
   pushed, by digest, on an amd64 runner and on an arm64 one (`ubuntu-24.04-arm`, GitHub's
   arm64 hardware, free for public repositories), and checks both health checks,
   `/api/health`, that the app is not root, that the picture library loads, and that the
   password reset command reaches the database.
4. **Move the tags**: only once both smoke tests have passed do `1.2`, `1` and `latest` point
   at that image, by digest, in every registry it was pushed to. A pre-release such as `v1.3.0-rc.1` gets only
   `1.3.0-rc.1`; a 0.x release gets no tag of its major version alone.

If a smoke test fails, `1.2.3` is published but nothing an operator follows has moved to it: fix
the fault and release `1.2.4`.

The same smoke test runs anywhere with Docker, against any image:

```sh
deploy/smoke-test.sh ghcr.io/leongyeehang/openinvites:1.2.3
```

## Repository settings it needs

Under **Settings → Secrets and variables → Actions**:

| Kind | Name | Value |
| --- | --- | --- |
| Secret, optional | `DOCKERHUB_USERNAME` | The Docker Hub account that pushes. |
| Secret, optional | `DOCKERHUB_TOKEN` | A Docker Hub personal access token for that account, with Read & Write access. |
| Variable, optional | `DOCKERHUB_NAMESPACE` | The Docker Hub user or organisation the image lives under. Default: the GitHub owner's name. |
| Variable, optional | `IMAGE_NAME` | The image's name in both registries. Default: `openinvites`. |

GitHub Container Registry needs nothing: the workflow pushes to
`ghcr.io/<owner, lowercased>/<IMAGE_NAME>` with its own `GITHUB_TOKEN`. Docker Hub is used only
when both of its secrets are set; without them a release goes to GitHub Container Registry alone,
and the next release after they are added goes to both. The Docker Hub
repository `<DOCKERHUB_NAMESPACE>/<IMAGE_NAME>` is created by the first push if the account may
create it; otherwise create it first on Docker Hub.

After the first release, open the package on GitHub (the repository's **Packages**), check it is
linked to the repository, and set its visibility to public under **Package settings**, so that
operators can pull it without signing in.

The operator documentation names the images `ghcr.io/leongyeehang/openinvites` and
`leongyeehang/openinvites`. If `IMAGE_NAME` or `DOCKERHUB_NAMESPACE` change, change
`deploy/compose.yaml`, `deploy/.env.example`, and `docs/operator/` to match.

## Cutting a release

```sh
git tag -a v1.2.3 -m "OpenInvites 1.2.3"
git push origin v1.2.3
```

Then watch the Release workflow. Write the release notes on GitHub, saying whether the
deployment files changed and anything an operator must do, since operators are told to read
them before upgrading (`docs/operator/upgrade-backup.md`).
