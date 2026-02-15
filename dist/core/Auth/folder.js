"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
exports.useFileAuth = void 0;

const fs = require("fs");
const path = require("path");
const { BufferJSON } = require("../index");
const { initAuthCreds } = require("../Utils");

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
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, BufferJSON.replacer, 2), "utf8");
  fs.renameSync(tmp, file);
}

const useFileAuth = (filePath = "./session/session.json") => {
  const abs = path.resolve(filePath);

  // struktur data:
  // { creds: {...}, keys: { "pre-key": {id: value}, "session": {...} } }
  const store = safeReadJSON(abs) || { creds: null, keys: {} };

  const state = {
    creds: store.creds || initAuthCreds(),
    keys: {
      get(type, ids) {
        const out = {};
        const bucket = store.keys[type] || {};
        for (const id of ids) {
          const v = bucket[id];
          if (v != null) out[id] = v;
        }
        return out;
      },
      set(data) {
        for (const type in data) {
          store.keys[type] = store.keys[type] || {};
          for (const id in data[type]) {
            const v = data[type][id];
            if (v == null) {
              delete store.keys[type][id];
            } else {
              store.keys[type][id] = v;
            }
          }
        }
        atomicWriteJSON(abs, { creds: state.creds, keys: store.keys });
      },
    },
  };

  const saveCreds = () => {
    store.creds = state.creds;
    atomicWriteJSON(abs, { creds: state.creds, keys: store.keys });
  };

  return { state, saveCreds };
};

exports.useFileAuth = useFileAuth;
exports.default = useFileAuth;