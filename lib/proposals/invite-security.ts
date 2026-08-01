import {
  createHash,
  randomBytes,
  randomInt,
  scrypt as scryptCallback,
  timingSafeEqual
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: string,
  keyLength: number
) => Promise<Buffer>;
const codeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type ProposalInviteCredentials = {
  accessCode: string;
  accessCodeHash: string;
  token: string;
  tokenHash: string;
};

function createAccessCode() {
  return Array.from({ length: 8 }, (_, index) => {
    const character = codeAlphabet[randomInt(codeAlphabet.length)];
    return index === 4 ? `-${character}` : character;
  }).join("");
}

function normalizeAccessCode(code: string) {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

async function hashAccessCode(code: string) {
  const salt = randomBytes(16).toString("base64url");
  const derivedKey = await scrypt(normalizeAccessCode(code), salt, 64);
  return `${salt}.${Buffer.from(derivedKey).toString("base64url")}`;
}

export function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}

export async function createProposalInviteCredentials(): Promise<ProposalInviteCredentials> {
  const token = randomBytes(32).toString("base64url");
  const accessCode = createAccessCode();

  return {
    accessCode,
    accessCodeHash: await hashAccessCode(accessCode),
    token,
    tokenHash: hashInviteToken(token)
  };
}

export async function verifyProposalInviteCode(code: string, storedHash: string) {
  const [salt, encodedKey] = storedHash.split(".");
  if (!salt || !encodedKey) {
    return false;
  }

  const expected = Buffer.from(encodedKey, "base64url");
  const derivedKey = Buffer.from(
    await scrypt(normalizeAccessCode(code), salt, expected.length)
  );

  return (
    expected.length === derivedKey.length && timingSafeEqual(expected, derivedKey)
  );
}
