/**
 * Shared return shape for Server Actions used with React 19's
 * `useActionState`. Every mutation form in this app follows the same
 * pattern: the action validates input, calls the feature's repository
 * (api.ts), and returns `{ error }` on failure instead of throwing, so the
 * client component can render the message inline without extra state
 * plumbing. Most successful page forms redirect; an in-place sheet form
 * may instead return `{ success: true }` so its client owner can close it.
 */
export type ActionState = {
  error?: string;
  success?: boolean;
};

export const initialActionState: ActionState = {};
