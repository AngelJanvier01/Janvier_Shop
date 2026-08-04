type EmailDetail = {
  label: string;
  value: string;
};

type JanvierEmailInput = {
  details?: EmailDetail[];
  eyebrow: string;
  summary: string;
  title: string;
  tone?: "alert" | "signal" | "neutral";
};

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/gu, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    };
    return entities[character];
  });
}

function plainText(input: JanvierEmailInput) {
  const details =
    input.details?.map((item) => `${item.label}: ${item.value}`).join("\n") ?? "";
  return ["JANVIER / CONTROL_ROOM", input.eyebrow, input.title, input.summary, details]
    .filter(Boolean)
    .join("\n\n");
}

export function createJanvierEmail(input: JanvierEmailInput) {
  const accent =
    input.tone === "alert" ? "#ea6b55" : input.tone === "signal" ? "#8eaf87" : "#e8e3d9";
  const details = input.details?.length
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px;border-collapse:collapse">${input.details
        .map(
          (item) =>
            `<tr><td style="padding:10px 0;border-top:1px solid #30342d;color:#9da099;font:11px/1.4 monospace;letter-spacing:.06em">${escapeHtml(item.label).toUpperCase()}</td><td style="padding:10px 0 10px 20px;border-top:1px solid #30342d;color:#f0eee8;font:13px/1.4 Arial,sans-serif;text-align:right">${escapeHtml(item.value)}</td></tr>`
        )
        .join("")}</table>`
    : "";
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#10120f;color:#f0eee8"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#10120f"><tr><td style="padding:32px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;border:1px solid #30342d;background:#151814"><tr><td style="height:3px;background:${accent}"></td></tr><tr><td style="padding:32px"><p style="margin:0 0 28px;color:#f0eee8;font:600 14px/1 Arial,sans-serif;letter-spacing:-.03em">JANVIER <span style="color:#9da099;font:10px/1 monospace;letter-spacing:.08em">/ CONTROL_ROOM</span></p><p style="margin:0 0 12px;color:${accent};font:10px/1.4 monospace;letter-spacing:.1em">${escapeHtml(input.eyebrow).toUpperCase()}</p><h1 style="margin:0;color:#f0eee8;font:500 32px/.98 Arial,sans-serif;letter-spacing:-.04em">${escapeHtml(input.title)}</h1><p style="margin:22px 0 0;color:#c4c6bf;font:16px/1.55 Arial,sans-serif">${escapeHtml(input.summary)}</p>${details}<p style="margin:32px 0 0;color:#777c74;font:10px/1.5 monospace;letter-spacing:.06em">MENSAJE AUTOMÁTICO · NO RESPONDER A ESTE CORREO</p></td></tr></table></td></tr></table></body></html>`;

  return { html, text: plainText(input) };
}
