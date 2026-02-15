"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
exports.useSQLiteAuth = void 0;

const BetterSqlite = require("better-sqlite3");
const { BufferJSON } = require("../index");
const { initAuthCreds } = require("../Utils");

const db = new BetterSqlite("./session.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS auth (
    id TEXT PRIMARY KEY,
    data TEXT
  )
`);

const useSQLiteAuth = () => {
    const readData = (id) => {
        const row = db.prepare("SELECT data FROM auth WHERE id=?").get(id);
        return row ? JSON.parse(row.data, BufferJSON.reviver) : null;
    };

    const writeData = (id, data) => {
        db.prepare("INSERT OR REPLACE INTO auth VALUES (?, ?)")
          .run(id, JSON.stringify(data, BufferJSON.replacer));
    };

    const state = {
        creds: readData("creds") || initAuthCreds(),
        keys: {
            get(type, ids) {
                const data = {};
                for (const id of ids) {
                    const value = readData(`${type}-${id}`);
                    if (value) data[id] = value;
                }
                return data;
            },
            set(data) {
                for (const type in data) {
                    for (const id in data[type]) {
                        writeData(`${type}-${id}`, data[type][id]);
                    }
                }
            }
        }
    };

    const saveCreds = () => writeData("creds", state.creds);

    return { state, saveCreds };
};

exports.useSQLiteAuth = useSQLiteAuth;
exports.default = useSQLiteAuth;
