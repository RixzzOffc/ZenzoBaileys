"use strict";

const { EventEmitter } = require("events");
const path = require("path");

const { makeWASocket, DisconnectReason } = require("../core");
const { useMultiFileAuthState } = require("./multi-file-auth");

function getStatusCode(err) {
  try {
    const sc = err?.output?.statusCode;
    if (typeof sc === "number") return sc;
  } catch {}
  try {
    const sc = err?.data?.statusCode;
    if (typeof sc === "number") return sc;
  } catch {}
  return undefined;
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function backoffDelay(attempt, baseDelayMs, maxDelayMs, jitter) {
  const exp = Math.pow(2, clamp(attempt, 0, 20));
  const raw = clamp(baseDelayMs * exp, baseDelayMs, maxDelayMs);
  const j = raw * (typeof jitter === "number" ? jitter : 0.2);
  const delta = (Math.random() * 2 - 1) * j;
  return Math.max(0, Math.floor(raw + delta));
}

function maskJid(jid) {
  if (!jid) return "-";
  const s = String(jid);
  return s.replace(/\d(?=\d{4})/g, "•");
}

function buildSessionReport(event, id, sock) {
  const user = sock?.user?.id || sock?.user?.jid || "";
  const name = sock?.user?.name || sock?.user?.pushName || "";
  const ts = new Date().toISOString();
  return `${event}\n• session: <b>${id}</b>\n• user: <code>${maskJid(user)}</code>\n• name: ${name || "-"}\n• time: ${ts}`;
}

/**
 * ZEXXO Session Manager (multi-session)
 * - Auto reconnect (exponential backoff + jitter)
 * - Optional notifier hook (Telegram, Discord, etc)
 * - Optional custom auth provider (plain/encrypted)
 */
function createSessionManager(options = {}) {
  const {
    sessionsDir = path.join(process.cwd(), "sessions"),
    defaultSocketConfig = {},
    logger,
    notifier, // async (text, extra?) => void
    authProvider, // (authFolder) => { state, saveCreds }
    // reconnect tuning
    maxRetries = Infinity,
    baseDelayMs = 2000,
    maxDelayMs = 60000,
    jitter = 0.2,
  } = options;

  const ev = new EventEmitter();
  const sessions = new Map();

  const log = {
    info: (...a) => (logger?.info ? logger.info(...a) : undefined),
    warn: (...a) => (logger?.warn ? logger.warn(...a) : undefined),
    error: (...a) => (logger?.error ? logger.error(...a) : undefined),
  };

  const notifySafe = async (text) => {
    if (!notifier) return;
    try {
      await notifier(text);
    } catch (e) {
      log.warn("notifier failed:", e?.message || e);
    }
  };

  const createSocket = (id, socketConfig, authFolder) => {
    const auth = authProvider ? authProvider(authFolder) : useMultiFileAuthState(authFolder);
    const sock = makeWASocket({
      ...defaultSocketConfig,
      ...socketConfig,
      auth: auth.state,
    });
    return { sock, saveCreds: auth.saveCreds, authFolder };
  };

  const detachHandlers = (record) => {
    try {
      if (record?.sock?.ev && record?.onConnUpdate) {
        record.sock.ev.off("connection.update", record.onConnUpdate);
      }
      if (record?.sock?.ev && record?.saveCreds) {
        record.sock.ev.off("creds.update", record.saveCreds);
      }
    } catch {}
  };

  const attachHandlers = (record) => {
    const { id } = record;

    // creds persist
    record.sock.ev.on("creds.update", record.saveCreds);

    // connection handler
    record.onConnUpdate = async (update) => {
      ev.emit("connection.update", { id, update });

      const s = sessions.get(id);
      if (!s || s.closing) return;

      if (update.connection === "open") {
        s.reconnectAttempt = 0;
        s.reconnecting = false;
        ev.emit("session.ready", { id, sock: s.sock });
        await notifySafe(buildSessionReport("✅ <b>Device Connected</b>", id, s.sock));
        return;
      }

      if (update.connection === "close") {
        const lastErr = update.lastDisconnect?.error;
        const statusCode = getStatusCode(lastErr);

        // logged out
        const reason = statusCode === DisconnectReason.loggedOut ||
          statusCode === 401 ||
          statusCode === DisconnectReason.restartRequired;

        if (reason) {
          ev.emit("session.loggedOut", { id, error: lastErr });
          await notifySafe(buildSessionReport("⛔ <b>Logged Out</b>", id, s.sock));
          detachHandlers(s);
          sessions.delete(id);
          return;
        }

        // stop if too many retries
        if (Number.isFinite(maxRetries) && s.reconnectAttempt >= maxRetries) {
          ev.emit("session.stopped", { id, error: lastErr });
          await notifySafe(buildSessionReport("🛑 <b>Stopped (max retries)</b>", id, s.sock));
          detachHandlers(s);
          sessions.delete(id);
          return;
        }

        if (s.reconnecting) return;
        s.reconnecting = true;

        const delay = backoffDelay(s.reconnectAttempt++, baseDelayMs, maxDelayMs, jitter);
        ev.emit("session.reconnect", { id, attempt: s.reconnectAttempt, delay, error: lastErr });

        await notifySafe(`⚠️ <b>Reconnect</b>\n• session: <b>${id}</b>\n• in: ${delay}ms\n• user: <code>${maskJid(s.sock?.user?.id)}</code>`);

        await wait(delay);

        const still = sessions.get(id);
        if (!still || still.closing) return;

        try {
          await reconnect(id);
        } catch (e) {
          log.error(e);
          const st = sessions.get(id);
          if (st) st.reconnecting = false;
        }
      }
    };

    record.sock.ev.on("connection.update", record.onConnUpdate);
  };

  const reconnect = async (id) => {
    const s = sessions.get(id);
    if (!s || s.closing) return;

    // detach old listeners
    detachHandlers(s);

    try { s.sock.end?.(); } catch {}
    try { s.sock.ws?.close?.(); } catch {}

    const { sock, saveCreds } = createSocket(id, s.socketConfig, s.authFolder);

    s.sock = sock;
    s.saveCreds = saveCreds;

    // re-attach listeners
    attachHandlers(s);

    s.reconnecting = false;
    ev.emit("session.reconnected", { id, sock });
    await notifySafe(buildSessionReport("🔁 <b>Reconnected</b>", id, sock));
  };

  const create = async (id = "default", socketConfig = {}) => {
    const sessionId = String(id || "default");
    const authFolder = path.join(sessionsDir, sessionId);

    // if exists, return current socket
    const existing = sessions.get(sessionId);
    if (existing && existing.sock) return existing.sock;

    const { sock, saveCreds } = createSocket(sessionId, socketConfig, authFolder);

    const record = {
      id: sessionId,
      sock,
      authFolder,
      saveCreds,
      socketConfig: { ...socketConfig },
      reconnectAttempt: 0,
      reconnecting: false,
      closing: false,
      onConnUpdate: null,
    };

    sessions.set(sessionId, record);
    attachHandlers(record);

    ev.emit("session.created", { id: sessionId, sock });
    return sock;
  };

  const getSock = (id = "default") => sessions.get(String(id))?.sock;

  const getSessionInfo = (id = "default") => {
    const s = sessions.get(String(id));
    if (!s) return null;
    return {
      id: s.id,
      authFolder: s.authFolder,
      user: s.sock?.user || null,
      reconnectAttempt: s.reconnectAttempt,
      reconnecting: s.reconnecting,
    };
  };

  const sendMessage = async (id, jid, content, options) => {
    const sock = getSock(id);
    if (!sock) throw new Error(`No session: ${id}`);
    return sock.sendMessage(jid, content, options);
  };

  const sendBulkMessage = async (id, jids, content, options) => {
    const sock = getSock(id);
    if (!sock) throw new Error(`No session: ${id}`);
    const res = [];
    for (const jid of jids) {
      res.push(await sock.sendMessage(jid, content, options));
      await wait(250);
    }
    return res;
  };

  const stop = async (id = "default") => {
    const sid = String(id);
    const s = sessions.get(sid);
    if (!s) return;
    s.closing = true;
    detachHandlers(s);
    try { s.sock.end?.(); } catch {}
    try { s.sock.ws?.close?.(); } catch {}
    sessions.delete(sid);
    ev.emit("session.stopped", { id: sid });
    await notifySafe(buildSessionReport("🧹 <b>Stopped</b>", sid, s.sock));
  };

  return {
    ev,
    sessions,
    create,
    getSock,
    getSessionInfo,
    sendMessage,
    sendBulkMessage,
    stop,
  };
}

module.exports = {
  createSessionManager,
  default: createSessionManager,
};
