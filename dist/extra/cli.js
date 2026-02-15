#!/usr/bin/env node
"use strict";

const path = require("path");

function printHelp() {
  console.log(`
zexxo-baileys (CLI)

Usage:
  zexxo-baileys init [--force] [--dir <path>]     Scaffold index.js + patch package.json
  zexxo-baileys doctor                            Quick checks & tips

Examples:
  npx zexxo-baileys init
  npx zexxo-baileys init --force
  npx zexxo-baileys doctor
`);
}

async function run() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (!cmd || cmd === "-h" || cmd === "--help" || cmd === "help") {
    printHelp();
    return;
  }

  if (cmd === "init") {
    const { initProject } = require("./project-scaffold");
    const dirFlag = args.indexOf("--dir");
    const dir = dirFlag !== -1 ? args[dirFlag + 1] : process.cwd();
    const force = args.includes("--force");
    const res = initProject({ dir, force });
    if (res.changed) {
      console.log("[ZEXXO] Init done:");
      console.log("  -", path.relative(process.cwd(), res.indexPath));
      console.log("  -", path.relative(process.cwd(), res.pkgPath));
    } else {
      console.log("[ZEXXO] Init skipped:", res.reason);
    }
    return;
  }

  if (cmd === "doctor") {
    const node = process.versions.node;
    const major = parseInt(node.split(".")[0], 10);
    console.log("[ZEXXO] Node:", node);
    if (major < 18) {
      console.log("[ZEXXO] Recommended: Node.js 18+ for best stability.");
    }
    console.log("[ZEXXO] Tip: run `npx zexxo-baileys init` to scaffold a starter bot.");
    return;
  }

  console.log("[ZEXXO] Unknown command:", cmd);
  printHelp();
}

run().catch((e) => {
  console.error("[ZEXXO] CLI error:", e?.message || e);
  process.exitCode = 1;
});
