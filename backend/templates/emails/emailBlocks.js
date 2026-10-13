const { escapeHtml } = require('./templateUtils');

const BRAND = '#0b6174';
const BRAND_LIGHT = '#eef6f8';
const BORDER = '#d9e2ec';
const TEXT = '#1f2933';
const MUTED = '#52606d';
const FONT = 'Arial, Helvetica, sans-serif';

const TONES = {
  success: { bg: '#eaf6ee', border: '#9fd3b0', text: '#1f7a3f' },
  warning: { bg: '#fff8e6', border: '#f0b429', text: '#8a5a00' },
  danger: { bg: '#fdecec', border: '#f2a7a7', text: '#b42318' },
  neutral: { bg: '#f5f7fa', border: BORDER, text: TEXT },
};

const safe = (value) => escapeHtml(String(value ?? ''));

// Date objects, ISO strings, or "Sat Oct 17 2026 00:00:00 GMT+0800 (...)" strings
// become "Saturday, October 17, 2026" in Asia/Manila time.
function formatDate(value) {
  if (!value || value === 'Not specified') return String(value || '');
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-PH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Manila',
  }).format(date);
}

// "pending_verification" -> "Pending verification"
function humanize(value) {
  const text = String(value ?? '').replace(/[_-]+/g, ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

function greeting(name) {
  return `<p style="margin:0 0 16px;font-family:${FONT};font-size:16px;color:${TEXT};">Dear ${safe(name)},</p>`;
}

function statusBanner(label, message, tone = 'neutral') {
  const t = TONES[tone] || TONES.neutral;
  return `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr>
    <td style="padding:14px 16px;background:${t.bg};border:1px solid ${t.border};border-left:4px solid ${t.text};border-radius:6px;">
      <div style="font-family:${FONT};font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:${t.text};">${safe(label)}</div>
      <div style="font-family:${FONT};font-size:15px;line-height:1.5;color:${TEXT};padding-top:4px;">${safe(message)}</div>
    </td>
  </tr></table>`;
}

function callout(title, message, tone = 'neutral') {
  const t = TONES[tone] || TONES.neutral;
  return `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin:20px 0 0;"><tr>
    <td style="padding:14px 16px;background:${t.bg};border:1px solid ${t.border};border-radius:6px;">
      <div style="font-family:${FONT};font-size:14px;font-weight:bold;color:${TEXT};">${safe(title)}</div>
      <div style="font-family:${FONT};font-size:14px;line-height:1.5;color:${MUTED};padding-top:4px;">${safe(message)}</div>
    </td>
  </tr></table>`;
}

function referenceBlock(reference, tone = 'brand') {
  const color = tone === 'danger' ? TONES.danger.text : BRAND;
  return `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr>
    <td align="center" style="padding:18px 16px;border:2px dashed ${color};border-radius:8px;">
      <div style="font-family:${FONT};font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${MUTED};">Booking reference</div>
      <div style="font-family:'Courier New',Courier,monospace;font-size:24px;font-weight:bold;letter-spacing:1px;color:${color};padding-top:6px;">${safe(reference)}</div>
    </td>
  </tr></table>`;
}

function dateCell(label, date, note, width) {
  return `<td width="${width}" valign="top" style="padding:14px 16px;background:${BRAND_LIGHT};border-radius:6px;">
    <div style="font-family:${FONT};font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${MUTED};">${safe(label)}</div>
    <div style="font-family:${FONT};font-size:15px;font-weight:bold;color:${TEXT};padding-top:4px;">${safe(date)}</div>
    ${note ? `<div style="font-family:${FONT};font-size:13px;color:${MUTED};padding-top:2px;">${safe(note)}</div>` : ''}
  </td>`;
}

function dateBlock({ isVenue, eventDate, checkInDate, checkOutDate }) {
  if (isVenue) {
    return `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr>
      ${dateCell('Event date', formatDate(eventDate), '', '100%')}
    </tr></table>`;
  }
  return `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr>
    ${dateCell('Check-in', formatDate(checkInDate), 'From 2:00 PM', '48%')}
    <td width="4%" style="font-size:0;line-height:0;">&nbsp;</td>
    ${dateCell('Check-out', formatDate(checkOutDate), 'Until 12:00 noon', '48%')}
  </tr></table>`;
}

// rows: [[label, value, { bold, color }], ...]; empty values are skipped.
function infoRows(rows) {
  const list = rows.filter(([, value]) => value !== undefined && value !== null && value !== '');
  return `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">${list
    .map(([label, value, opts = {}], index) => {
      const border = index === list.length - 1 ? '' : `border-bottom:1px solid ${BORDER};`;
      return `<tr>
        <td style="padding:10px 0;${border}font-family:${FONT};font-size:14px;color:${MUTED};">${safe(label)}</td>
        <td align="right" style="padding:10px 0;${border}font-family:${FONT};font-size:14px;font-weight:${opts.bold ? 'bold' : 'normal'};color:${opts.color || TEXT};">${safe(value)}</td>
      </tr>`;
    })
    .join('')}</table>`;
}

function sectionTitle(text) {
  return `<h2 style="margin:24px 0 4px;font-family:${FONT};font-size:17px;color:${TEXT};">${safe(text)}</h2>`;
}

function paymentSummary({ totalAmount, paidLabel, paidAmount, paidColor, balanceDue, notice }) {
  return `${sectionTitle('Payment summary')}
    ${infoRows([
      ['Total amount', totalAmount],
      [paidLabel, paidAmount, { bold: true, color: paidColor || TEXT }],
    ])}
    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin:12px 0 0;"><tr>
      <td style="padding:14px 16px;background:${TONES.warning.bg};border:1px solid ${TONES.warning.border};border-radius:6px;">
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0"><tr>
          <td style="font-family:${FONT};font-size:14px;font-weight:bold;color:${TEXT};">Balance due on arrival</td>
          <td align="right" style="font-family:${FONT};font-size:18px;font-weight:bold;color:${TEXT};">${safe(balanceDue)}</td>
        </tr></table>
      </td>
    </tr></table>
    ${notice ? `<p style="margin:12px 0 0;font-family:${FONT};font-size:13px;line-height:1.5;color:${MUTED};">${safe(notice)}</p>` : ''}`;
}

module.exports = {
  COLORS: { BRAND, BRAND_LIGHT, BORDER, TEXT, MUTED, FONT },
  safe,
  formatDate,
  humanize,
  greeting,
  statusBanner,
  callout,
  referenceBlock,
  dateBlock,
  infoRows,
  sectionTitle,
  paymentSummary,
};