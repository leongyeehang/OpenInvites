// The album vote's one public entry (ADR-0008): the rest of the app imports "@/voting", never a
// file inside it. It carries the repository, so it is for server code alone; a client component
// outside the module imports its types only.
export * from "./voting";
export { copyAwards, type Award } from "./repository";
export { closeVotingAction, reopenVotingAction, startVotingAction, turnOffVotingAction } from "./host-actions";
export { VotingSettings } from "./voting-settings";
