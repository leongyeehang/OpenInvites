"use client";

import { useEffect, useRef, type RefObject } from "react";

// A button disabled while its form's action runs loses the focus to the page, and a keyboard user
// would have to find their place again. Given whether the action is pending, this gives the focus
// back to the button once it is done, when the button had it as the form was sent (M6 ticket 10):
// the ref goes on the button, and the function on the form's onSubmit.
export function useFocusKept(pending: boolean): [RefObject<HTMLButtonElement | null>, () => void] {
  const button = useRef<HTMLButtonElement>(null);
  const hadFocus = useRef(false);
  useEffect(() => {
    if (pending || !hadFocus.current) return;
    hadFocus.current = false;
    if (document.activeElement === null || document.activeElement === document.body) button.current?.focus();
  }, [pending]);
  const sent = () => {
    hadFocus.current = document.activeElement === button.current;
  };
  return [button, sent];
}
