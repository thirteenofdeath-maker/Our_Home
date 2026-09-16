import { signOutAction } from "../actions";
import { SignOutSubmitButton } from "./SignOutSubmitButton";

export function SignOutForm() {
  return (
    <form action={signOutAction}>
      <SignOutSubmitButton />
    </form>
  );
}
