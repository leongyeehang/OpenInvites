"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useEditor } from "./status";

// A sheet's Done: saves, closes once it has, and says why beside it when it has not.
export function useSaving(onOpenChange: (open: boolean) => void) {
  const { save } = useEditor();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const run = async (task: Parameters<typeof save>[0]) => {
    setPending(true);
    setError(undefined);
    let failed: string | undefined;
    const saved = await save(async () => {
      const result = await task();
      if (!result.saved) failed = result.error;
      return result;
    });
    setPending(false);
    if (saved) onOpenChange(false);
    else setError(failed);
  };
  return { error, pending, run, clear: () => setError(undefined) };
}

export function Footer({ pending, error, label }: { pending: boolean; error?: string; label: string }) {
  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {label}
      </Button>
    </div>
  );
}
