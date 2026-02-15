const { creator: CREATOR } = require("../creator.json");

const growagarden = async () => {
  const url = "https://gagstock.gleeze.com/grow-a-garden";

  try {
    // fetch fallback (kalau environment belum global fetch)
    const f = global.fetch || (await import("node-fetch")).default;

    // timeout biar gak ngegantung
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 15000);

    const res = await f(url, {
      method: "GET",
      headers: {
        "accept": "application/json",
        "user-agent": "zexxo-baileys/ga-garden"
      },
      signal: controller.signal
    }).finally(() => clearTimeout(t));

    if (!res.ok) {
      throw new Error(`ZEXXO API: gagal ambil data Grow A Garden (HTTP ${res.status})`);
    }

    const json = await res.json();

    return {
      creator: CREATOR,
      status: json?.status ?? true,
      updated_at: json?.updated_at ?? new Date().toISOString(),
      data: json?.data ?? json
    };
  } catch (err) {
    const msg =
      err?.name === "AbortError"
        ? "ZEXXO API: request timeout (15s) saat ambil data Grow A Garden"
        : `ZEXXO API: error saat ambil data Grow A Garden → ${err?.message || String(err)}`;

    return {
      creator: CREATOR,
      error: msg,
      status: 500
    };
  }
};

module.exports = growagarden;
module.exports.default = growagarden;