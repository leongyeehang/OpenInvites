# Next.js and TypeScript full stack

The maintainer knows Docker and SQL but not JavaScript, and will rely heavily on AI agents and outside contributors. We chose the most mainstream stack for open source self-hostable web apps (as used by Cal.com, Rallly, Formbricks, Documenso, Dub): Next.js with TypeScript, Tailwind CSS with shadcn/ui, Motion for animation, Drizzle ORM on Postgres, and Better Auth for login. SvelteKit was the serious alternative and is lighter, but its contributor pool and component ecosystem are much smaller, and the polish we want comes from the design system and motion work rather than the framework.

## Consequences

- Every login method (email and password, Google, Apple, GitHub, magic link, passkeys) is a Better Auth plugin, so adding one is configuration plus operator setup, not new code.
- The Docker image is built from Next.js standalone output.
