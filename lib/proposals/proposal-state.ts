import type { ProposalStatus } from "@/app/generated/prisma/client";

export const proposalStatus = {
  ACCEPTED: "ACCEPTED",
  CHANGES_REQUESTED: "CHANGES_REQUESTED",
  DECLINED: "DECLINED",
  DRAFT: "DRAFT",
  EXPIRED: "EXPIRED",
  REPLACED: "REPLACED",
  SENT: "SENT",
  VIEWED: "VIEWED"
} as const satisfies Record<string, ProposalStatus>;

export class ProposalStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProposalStateError";
  }
}

const transitions: Record<ProposalStatus, readonly ProposalStatus[]> = {
  ACCEPTED: [],
  CHANGES_REQUESTED: [proposalStatus.DRAFT, proposalStatus.EXPIRED],
  DECLINED: [],
  DRAFT: [proposalStatus.SENT],
  EXPIRED: [],
  REPLACED: [],
  SENT: [
    proposalStatus.DRAFT,
    proposalStatus.VIEWED,
    proposalStatus.ACCEPTED,
    proposalStatus.DECLINED,
    proposalStatus.EXPIRED
  ],
  VIEWED: [
    proposalStatus.DRAFT,
    proposalStatus.CHANGES_REQUESTED,
    proposalStatus.ACCEPTED,
    proposalStatus.DECLINED,
    proposalStatus.EXPIRED
  ]
};

const readableProposalStatuses: ProposalStatus[] = [
  proposalStatus.SENT,
  proposalStatus.VIEWED,
  proposalStatus.CHANGES_REQUESTED,
  proposalStatus.ACCEPTED,
  proposalStatus.DECLINED
];

export function isTerminalProposalStatus(status: ProposalStatus) {
  return transitions[status].length === 0;
}

export function canTransitionProposal(from: ProposalStatus, to: ProposalStatus) {
  return transitions[from].includes(to);
}

export function transitionProposal(from: ProposalStatus, to: ProposalStatus) {
  if (!canTransitionProposal(from, to)) {
    throw new ProposalStateError(`Transición de propuesta inválida: ${from} → ${to}.`);
  }
  return { status: to } as const;
}

export function createDraftProposalState() {
  return { status: proposalStatus.DRAFT } as const;
}

export function assertProposalCanShare(status: ProposalStatus) {
  if (status !== proposalStatus.DRAFT) {
    throw new ProposalStateError("Sólo una propuesta en borrador puede compartirse.");
  }
}

export function assertProposalCanCreateRevision(status: ProposalStatus) {
  if (
    status !== proposalStatus.SENT &&
    status !== proposalStatus.VIEWED &&
    status !== proposalStatus.CHANGES_REQUESTED
  ) {
    throw new ProposalStateError(
      "Sólo una propuesta enviada, vista o con ajustes solicitados puede abrir una revisión nueva."
    );
  }
}

export function canCreateEditableProposalRevision(status: ProposalStatus) {
  return (
    status === proposalStatus.SENT ||
    status === proposalStatus.VIEWED ||
    status === proposalStatus.CHANGES_REQUESTED
  );
}

export function assertProposalCanSelectOption(status: ProposalStatus) {
  if (status !== proposalStatus.SENT && status !== proposalStatus.VIEWED) {
    throw new ProposalStateError("La alternativa ya no puede modificarse.");
  }
}

export function assertProposalCanDecide(
  status: ProposalStatus,
  decision: "ACCEPT" | "DECLINE" | "REQUEST_CHANGES"
) {
  const target =
    decision === "ACCEPT"
      ? proposalStatus.ACCEPTED
      : decision === "DECLINE"
        ? proposalStatus.DECLINED
        : proposalStatus.CHANGES_REQUESTED;
  transitionProposal(status, target);
  return target;
}

export function shouldRecordProposalView(status: ProposalStatus) {
  return status === proposalStatus.SENT;
}

export function canReadProjectRoom(status: ProposalStatus, isSharedRevision = false) {
  return (
    readableProposalStatuses.includes(status) ||
    (status === proposalStatus.DRAFT && isSharedRevision)
  );
}
