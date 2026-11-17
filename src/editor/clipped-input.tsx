"use client";

import { useRef, useState, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { clipCharacters } from "@/sections";

// A field the Arrange sheet and its sections' sheets type into (M8 tickets 28 and 29): a heading,
// a link's label or address. What is typed or pasted past `max` characters is cut by script, as
// the server counts them (SECTION_LIMITS), where an input's maxLength counts UTF-16 units and would
// stop forty emoji at twenty. While a word is still being composed (a Chinese input method), it is
// left alone until it is. `onType` hears each value kept.
export function ClippedInput({
  initial,
  max,
  onType,
  ...props
}: Omit<ComponentProps<typeof Input>, "value" | "defaultValue" | "onChange" | "maxLength"> & { initial: string; max: number; onType: (text: string) => void }) {
  const [value, setValue] = useState(initial);
  const composing = useRef(false);
  const take = (text: string) => {
    const kept = clipCharacters(text, max);
    setValue(kept);
    onType(kept);
  };
  return (
    <Input
      {...props}
      value={value}
      onChange={(event) => (composing.current ? setValue(event.target.value) : take(event.target.value))}
      onCompositionStart={() => {
        composing.current = true;
      }}
      onCompositionEnd={(event) => {
        composing.current = false;
        take(event.currentTarget.value);
      }}
    />
  );
}
