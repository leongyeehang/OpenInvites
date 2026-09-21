// What a form gets back from its server action: nothing on success when the action
// redirects, or one message to show under the form.
export type FormState = { error?: string; success?: string } | undefined;
