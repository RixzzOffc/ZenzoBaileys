"use strict";

let chalk;
let gradient;
try { chalk = require("chalk"); } catch {}
try { gradient = require("gradient-string"); } catch {}

const dim = (t) => (chalk ? chalk.dim(t) : t);
const white = (t) => (chalk ? chalk.white(t) : t);
const bold = (t) => (chalk ? chalk.bold(t) : t);
const italicDim = (t) => (chalk ? chalk.italic.dim(t) : t);

function printBanner() {
  if (process.env.ZENZO_BANNER === "0") return;
  const gMain = gradient ? gradient(["#7F00FF", "#E100FF"]) : (t) => t;
  const gSub = gradient ? gradient(["#00F5A0", "#00D9F5"]) : (t) => t;
  const ver = (() => {
    try { return require("../package.json").version; } catch { return "?"; }
  })();

  console.log("");
  console.log(gMain("   ⟡  𝗭𝗘𝗡𝗭𝗢 𝗕𝗔𝗜𝗟𝗘𝗬𝗦  ") + dim(`v${ver}`));
  console.log(dim("   ──────────────────────────────────────────"));
  console.log(`   ${gSub("⚡ Engine")}  ${white("»")} ${white("Multi-Device")}`);
  console.log(`   ${gSub("🧠 Mode")}    ${white("»")} ${white("Pure JavaScript")}`);
  console.log(`   ${gSub("🛡️ Guard")}   ${white("»")} ${white("Auto-reconnect (best-effort)")}`);
  console.log(`   ${gSub("👥 Team")}    ${white("»")} ${bold("969 Tech")}`);
  console.log(dim("   ──────────────────────────────────────────"));
  console.log(italicDim("      © 2025 Zenzo • rixzzstore44@gmail.com"));
  console.log("");
}

printBanner();


const core = require("./core");
const { useMultiFileAuthState } = require("./extra/multi-file-auth");
const { useEncryptedMultiFileAuthState } = require("./extra/secure-multi-file-auth");
const { createSessionManager } = require("./extra/session-manager");
const { createTelegramNotifier } = require("./extra/telegram-notifier");
const interactive = require("./extra/interactive");
const { createResilientClient } = require("./extra/resilient-client");

module.exports = Object.assign({}, core, {
  useMultiFileAuthState,
  useEncryptedMultiFileAuthState,
  createSessionManager,
  createTelegramNotifier,
  createResilientClient,
  interactive,
});
