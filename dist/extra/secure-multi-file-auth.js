"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const { BufferJSON, initAuthCreds } = require("../core");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function setStrictPerms(file) {
  // Best-effort: on Windows this is ignored.
  try { fs.chmodSync(file, 0o600); } catch {}
}

function atomicWrite(file, data) {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, data);
  setStrictPerms(tmp);
  fs.renameSync(tmp, file);
  setStrictPerms(file);
}

function safeRead(file) {
  try {
    if (!fs.existsSync(file)) return null;
    const raw = fs.readFileSync(file);
    if (!raw || !raw.length) return null;
    return raw;
  } catch {
    return null;
  }
}

function deriveKey(passphrase, salt) {
  // 32 bytes key
  return crypto.scryptSync(String(passphrase), salt, 32);
}

function encryptJSON(obj, passphrase, saltOpt) {
  const salt = saltOpt || crypto.randomBytes(16);
  const key = deriveKey(passphrase, salt);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(obj), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    v: 1,
    alg: "aes-256-gcm",
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: ciphertext.toString("base64"),
  };
}

function decryptJSON(payload, passphrase) {
  if (!payload || payload.v !== 1 || payload.alg !== "aes-256-gcm") {
    throw new Error("Invalid encrypted auth payload");
  }
  const salt = Buffer.from(payload.salt, "base64");
  const key = deriveKey(passphrase, salt);
  const iv = Buffer.from(payload.iv, "base64");
  const tag = Buffer.from(payload.tag, "base64");
  const data = Buffer.from(payload.data, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(plain.toString("utf8"), BufferJSON.reviver);
}

function safeReadJSON(file) {
  try {
    const raw = safeRead(file);
    if (!raw) return null;
    return JSON.parse(raw.toString("utf8"), BufferJSON.reviver);
  } catch {
    return null;
  }
}

const useEncryptedMultiFileAuthState = (folder, passphrase, opts = {}) => {
  if (!passphrase) {
    throw new Error("useEncryptedMultiFileAuthState requires a passphrase");
  }
  const { credsFileName = "creds.enc.json", keyFilePrefix = "key-" } = opts;

  ensureDir(folder);

  const credsFile = path.join(folder, credsFileName);

  const state = {
    creds: (() => {
      const enc = safeReadJSON(credsFile);
      if (!enc) return initAuthCreds();
      try {
        return decryptJSON(enc, passphrase);
      } catch {
        // fallback: treat as plaintext creds (migration)
        const plain = safeReadJSON(credsFile);
        return plain || initAuthCreds();
      }
    })(),
    keys: {
      get: (type, ids) => {
        const data = {};
        for (const id of ids) {
          const file = path.join(folder, `${keyFilePrefix}${type}-${id}.enc.json`);
          const enc = safeReadJSON(file);
          if (!enc) continue;
          try {
            data[id] = decryptJSON(enc, passphrase);
          } catch {
            // ignore corrupt key
          }
        }
        return data;
      },
      set: (data) => {
        for (const type of Object.keys(data || {})) {
          for (const id of Object.keys(data[type] || {})) {
            const file = path.join(folder, `${keyFilePrefix}${type}-${id}.enc.json`);
            const payload = encryptJSON(data[type][id], passphrase);
            atomicWrite(file, Buffer.from(JSON.stringify(payload)));
          }
        }
      },
    },
  };

  const saveCreds = () => {
    const payload = encryptJSON(state.creds, passphrase);
    atomicWrite(credsFile, Buffer.from(JSON.stringify(payload)));
  };

  return { state, saveCreds };
};

module.exports = {
  useEncryptedMultiFileAuthState,
  default: useEncryptedMultiFileAuthState,
};
