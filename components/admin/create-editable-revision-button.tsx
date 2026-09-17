"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createEditableProposalRevision } from "@/app/(admin)/admin/propuestas/actions";

type CreateEditableRevisionButtonProps = {
  proposalId: string;
};

export function CreateEditableRevisionButton({
  proposalId
}: CreateEditableRevisionButtonProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function createRevision() {
    setError(null);
    startTransition(async () => {
      const result = await createEditableProposalRevision(proposalId);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <button disabled={isPending} onClick={createRevision} type="button">
        {isPending ? "Creando revisión..." : "Crear revisión editable"}
      </button>
      {error ? <small role="alert">{error}</small> : null}
    </div>
  );
}
