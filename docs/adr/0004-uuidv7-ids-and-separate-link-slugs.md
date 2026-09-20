# UUIDv7 for internal IDs, a separate random slug for the event link

Every table uses UUIDv7 as its primary key: time-sorted like a ULID, but native to Postgres 18's `uuid` type and `uuidv7()` function. The event link uses a separate random slug (ten characters from a 62-character alphabet, about 59 bits) stored on the event, because the link is the access key. Keeping identity and access apart means the slug leaks nothing about creation time, stays short in a chat message, and can be reset by the host without changing the event's identity. ULID was considered for the link and rejected on all three counts.

## Consequences

- A host can "reset link", which issues a new slug and dead-ends the old one.
- Brute-forcing a slug is impractical only together with the rate limits on event page requests, which are therefore not optional.
- Event pages are never indexed or listed anywhere; the link is the only way in.
