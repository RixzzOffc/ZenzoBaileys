"use strict";

const https = require("https");

function postJSON(url, payload, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(JSON.stringify(payload), "utf8");
    const u = new URL(url);
    const req = https.request(
      {
        method: "POST",
        hostname: u.hostname,
        path: u.pathname + u.search,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": data.length,
        },
        timeout: timeoutMs,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          try {
            const js = JSON.parse(raw);
            if (!js.ok) return reject(new Error(js.description || "Telegram API error"));
            resolve(js);
          } catch (e) {
            resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, raw });
          }
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy(new Error("Telegram request timeout"));
    });
    req.write(data);
    req.end();
  });
}

function createTelegramNotifier(options = {}) {
  const {
    botToken,
    chatId,
    parseMode = "HTML",
    disableWebPagePreview = true,
    timeoutMs = 10000,
    prefix = "[ZEXXO]",
  } = options;

  if (!botToken || !chatId) {
    // Return no-op notifier if not configured
    return async () => false;
  }

  const endpoint = `https://api.telegram.org/bot${botToken}/sendMessage`;

  return async (text, extra = {}) => {
    const payload = {
      chat_id: chatId,
      text: `${prefix} ${text}`,
      parse_mode: parseMode,
      disable_web_page_preview: disableWebPagePreview,
      ...extra,
    };
    await postJSON(endpoint, payload, timeoutMs);
    return true;
  };
}

module.exports = {
  createTelegramNotifier,
  default: createTelegramNotifier,
};
