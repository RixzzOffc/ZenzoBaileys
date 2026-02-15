"use strict";

const path = require("path");

const { createSessionManager } = require("./session-manager");
const { useEncryptedMultiFileAuthState } = require("./secure-multi-file-auth");
const { useMultiFileAuthState } = require("./multi-file-auth");

/**
 * Create a resilient client with safe defaults & auto-reconnect.
 * This is a convenience wrapper around createSessionManager().
 */
async function createResilientClient(options = {}) {
  const {
    sessionId = "default",
    sessionsDir = path.join(process.cwd(), "sessions"),
    encrypted = false,
    passphrase,
    socketConfig = {},
    logger,
    notifier, // async (text)=>void
    maxRetries = Infinity,
    baseDelayMs = 2000,
    maxDelayMs = 60000,
    jitter = 0.2,
  } = options;

  const manager = createSessionManager({
    sessionsDir,
    logger,
    notifier,
    maxRetries,
    baseDelayMs,
    maxDelayMs,
    jitter,
    // choose auth provider
    authProvider: (authFolder) => {
      if (encrypted) return useEncryptedMultiFileAuthState(authFolder, passphrase);
      return useMultiFileAuthState(authFolder);
    },
  });

  const sock = await manager.create(sessionId, socketConfig);
  return { sock, manager };
}

module.exports = {
  createResilientClient,
  default: createResilientClient,
};
