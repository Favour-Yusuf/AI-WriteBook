"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/shared/error-state";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      className="mt-10"
      title="This page couldn't load"
      description="Something went wrong on our side. Try again, and if it keeps happening, refresh the page."
      onRetry={reset}
    />
  );
}
