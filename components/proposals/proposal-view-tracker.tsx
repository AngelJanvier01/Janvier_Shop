"use client";

import { useEffect, useRef } from "react";

type ProposalViewTrackerProps = {
  token: string;
};

/** Keeps the write outside Server Component rendering and counts each document mount once. */
export function ProposalViewTracker({ token }: ProposalViewTrackerProps) {
  const recorded = useRef(false);

  useEffect(() => {
    if (recorded.current) {
      return;
    }
    recorded.current = true;
    void fetch(`/api/propuesta/${encodeURIComponent(token)}/view`, {
      cache: "no-store",
      credentials: "same-origin",
      method: "POST"
    });
  }, [token]);

  return null;
}
