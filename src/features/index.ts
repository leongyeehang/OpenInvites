// The feature list's one public entry (ADR-0008): the rest of the app imports "@/features", never
// a file inside it. It carries the repository, so it is for server code alone; a client component
// takes the switches as props and imports their types only.
export * from "./features";
export * from "./repository";
