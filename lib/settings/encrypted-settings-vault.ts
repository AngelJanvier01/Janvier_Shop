import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const version = 1;

type VaultContext = {
  fieldName: string;
  provider: string;
  recordId: string;
};

function key() {
  const encoded = process.env.SETTINGS_ENCRYPTION_KEY?.trim();
  if (!encoded) throw new Error("Falta SETTINGS_ENCRYPTION_KEY.");
  if (!/^[A-Za-z0-9_-]{43}$/u.test(encoded)) {
    throw new Error("SETTINGS_ENCRYPTION_KEY debe ser Base64 URL-safe de 32 bytes.");
  }
  const decoded = Buffer.from(encoded, "base64url");
  if (decoded.length !== 32 || decoded.toString("base64url") !== encoded)
    throw new Error("SETTINGS_ENCRYPTION_KEY debe tener 32 bytes.");
  return decoded;
}

function decodePart(value: string, expectedBytes?: number) {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) throw new Error("Secreto cifrado invalido.");
  const decoded = Buffer.from(value, "base64url");
  if (
    !decoded.length ||
    decoded.toString("base64url") !== value ||
    (expectedBytes !== undefined && decoded.length !== expectedBytes)
  ) {
    throw new Error("Secreto cifrado invalido.");
  }
  return decoded;
}

function aad(context: VaultContext) {
  return Buffer.from(JSON.stringify({ encryptionVersion: version, ...context }), "utf8");
}

/** AES-256-GCM vault for server-only delivery credentials. */
export const encryptedSettingsVault = {
  decrypt(ciphertext: string, context: VaultContext) {
    const [storedVersion, nonce, tag, payload] = ciphertext.split(".");
    if (storedVersion !== `v${version}` || !nonce || !tag || !payload) {
      throw new Error("Secreto cifrado invalido.");
    }
    try {
      const decipher = createDecipheriv("aes-256-gcm", key(), decodePart(nonce, 12));
      decipher.setAAD(aad(context));
      decipher.setAuthTag(decodePart(tag, 16));
      return Buffer.concat([
        decipher.update(decodePart(payload)),
        decipher.final()
      ]).toString("utf8");
    } catch {
      throw new Error("No fue posible descifrar la configuracion de entrega.");
    }
  },
  encrypt(value: string, context: VaultContext) {
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key(), nonce);
    cipher.setAAD(aad(context));
    const payload = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v${version}.${nonce.toString("base64url")}.${tag.toString("base64url")}.${payload.toString("base64url")}`;
  },
  version
};
