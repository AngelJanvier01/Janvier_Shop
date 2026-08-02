import { verifyProposalInviteCode } from "./invite-security";

export const proposalVerificationMethod = "INVITE_CODE" as const;

export type ProposalAcceptanceVerificationAdapter = {
  method: typeof proposalVerificationMethod;
  verify(input: { code: string; codeHash: string }): Promise<boolean>;
};

// Adaptador de desarrollo: el código de la invitación es la segunda prueba de posesión.
// Un proveedor de correo/SMS puede implementar este mismo contrato sin cambiar aceptación.
export const developmentInviteCodeVerification: ProposalAcceptanceVerificationAdapter = {
  method: proposalVerificationMethod,
  verify({ code, codeHash }) {
    return verifyProposalInviteCode(code, codeHash);
  }
};
