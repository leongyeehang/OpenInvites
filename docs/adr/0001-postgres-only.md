# Postgres is the only supported database

The target deployment is a public multi-host instance, later self-hosted on the maintainer's own machine. SQLite would make single-container self-hosting simpler, but it caps concurrent writes and would mean either supporting two engines (doubling migration and test effort) or migrating later under load. We support Postgres only and accept that self-hosters run two containers via Docker Compose.
