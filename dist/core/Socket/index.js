"use strict";

Object.defineProperty(exports, "__esModule", { value: true });

const { DEFAULT_CONNECTION_CONFIG } = require("../Defaults");
const { makeBusinessSocket } = require("./business");

let __SINGLE_ACTIVE__ = null;

function safeClose(sock) {
  try { sock?.ev?.removeAllListeners?.(); } catch {}
  try { sock?.ws?.removeAllListeners?.(); } catch {}
  try { sock?.ws?.terminate?.(); } catch {}
  try { sock?.ws?.close?.(); } catch {}
}

const makeWASocket = (config = {}) => {
  const singleInstance = !!config.singleInstance;

  if (singleInstance && __SINGLE_ACTIVE__) {
    safeClose(__SINGLE_ACTIVE__);
    __SINGLE_ACTIVE__ = null;
  }

  const sock = makeBusinessSocket({
    ...DEFAULT_CONNECTION_CONFIG,
    ...config,
  });

  if (singleInstance) __SINGLE_ACTIVE__ = sock;

  return sock;
};

exports.default = makeWASocket;
exports.makeWASocket = makeWASocket;
exports.safeCloseSocket = safeClose;
