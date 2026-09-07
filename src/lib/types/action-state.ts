/**
 * Shared return shape for Server Actions used with React 19's
 * `useActionState`. Every mutation form in this app follows the same
 * pattern: the action validates input, calls the feature's repository
 * (api.ts), and returns `{ error }` on failure instead of throwing, so the
 * client component can render the message inline without extra state
 * plumbing. Success is a `redirect()` call, which throws internally and
 * never returns to the caller.
 */
export type ActionState = {
  error?: string;
};

export const initialActionState: ActionState = {};
