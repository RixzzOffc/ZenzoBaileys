"use strict";

/**
 * Lightweight helpers to build interactive message payloads for Baileys.
 * Note: WhatsApp changes frequently; these helpers cover the most common structures.
 */

function normalizeButtons(buttons = []) {
  return buttons.map((b, i) => {
    const id = b.buttonId || b.id || String(i + 1);
    const text = b.displayText || b.text || b.title || `Button ${i + 1}`;
    return {
      buttonId: id,
      buttonText: { displayText: text },
      type: 1,
    };
  });
}

function buildButtonsMessage(options = {}) {
  const {
    text = "",
    footer = "",
    buttons = [],
    headerType = 1,
  } = options;

  return {
    text,
    footer,
    buttons: normalizeButtons(buttons),
    headerType,
  };
}

function buildListMessage(options = {}) {
  const {
    text = "",
    footer = "",
    title = "",
    buttonText = "PILIH",
    sections = [],
  } = options;

  // sections: [{ title, rows:[{ title, description, rowId }] }]
  const normSections = (sections || []).map((s, si) => ({
    title: s.title || `Menu ${si + 1}`,
    rows: (s.rows || []).map((r, ri) => ({
      title: r.title || r.text || `Item ${ri + 1}`,
      description: r.description || "",
      rowId: r.rowId || r.id || `${si + 1}.${ri + 1}`,
    })),
  }));

  return {
    text,
    footer,
    title,
    buttonText,
    sections: normSections,
  };
}

function buildTemplateMessage(options = {}) {
  const {
    text = "",
    footer = "",
    templateButtons = [],
  } = options;

  // templateButtons: [{ index, urlButton:{displayText,url} }|{ callButton:{displayText,phoneNumber} }|{ quickReplyButton:{displayText,id} }]
  const norm = (templateButtons || []).map((b, i) => {
    const idx = typeof b.index === "number" ? b.index : i + 1;
    if (b.urlButton) return { index: idx, urlButton: b.urlButton };
    if (b.callButton) return { index: idx, callButton: b.callButton };
    if (b.quickReplyButton) return { index: idx, quickReplyButton: b.quickReplyButton };
    // convenience
    if (b.url) return { index: idx, urlButton: { displayText: b.text || "OPEN", url: b.url } };
    if (b.phoneNumber) return { index: idx, callButton: { displayText: b.text || "CALL", phoneNumber: b.phoneNumber } };
    return { index: idx, quickReplyButton: { displayText: b.text || `OK ${idx}`, id: b.id || String(idx) } };
  });

  return { text, footer, templateButtons: norm };
}

module.exports = {
  buildButtonsMessage,
  buildListMessage,
  buildTemplateMessage,
};
