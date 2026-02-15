"use strict";

const fs = require("fs");
const path = require("path");

function readJSON(file) {
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function writeJSON(file, obj) {
  fs.writeFileSync(file, JSON.stringify(obj, null, 2));
}

function isEmptyOrMissingIndex(indexPath) {
  try {
    if (!fs.existsSync(indexPath)) return true;
    const raw = fs.readFileSync(indexPath, "utf8");
    return !raw || !raw.trim();
  } catch {
    return true;
  }
}

function initProject(options = {}) {
  const {
    dir = process.cwd(),
    force = false,
    sessionId = "default",
  } = options;

  const indexPath = path.join(dir, "index.js");
  const pkgPath = path.join(dir, "package.json");

  if (!force && !isEmptyOrMissingIndex(indexPath)) {
    return { changed: false, reason: "index.js already exists and is not empty" };
  }

  const tpl = `// ╔══════════════════════════════════════════════════════╗
// ║              ZEXXO BAILEYS — QUICK START              ║
// ╚══════════════════════════════════════════════════════╝
//
// How to run:
//   node index.js
//
// Pairing (code):
//   node index.js --pair --phone 628xxxxxxxxxx --key ZEXXODEV
//
// Pairing (QR):
//   node index.js --qr
//
// Notes:
// - Pairing code still requires a valid phone number & user consent.
// - To enable Telegram notify, create zexxo.config.json (see README).

const readline = require("readline");
const path = require("path");

const {
  createSessionManager,
} = require("zexxo-baileys");

const { createTelegramNotifier } = require("zexxo-baileys/extra/telegram-notifier");

function readConfig() {
  try {
    const fs = require("fs");
    const cfgPath = path.join(process.cwd(), "zexxo.config.json");
    if (!fs.existsSync(cfgPath)) return {};
    return JSON.parse(fs.readFileSync(cfgPath, "utf8"));
  } catch { return {}; }
}

function arg(flag) {
  const i = process.argv.indexOf(flag);
  if (i === -1) return null;
  return process.argv[i + 1] || true;
}

async function prompt(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ans = await new Promise((res) => rl.question(q, (a) => res(a)));
  rl.close();
  return String(ans || "").trim();
}

(async () => {
  const cfg = readConfig();
  const notify = createTelegramNotifier(cfg.telegram || {});

  const manager = createSessionManager({
    sessionsDir: path.join(process.cwd(), "sessions"),
    notifier: async (msg) => notify(msg).catch(() => {}),
  });

  const sessionId = String(arg("--session") || "${sessionId}");
  const sock = await manager.create(sessionId, {
    printQRInTerminal: true,
    browser: ["ZEXXO", "Chrome", "1.0.0"],
  });

  manager.ev.on("connection.update", ({ update }) => {
    if (update.qr) {
      console.log("\\n[ZEXXO] QR ready. Scan with WhatsApp.");
    }
  });

  const doPair = !!arg("--pair");
  const doQr = !!arg("--qr");

  if (doPair) {
    let phone = arg("--phone");
    if (!phone) phone = await prompt("Phone number (e.g. 628xxxx): ");
    const key = String(arg("--key") || "ZEXXODEV");
    const code = await sock.requestPairingCode(String(phone).replace(/\\D/g, ""), key);
    console.log("\\n[ZEXXO] Pairing Code:", code);
  } else if (doQr) {
    console.log("[ZEXXO] Waiting for QR...");
  } else {
    console.log("[ZEXXO] Starting session... (use --pair or --qr if needed)");
  }

  manager.ev.on("session.ready", ({ id }) => {
    console.log("[ZEXXO] Session ready:", id);
  });

})();\n`;

  fs.writeFileSync(indexPath, tpl);

  // Update package.json (best-effort)
  const pkg = readJSON(pkgPath) || { name: "my-zexxo-bot", version: "1.0.0" };
  pkg.main = "index.js";
  pkg.type = pkg.type || "commonjs";
  pkg.scripts = pkg.scripts || {};
  pkg.scripts.start = pkg.scripts.start || "node index.js";
  pkg.dependencies = pkg.dependencies || {};
  pkg.dependencies["zexxo-baileys"] = pkg.dependencies["zexxo-baileys"] || "^1.3.0";
  writeJSON(pkgPath, pkg);

  return { changed: true, indexPath, pkgPath };
}

module.exports = { initProject };
