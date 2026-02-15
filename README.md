# zenzo-baileys Modern JS (CommonJS)

![Zenzo Baileys](https://images.unsplash.com/photo-1518770660439-4636190af475?fm=jpg&q=80&w=1600&fit=crop)

<p align="center">
  <img src="https://readme-typing-svg.demolab.com?font=Fira+Code&size=22&pause=900&center=true&vCenter=true&width=900&lines=ZENZO+BAILEYS+Modern+JS+CommonJS;Multi-Session+%2F+Multi-Sender+Manager;Best-effort+Auto+Reconnect;Zenzo+%E2%80%A2+Team+XVCT" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Language-JavaScript%20(CommonJS)-111111?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Runtime-Node.js-111111?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Focus-Stable%20Sessions%20%26%20Reconnect-111111?style=for-the-badge" />
</p>

---

## Table of Contents
- [Tentang](#tentang)
- [Fitur](#fitur)
- [Quick Start](#quick-start)
- [Cara Connect WhatsApp](#cara-connect-whatsapp)
  - [QR Code](#qr-code)
  - [Pairing Code](#pairing-code)
- [Multi-session](#multi-session)
- [API](#api)
- [Troubleshooting](#troubleshooting)
- [Credits](#credits)

---

## Tentang

**zenzo-baileys** adalah build **JavaScript (CommonJS)** dengan struktur rapi dan fokus ke stabilitas session:

- `dist/index.js` -> entry utama + banner
- `dist/core/*` -> core engine (Socket, Utils, Types, Store, dll)
- `dist/extra/*` -> fitur tambahan (multi-session & auth multi-file)

Auto-reconnect tersedia (best-effort): saat koneksi putus karena jaringan / rate limit, sistem akan coba connect ulang otomatis dengan backoff.

Catatan penting: tidak ada sistem yang bisa menjamin 100% anti logout karena WA server & kebijakan perangkat bisa memaksa logout.
Yang dibangun di sini: persistence session + reconnect manager supaya lebih tahan banting.

---

## Fitur

- JavaScript CommonJS (bukan TypeScript)
- Auth Multi-File (`useMultiFileAuthState`) - session disimpan per-file (lebih aman untuk data besar)
- Multi-session / Multi-sender (`createSessionManager`) - banyak nomor WA, tiap session isolated
- Best-effort auto reconnect - reconnect dengan delay/backoff saat close
- API helper untuk send message dan bulk message

---

## Quick Start

### Install (local folder)
```bash
npm i
```

---

## Cara Connect WhatsApp

Ada 2 metode:
1) QR Code (paling kompatibel)
2) Pairing Code (hanya kalau socket menyediakan `requestPairingCode()`)

### QR Code

```js
const { makeWASocket, useMultiFileAuthState } = require("zenzo-baileys");

(async () => {
  const { state, saveCreds } = useMultiFileAuthState("./sessions/main");

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (u) => {
    if (u.connection === "open") console.log("[OK] Connected");
    if (u.connection === "close") console.log("[OFF] Disconnected");
  });
})();
```

Cara scan QR:
1) WhatsApp -> Linked Devices / Perangkat tertaut
2) Link a device
3) Scan QR yang muncul di terminal

---

### Pairing Code

Pairing code bersifat conditional: kalau `sock.requestPairingCode` tidak ada, gunakan QR.

```js
const { makeWASocket, useMultiFileAuthState } = require("zenzo-baileys");

(async () => {
  const { state, saveCreds } = useMultiFileAuthState("./sessions/pairing");

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
  });

  sock.ev.on("creds.update", saveCreds);

  const phoneNumber = "62812xxxxxxx"; // format internasional, tanpa +

  if (typeof sock.requestPairingCode === "function") {
    const code = await sock.requestPairingCode(phoneNumber);
    console.log("[PAIR] Pairing Code:", code);
    console.log("WA -> Linked Devices -> Pair with phone number -> masukkan code di atas.");
  } else {
    console.log("[WARN] Pairing code tidak tersedia. Pakai QR: set printQRInTerminal: true.");
  }
})();
```

---

## Multi-session

Multi-session cocok buat multi sender (banyak nomor) atau multi bot instance.

```js
const { createSessionManager } = require("zenzo-baileys");

(async () => {
  const manager = createSessionManager({
    sessionsDir: "./sessions",
    defaultSocketConfig: { printQRInTerminal: true },
  });

  manager.ev.on("session.ready", ({ id }) => console.log("[READY]", id));
  manager.ev.on("session.reconnect", ({ id, attempt, delay }) =>
    console.log(`[RECONNECT] ${id} attempt=${attempt} in ${delay}ms`)
  );

  await manager.create("bot-1");
  await manager.create("bot-2");

  await manager.sendMessage("bot-1", "628xxxx@s.whatsapp.net", { text: "Hello from bot-1" });

  await manager.sendBulkMessage(
    "bot-1",
    ["628111@s.whatsapp.net", "628222@s.whatsapp.net"],
    (jid) => ({ text: `Halo ${jid}` })
  );
})();
```

---

## API

### `useMultiFileAuthState(folder)`
- Menyimpan session di folder (multi-file).
- Direkomendasikan untuk stability.

### `createSessionManager({ sessionsDir, defaultSocketConfig })`
Methods:
- `manager.create(sessionId, socketConfig?)`
- `manager.getSock(sessionId)`
- `manager.sendMessage(sessionId, jid, content, options?)`
- `manager.sendBulkMessage(sessionId, jids, contentOrFn)`
- `manager.stop(sessionId)`

---

## Troubleshooting

### QR tidak muncul
- Pastikan `printQRInTerminal: true`
- Jangan jalankan di environment yang memblok output terminal
- Coba update Node.js versi LTS

### Koneksi sering close
- Ini normal saat jaringan tidak stabil / rate limit
- Hindari spam / broadcast brutal
- Pakai VPS stabil, jangan sering restart

### Session corrupt / creds error
- Stop bot
- Backup folder `./sessions`
- Hapus hanya session yang rusak (bukan semuanya) lalu login ulang

### Pairing code tidak ada
- Tidak semua build/socket menyediakan `requestPairingCode()`
- Gunakan QR (paling kompatibel)

### Backup sessions
- Copy folder `./sessions` ke storage aman
- Jangan commit / share session ke publik

---

## Credits

Terima kasih untuk rexxhayanasi yang sudah menyediakan keyeddb dan stack signal/libsignal yang membantu fondasi penyimpanan & kripto pada ekosistem ini.

---

Zenzo Team XVCT


## ZENZO Modern Extras (v1.3.0)

### 1) CLI Scaffold (safe init)
Baileys library **should not** silently modify your project on install.  
Instead, run the explicit init command:

```bash
npx Zenzo-baileys init
# or
zenzo-baileys init --force
```

This will:
- Create a starter `index.js` **only if missing/empty**
- Patch `package.json` with `main` + `start` script

### 2) Encrypted Auth State (recommended for security)
```js
const { useEncryptedMultiFileAuthState } = require("zenzo-baileys");
const { state, saveCreds } = useEncryptedMultiFileAuthState("./sessions/default", "YOUR_PASSPHRASE");
```

### 3) Telegram Notifier (optional)
```js
const { createTelegramNotifier } = require("zenzo-baileys");
const notify = createTelegramNotifier({ botToken: "xxxx", chatId: "123" });
await notify("Device Connected ✅");
```

### 4) Resilient Client (auto reconnect wrapper)
```js
const { createResilientClient } = require("zenzo-baileys");
const { sock, manager } = await createResilientClient({
  sessionId: "default",
  encrypted: true,
  passphrase: "YOUR_PASSPHRASE",
  notifier: (t) => notify(t),
});
```

### 5) Interactive Builders
```js
const { interactive } = require("zenzo-baileys");
await sock.sendMessage(jid, interactive.buildButtonsMessage({
  text: "Menu",
  footer: "ZENZO",
  buttons: [{ id: "ping", text: "PING" }, { id: "owner", text: "OWNER" }],
}));
```

### Security Note
Pairing code still requires a valid phone number and **user consent** (WhatsApp rules).  
This package does **not** bypass authentication.

