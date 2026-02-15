"use strict";

const fs = require("fs");
const path = require("path");

const { BufferJSON, initAuthCreds } = require("../core");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function safeReadJSON(file) {
  try {
    if (!fs.existsSync(file)) return null;
    const raw = fs.readFileSync(file, "utf8");
    if (!raw) return null;
    return JSON.parse(raw, BufferJSON.reviver);
  } catch {
    return null;
  }
}

function atomicWriteJSON(file, data) {
  ensureDir(path.dirname(file));
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, BufferJSON.replacer, 2), "utf8");
  fs.renameSync(tmp, file);
}

/**
 * Multi-file auth state (more stable for long-running bots).
 * Layout:
 *  <folder>/creds.json
 *  <folder>/keys/<type>/<id>.json
 */
const useMultiFileAuthState = (folder = "./sessions/default") => {
  const base = path.resolve(folder);
  const credsFile = path.join(base, "creds.json");
  const keysDir = path.join(base, "keys");

  ensureDir(base);
  ensureDir(keysDir);

  const creds = safeReadJSON(credsFile) || initAuthCreds();

  const state = {
    creds,
    keys: {
      get(type, ids) {
        const out = {};
        const dir = path.join(keysDir, String(type));
        for (const id of ids) {
          const file = path.join(dir, `${id}.json`);
          const v = safeReadJSON(file);
          if (v != null) out[id] = v;
        }
        return out;
      },
      set(data) {
        for (const type of Object.keys(data || {})) {
          const dir = path.join(keysDir, String(type));
          ensureDir(dir);
          for (const id of Object.keys(data[type] || {})) {
            const value = data[type][id];
            const file = path.join(dir, `${id}.json`);
            if (value == null) {
              try { fs.unlinkSync(file); } catch {}
            } else {
              atomicWriteJSON(file, value);
            }
          }
        }
      },
    },
  };

  const saveCreds = () => atomicWriteJSON(credsFile, state.creds);

  return { state, saveCreds };
};

module.exports = {
  useMultiFileAuthState,
  default: useMultiFileAuthState,
};
