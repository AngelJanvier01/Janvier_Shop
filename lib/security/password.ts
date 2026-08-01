import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: string,
  keyLength: number
) => Promise<Buffer>;
const minimumPasswordLength = 12;
const derivedKeyLength = 64;

function assertPassword(password: string) {
  if (password.length < minimumPasswordLength || password.length > 256) {
    throw new Error(`Passwords must contain ${minimumPasswordLength} to 256 characters.`);
  }
}

export async function hashPassword(password: string) {
  assertPassword(password);
  const salt = randomBytes(16).toString("base64url");
  const derivedKey = await scrypt(password, salt, derivedKeyLength);
  return `scrypt-v1.${salt}.${derivedKey.toString("base64url")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [version, salt, encodedKey] = storedHash.split(".");
  if (version !== "scrypt-v1" || !salt || !encodedKey || password.length > 256) {
    return false;
  }

  const expected = Buffer.from(encodedKey, "base64url");
  if (expected.length !== derivedKeyLength) {
    return false;
  }

  const derivedKey = await scrypt(password, salt, expected.length);
  return timingSafeEqual(expected, derivedKey);
}
