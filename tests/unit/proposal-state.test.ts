import { describe, expect, it } from "vitest";

import {
  assertProposalCanCreateRevision,
  assertProposalCanSelectOption,
  assertProposalCanShare,
  canTransitionProposal,
  createDraftProposalState,
  proposalStatus,
  ProposalStateError,
  transitionProposal
} from "../../lib/proposals/proposal-state";

const validTransitions = [
  [proposalStatus.DRAFT, proposalStatus.SENT],
  [proposalStatus.SENT, proposalStatus.VIEWED],
  [proposalStatus.SENT, proposalStatus.ACCEPTED],
  [proposalStatus.SENT, proposalStatus.DECLINED],
  [proposalStatus.SENT, proposalStatus.EXPIRED],
  [proposalStatus.VIEWED, proposalStatus.CHANGES_REQUESTED],
  [proposalStatus.VIEWED, proposalStatus.ACCEPTED],
  [proposalStatus.VIEWED, proposalStatus.DECLINED],
  [proposalStatus.VIEWED, proposalStatus.EXPIRED],
  [proposalStatus.CHANGES_REQUESTED, proposalStatus.DRAFT],
  [proposalStatus.CHANGES_REQUESTED, proposalStatus.EXPIRED]
] as const;

describe("proposal state machine", () => {
  it("inicia cualquier creación nueva como borrador", () => {
    expect(createDraftProposalState()).toEqual({ status: proposalStatus.DRAFT });
  });

  it("permite únicamente las transiciones explícitas", () => {
    const statuses = Object.values(proposalStatus);
    const permitted = new Set(validTransitions.map(([from, to]) => `${from}:${to}`));

    for (const from of statuses) {
      for (const to of statuses) {
        const key = `${from}:${to}`;
        expect(canTransitionProposal(from, to)).toBe(permitted.has(key));
        if (permitted.has(key)) {
          expect(transitionProposal(from, to)).toEqual({ status: to });
        } else {
          expect(() => transitionProposal(from, to)).toThrow(ProposalStateError);
        }
      }
    }
  });

  it("no permite degradar propuestas terminales al abrir una invitación", () => {
    expect(() =>
      transitionProposal(proposalStatus.ACCEPTED, proposalStatus.VIEWED)
    ).toThrow(ProposalStateError);
    expect(() =>
      transitionProposal(proposalStatus.DECLINED, proposalStatus.VIEWED)
    ).toThrow(ProposalStateError);
  });

  it("protege compartir, editar y seleccionar fuera de sus estados permitidos", () => {
    expect(() => assertProposalCanShare(proposalStatus.SENT)).toThrow(ProposalStateError);
    expect(() => assertProposalCanCreateRevision(proposalStatus.ACCEPTED)).toThrow(
      ProposalStateError
    );
    expect(() => assertProposalCanSelectOption(proposalStatus.ACCEPTED)).toThrow(
      ProposalStateError
    );
    expect(() => assertProposalCanSelectOption(proposalStatus.DECLINED)).toThrow(
      ProposalStateError
    );
  });
});
