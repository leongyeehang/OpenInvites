# No telemetry, ever

The software never reports anything to the project. No usage counts, no version pings, no crash reports. Self-hosters choose self-hosting to control their data, and projects that add telemetry after the fact lose trust that does not come back. Operators who want visitor analytics for their own instance paste their own analytics snippet through one environment variable, and nothing loads unless they set it. Hosts get a per-event view count computed inside the instance with no third party.

## Consequences

- We measure adoption passively: GitHub stars and clones, Docker image pull counts.
- If an update check is ever wanted, it must be opt-in, off by default, documented, and must contact only GitHub's public releases endpoint. That is a separate decision and would supersede this ADR.
