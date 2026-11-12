// The album vote's one public entry (ADR-0008): the rest of the app imports "@/voting", never a
// file inside it. It carries the repository, so it is for server code alone. It gives only what the
// rest of the app uses, with the types those signatures name (the voting part's review): the
// album's hook, the Settings block, the drafts the Announcements page starts from, and a
// duplicate's awards. A narrow entry is what lets the module be lifted out.
export { albumVotingFor, type AlbumVoting, type AlbumVotingInput, type AlbumVotingItem } from "./album-voting";
export { votingDraft, type VotingDraftKind } from "./drafts";
export { copyAwards } from "./repository";
export { VotingSettings } from "./voting-settings";
