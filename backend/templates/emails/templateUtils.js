function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderEmail(title, body) {
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f4f6f8;color:#1f2933;font-family:Arial,sans-serif;line-height:1.5;">
    <div style="max-width:600px;margin:24px auto;padding:28px;background:#ffffff;border:1px solid #d9e2ec;">
      <h1 style="margin:0 0 20px;color:#0b6174;font-size:24px;">${escapeHtml(title)}</h1>
      ${body}
      <p style="margin:24px 0 0;color:#52606d;font-size:13px;">KAI AZUL Resort</p>
    </div>
  </body>
</html>`;
}

function detail(label, value) {
  return `<p style="margin:8px 0;"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`;
}

module.exports = { escapeHtml, renderEmail, detail };