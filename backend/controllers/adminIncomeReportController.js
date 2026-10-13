const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const pool = require('../config/db');
const { ACTIONS, ENTITY_TYPES } = require('../utils/auditConstants');
const logAudit = require('../utils/logAudit');
const {
  buildMonths,
  getAttendanceColumns,
  getReportDateRange,
  getVerifiedPaymentRows,
  toCents,
} = require('../utils/reportMetrics');
const { getPaymentSummary, getSchemaAvailability } = require('../utils/paymentSummary');
const { loadResortInfo } = require('./resortSettingsController');

const FONT_PATH = path.join(__dirname, '..', 'assets', 'fonts', 'NotoSans-Regular.ttf');
const FONT_BOLD_PATH = path.join(__dirname, '..', 'assets', 'fonts', 'NotoSans-Bold.ttf');
const LOGO_PATH = path.join(__dirname, '..', 'assets', 'transparent-kaiazul.png');
const MAX_TRANSACTIONS = 2000;
let logoWarningWritten = false;

// ---------- Page grid ----------
const PAGE = { width: 595.28, height: 841.89, left: 48, right: 48, top: 54, bottom: 64 };
const CW = PAGE.width - PAGE.left - PAGE.right; // content width
const LIMIT = PAGE.height - PAGE.bottom; // lowest y content may reach
const L = PAGE.left;

const TYPE_LABELS = { deposit: 'Deposit', balance: 'Balance', full: 'Full payment (single payment)' };
const SOURCE_LABELS = { online: 'Online', 'walk-in': 'Walk-in' };

function money(cents) {
  return `₱${(Number(cents || 0) / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function compactMoney(cents) {
  return `₱${Math.round(Number(cents || 0) / 100).toLocaleString('en-US')}`;
}

function pct(part, total) {
  return total ? `${((part * 100) / total).toFixed(1)}%` : '0.0%';
}

function readableDate(value) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' });
}

function manilaDateTime(value = new Date()) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short',
  }).format(value);
}

function guestName(firstName, lastName) {
  return `${firstName || 'Guest'}${lastName ? ` ${lastName.charAt(0)}.` : ''}`;
}

function safeText(value) {
  return String(value || '').replace(/[^\x20-\x7E₱]/g, '');
}

async function getIncomeData(range) {
  const { rows: transactions, revenueDateField } = await getVerifiedPaymentRows({
    ...range, includeGuest: true,
  });
  const months = buildMonths(range.start, range.end);
  const monthMap = new Map(months.map((month) => [month.key, 0]));
  const byType = new Map([['deposit', 0], ['balance', 0], ['full', 0]]);
  const byMethod = new Map();
  const bySource = new Map();
  const byResource = new Map();
  transactions.forEach((row) => {
    const cents = toCents(row.amount);
    const monthKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit' }).format(new Date(row.revenue_date));
    monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + cents);
    byType.set(row.payment_type, (byType.get(row.payment_type) || 0) + cents);
    byMethod.set(row.method_name, (byMethod.get(row.method_name) || 0) + cents);
    bySource.set(row.booking_source, (bySource.get(row.booking_source) || 0) + cents);
    byResource.set(row.room_id ? 'Rooms' : 'Venues', (byResource.get(row.room_id ? 'Rooms' : 'Venues') || 0) + cents);
  });

  const [reservationRows] = await pool.query(
    `SELECT reservation_id, status FROM Reservations
     WHERE created_at >= CONVERT_TZ(?, ?, '+00:00')
       AND created_at < CONVERT_TZ(?, ?, '+00:00')`,
    [`${range.startDate} 00:00:00`, '+08:00', `${range.endExclusive} 00:00:00`, '+08:00']
  );
  const [outstandingRows] = await pool.query(`SELECT reservation_id FROM Reservations WHERE status IN ('confirmed', 'checked_in')`);
  const [completedRows] = await pool.query(`SELECT reservation_id, booking_reference FROM Reservations WHERE status = 'completed'`);
  const outstanding = await Promise.all(outstandingRows.map((row) => getPaymentSummary(pool, row.reservation_id)));
  const completed = await Promise.all(completedRows.map((row) => getPaymentSummary(pool, row.reservation_id)));
  const [cancelledRows] = await pool.query(
    `SELECT COALESCE(SUM(p.amount), 0) AS amount
     FROM Payments p INNER JOIN Reservations r ON r.reservation_id = p.reservation_id
     WHERE p.payment_status = 'verified' AND r.status = 'cancelled'
       AND ${revenueDateField === 'verified_at' ? 'p.verified_at' : 'p.created_at'} >= CONVERT_TZ(?, ?, '+00:00')
       AND ${revenueDateField === 'verified_at' ? 'p.verified_at' : 'p.created_at'} < CONVERT_TZ(?, ?, '+00:00')`,
    [`${range.startDate} 00:00:00`, '+08:00', `${range.endExclusive} 00:00:00`, '+08:00']
  );
  const schema = await getSchemaAvailability(pool);
  const [addonRows] = schema.addonsAvailable
    ? await pool.query(
      `SELECT COALESCE(SUM(quantity * unit_price), 0) AS amount FROM Reservation_Addons
       WHERE created_at >= CONVERT_TZ(?, ?, '+00:00') AND created_at < CONVERT_TZ(?, ?, '+00:00')`,
      [`${range.startDate} 00:00:00`, '+08:00', `${range.endExclusive} 00:00:00`, '+08:00']
    )
    : [[{ amount: 0 }]];
  const attendance = await getAttendanceColumns();
  let feeRows = [{ amount: 0 }];
  if (attendance.available) {
    [feeRows] = await pool.query(
      `SELECT COALESCE(SUM(early_checkin_fee + late_checkout_fee), 0) AS amount FROM Reservations
       WHERE fees_collected_at >= CONVERT_TZ(?, ?, '+00:00') AND fees_collected_at < CONVERT_TZ(?, ?, '+00:00')`,
      [`${range.startDate} 00:00:00`, '+08:00', `${range.endExclusive} 00:00:00`, '+08:00']
    );
  }
  return {
    transactions, months, monthMap, byType, byMethod, bySource, byResource,
    totalCents: transactions.reduce((sum, row) => sum + toCents(row.amount), 0),
    bookingCount: reservationRows.filter((row) => ['confirmed', 'checked_in', 'completed'].includes(row.status)).length,
    paymentCount: transactions.length,
    outstandingCents: outstanding.reduce((sum, item) => sum + toCents(item?.balance_due), 0),
    outstandingCount: outstanding.filter((item) => toCents(item?.balance_due) > 0).length,
    completedWithBalance: completedRows.filter((row, index) => toCents(completed[index]?.balance_due) > 0).map((row) => row.booking_reference),
    cancelledCents: toCents(cancelledRows[0]?.amount),
    addonsCents: toCents(addonRows[0]?.amount),
    feesCents: toCents(feeRows[0]?.amount),
    feesAvailable: attendance.available,
  };
}

function createPdf({ range, data, resort, staff }) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: PAGE.top, bottom: PAGE.bottom, left: PAGE.left, right: PAGE.right },
    bufferPages: true,
    autoFirstPage: false,
  });
  doc.registerFont('NotoSans', FONT_PATH);
  doc.registerFont('NotoSans-Bold', FONT_BOLD_PATH);

  const generated = new Date();
  const reference = `IR-${generated.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }).replace(/-/g, '')}-${new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: false }).format(generated).replace(':', '')}`;

  // We track our own vertical cursor and always pass explicit x / y / width,
  // so no section depends on leftover doc.x / doc.y state.
  let y = PAGE.top;
  const newPage = () => { doc.addPage(); y = PAGE.top; };
  const ensure = (height) => { if (y + height > LIMIT) newPage(); };
  const put = (str, x, yy, width, options = {}) => doc.text(str, x, yy, { width, lineBreak: false, ...options });
  const fit = (value, width) => {
    const s = String(value);
    if (doc.widthOfString(s) <= width) return s;
    let t = s;
    while (t.length > 1 && doc.widthOfString(`${t}…`) > width) t = t.slice(0, -1);
    return `${t}…`;
  };

  const heading = (title) => {
    ensure(48);
    doc.font('NotoSans-Bold').fontSize(13).fillColor('#0369a1');
    put(title, L, y, CW);
    y += 20;
  };
  const subheading = (title) => {
    ensure(40);
    doc.font('NotoSans-Bold').fontSize(9.5).fillColor('#334155');
    put(title, L, y, CW);
    y += 15;
  };
  const note = (str) => {
    doc.font('NotoSans').fontSize(8).fillColor('#64748b');
    const h = doc.heightOfString(str, { width: CW });
    ensure(h + 6);
    doc.text(str, L, y, { width: CW });
    y += h + 8;
  };

  const table = (columns, rows, { totalRow, size = 8.5, rowH = 18 } = {}) => {
    const header = () => {
      doc.rect(L, y, CW, rowH).fill('#e0f2fe');
      doc.font('NotoSans-Bold').fontSize(size).fillColor('#0c4a6e');
      let x = L;
      columns.forEach((c) => { put(c.label, x + 4, y + 5, c.width - 8, { align: c.align || 'left' }); x += c.width; });
      y += rowH;
    };
    const drawRow = (cells, bold, index) => {
      if (y + rowH > LIMIT) { newPage(); header(); }
      if (index % 2 === 1) doc.rect(L, y, CW, rowH).fill('#f8fafc');
      doc.font(bold ? 'NotoSans-Bold' : 'NotoSans').fontSize(size).fillColor('#334155');
      let x = L;
      columns.forEach((c, k) => {
        put(fit(safeText(cells[k]), c.width - 8), x + 4, y + 5, c.width - 8, { align: c.align || 'left' });
        x += c.width;
      });
      y += rowH;
    };
    ensure(rowH * 3);
    header();
    rows.forEach((row, index) => drawRow(row, false, index));
    if (totalRow) {
      doc.moveTo(L, y).lineTo(L + CW, y).lineWidth(0.8).strokeColor('#7dd3fc').stroke();
      drawRow(totalRow, true, 0);
    }
    y += 14;
  };

  const group = (keyFn) => {
    const map = new Map();
    data.transactions.forEach((row) => {
      const key = keyFn(row);
      const entry = map.get(key) || { count: 0, cents: 0 };
      entry.count += 1;
      entry.cents += toCents(row.amount);
      map.set(key, entry);
    });
    return [...map.entries()].sort((a, b) => b[1].cents - a[1].cents);
  };

  const breakdown = (labelHeader, entries, labelFn = (k) => k) => {
    const columns = [
      { label: labelHeader, width: 249 },
      { label: 'Payments', width: 80, align: 'right' },
      { label: 'Amount', width: 100, align: 'right' },
      { label: '% of total', width: 70, align: 'right' },
    ];
    if (!entries.length) { note('No verified payments in this period.'); return; }
    const rows = entries.map(([key, v]) => [labelFn(key), String(v.count), money(v.cents), pct(v.cents, data.totalCents)]);
    table(columns, rows, {
      totalRow: ['Total', String(data.paymentCount), money(data.totalCents), data.totalCents ? '100.0%' : '0.0%'],
    });
  };

  const drawChart = (buckets) => {
    const H = 120;
    const axisW = 56;
    const plotX = L + axisW;
    const plotW = CW - axisW;
    ensure(H + 40);
    const max = Math.max(...buckets.map((b) => b.cents), 1);
    doc.font('NotoSans').fontSize(7);
    for (let i = 0; i <= 4; i += 1) {
      const gy = y + H - (H * i) / 4;
      doc.moveTo(plotX, gy).lineTo(plotX + plotW, gy).lineWidth(0.5).strokeColor(i === 0 ? '#94a3b8' : '#e2e8f0').stroke();
      doc.fillColor('#64748b');
      put(compactMoney((max * i) / 4), L, gy - 4, axisW - 6, { align: 'right' });
    }
    const slot = plotW / buckets.length;
    const bw = Math.min(slot * 0.65, 30);
    const labelStep = Math.ceil(buckets.length / 12);
    buckets.forEach((b, i) => {
      const h = (H * b.cents) / max;
      const bx = plotX + slot * i + (slot - bw) / 2;
      if (h > 0) doc.rect(bx, y + H - h, bw, h).fill('#38bdf8');
      doc.font('NotoSans').fontSize(7).fillColor('#64748b');
      if (i % labelStep === 0) put(b.label, plotX + slot * i, y + H + 5, slot * labelStep, { align: 'center' });
      if (buckets.length <= 10 && h > 0) {
        doc.fillColor('#334155');
        put(compactMoney(b.cents), plotX + slot * i, y + H - h - 10, slot, { align: 'center' });
      }
    });
    y += H + 24;
  };

  // ---------- Page 1: header ----------
  newPage();
  if (fs.existsSync(LOGO_PATH)) doc.image(LOGO_PATH, L, 40, { fit: [64, 48] });
  else if (!logoWarningWritten) { console.warn(`[income-report] Logo not found: ${LOGO_PATH}`); logoWarningWritten = true; }
  const textX = L + 76;
  const textW = CW - 76;
  doc.font('NotoSans-Bold').fontSize(14).fillColor('#0f172a');
  put(safeText(resort.resort_name), textX, 42, textW);
  doc.font('NotoSans').fontSize(8).fillColor('#475569');
  put(safeText(resort.address), textX, 61, textW);
  put(`${safeText(resort.contact_number)} | ${safeText(resort.email)}`, textX, 73, textW);
  doc.moveTo(L, 98).lineTo(L + CW, 98).lineWidth(1.2).strokeColor('#38bdf8').stroke();
  y = 112;

  doc.font('NotoSans-Bold').fontSize(23).fillColor('#0369a1');
  put('Income Report', L, y, CW);
  y += 32;
  doc.font('NotoSans').fontSize(10).fillColor('#475569');
  put(`${readableDate(range.startDate)} to ${readableDate(range.endDate)}`, L, y, CW);
  put(`Generated ${manilaDateTime(generated)} | Generated by ${safeText(staff.full_name || 'Staff')}`, L, y + 14, CW);
  put(`Report reference: ${reference}`, L, y + 28, CW);
  y += 54;

  // ---------- Summary KPI cards ----------
  heading('Summary');
  const gap = 8;
  const bigW = 190;
  const smallW = (CW - bigW - gap * 3) / 3;
  const average = data.bookingCount ? Math.round(data.totalCents / data.bookingCount) : 0;
  const cards = [
    { label: 'Total verified revenue', value: money(data.totalCents), width: bigW, size: 19 },
    { label: 'Verified payments', value: String(data.paymentCount), width: smallW, size: 15 },
    { label: 'Bookings counted', value: String(data.bookingCount), width: smallW, size: 15 },
    { label: 'Average per booking', value: money(average), width: smallW, size: 13 },
  ];
  let cx = L;
  cards.forEach((card) => {
    doc.roundedRect(cx, y, card.width, 56, 6).lineWidth(0.8).fillAndStroke('#f0f9ff', '#bae6fd');
    doc.font('NotoSans').fontSize(8).fillColor('#475569');
    put(card.label, cx + 10, y + 9, card.width - 20);
    doc.font('NotoSans-Bold').fontSize(card.size).fillColor('#0f172a');
    put(card.value, cx + 10, y + 26, card.width - 20);
    cx += card.width + gap;
  });
  y += 66;
  note('Cash basis: verified payments by verification date (Asia/Manila).');

  // ---------- Breakdown tables ----------
  heading('Revenue by payment type');
  breakdown('Payment type', group((r) => r.payment_type), (k) => TYPE_LABELS[k] || k);
  note('Full payment includes walk-in bookings and older online bookings paid in one payment.');

  // ---------- Revenue over time ----------
  const startMs = Date.parse(`${range.startDate}T00:00:00Z`);
  const dayCount = Math.round((Date.parse(`${range.endDate}T00:00:00Z`) - startMs) / 86400000) + 1;
  let buckets;
  if (dayCount <= 31) {
    const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' });
    const totals = new Map();
    data.transactions.forEach((row) => {
      const key = dayFmt.format(new Date(row.revenue_date));
      totals.set(key, (totals.get(key) || 0) + toCents(row.amount));
    });
    buckets = Array.from({ length: dayCount }, (_, i) => {
      const d = new Date(startMs + i * 86400000);
      const key = d.toISOString().slice(0, 10);
      return { label: d.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }), cents: totals.get(key) || 0 };
    });
  } else {
    buckets = data.months.map(({ key, label }) => ({ label, cents: data.monthMap.get(key) || 0 }));
  }
  heading(dayCount <= 31 ? 'Revenue by day' : 'Revenue by month');
  if (buckets.length <= 1) {
    table(
      [{ label: 'Period', width: 349 }, { label: 'Amount', width: 150, align: 'right' }],
      buckets.map((b) => [b.label, money(b.cents)])
    );
  } else {
    drawChart(buckets);
  }

  heading('Revenue by payment method');
  breakdown('Payment method', group((r) => r.method_name || 'Unknown'));

  heading('Revenue by source and resource type');
  subheading('By booking source');
  breakdown('Source', group((r) => r.booking_source), (k) => SOURCE_LABELS[k] || k);
  subheading('By resource type');
  breakdown('Resource', group((r) => (r.room_id ? 'Rooms' : 'Venues')));

  // ---------- Not included in revenue ----------
  heading('Not included in revenue');
  table(
    [{ label: 'Item', width: 369 }, { label: 'Amount', width: 130, align: 'right' }],
    [
      ['Attendance fees collected (early check-in / late check-out)', data.feesAvailable ? money(data.feesCents) : 'Not available'],
      ['Add-on charges billed (extra beds)', money(data.addonsCents)],
      ['Deposits retained from cancelled reservations', money(data.cancelledCents)],
      [`Outstanding balances (${data.outstandingCount} confirmed / checked-in reservations)`, money(data.outstandingCents)],
    ]
  );
  note('These amounts are informational and are not part of verified revenue.');
  if (data.completedWithBalance.length) {
    subheading('Data-quality note');
    note(`Completed reservations that still have a balance: ${data.completedWithBalance.join(', ')}`);
  }

  // ---------- Transaction listing ----------
  heading('Transaction listing');
  if (!data.paymentCount) {
    note('No verified payments in this period.');
  } else {
    const columns = [
      { label: 'Date', width: 56 }, { label: 'Booking', width: 112 }, { label: 'Guest', width: 120 },
      { label: 'Method', width: 80 }, { label: 'Type', width: 62 }, { label: 'Amount', width: 69, align: 'right' },
    ];
    const rows = data.transactions.slice(0, MAX_TRANSACTIONS).map((row) => [
      manilaDateTime(new Date(row.revenue_date)).split(',')[0],
      row.booking_reference,
      guestName(row.first_name, row.last_name),
      row.method_name,
      TYPE_LABELS[row.payment_type] ? TYPE_LABELS[row.payment_type].split(' ')[0] : row.payment_type,
      money(toCents(row.amount)),
    ]);
    table(columns, rows, { size: 7.5, rowH: 16 });
    if (data.transactions.length > MAX_TRANSACTIONS) note(`Transaction listing truncated to ${MAX_TRANSACTIONS} rows.`);
  }

  // ---------- Signature block (kept together) ----------
  ensure(90);
  y += 16;
  const sigW = (CW - 30) / 2;
  [['Prepared by', L], ['Reviewed by', L + sigW + 30]].forEach(([caption, sx]) => {
    doc.moveTo(sx, y + 28).lineTo(sx + sigW, y + 28).lineWidth(0.7).strokeColor('#94a3b8').stroke();
    doc.font('NotoSans').fontSize(8).fillColor('#475569');
    put(caption, sx, y + 33, sigW);
  });
  y += 56;
  doc.font('NotoSans').fontSize(8).fillColor('#64748b');
  put(`Printed ${manilaDateTime(generated)}`, L, y, CW);

  // ---------- Footer pass (all pages) ----------
  const pages = doc.bufferedPageRange();
  for (let i = pages.start; i < pages.start + pages.count; i += 1) {
    doc.switchToPage(i);
    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0; // prevents the footer from creating extra pages
    const fy = PAGE.height - 40;
    doc.moveTo(L, fy - 8).lineTo(L + CW, fy - 8).lineWidth(0.5).strokeColor('#e2e8f0').stroke();
    doc.font('NotoSans').fontSize(7).fillColor('#64748b');
    put(`${safeText(resort.resort_name)} | Income Report | ${range.startDate} to ${range.endDate}`, L, fy, CW, { align: 'left' });
    put('Confidential - for internal use', L, fy, CW, { align: 'center' });
    put(`Page ${i + 1} of ${pages.count}`, L, fy, CW, { align: 'right' });
    doc.page.margins.bottom = savedBottom;
  }
  doc.end();
  return doc;
}

async function exportIncomePdf(req, res) {
  const range = getReportDateRange(req.query);
  if (range.error) return res.status(400).json({ error: range.error });
  try {
    const missingFonts = [FONT_PATH, FONT_BOLD_PATH].filter((fontPath) => !fs.existsSync(fontPath));
    if (missingFonts.length) {
      console.error(`[exportIncomePdf] Missing report font file(s): ${missingFonts.join(', ')}`);
      throw new Error('Report fonts are unavailable.');
    }
    const [data, resort, staffRows] = await Promise.all([
      getIncomeData(range),
      loadResortInfo(),
      pool.query('SELECT full_name FROM Users WHERE user_id = ? LIMIT 1', [req.user.user_id]),
    ]);
    await logAudit({
      userId: req.user.user_id,
      action: ACTIONS.REPORT_INCOME_EXPORT,
      entityType: ENTITY_TYPES.PAYMENT,
      entityId: null,
      newValue: { actor_role: req.user.role, report_type: 'income', start_date: range.startDate, end_date: range.endDate },
      ipAddress: req.ip,
    });
    const doc = createPdf({ range, data, resort, staff: staffRows[0][0] || req.user });
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="income-report_${range.startDate}_to_${range.endDate}.pdf"`,
      'Cache-Control': 'no-store',
    });
    return doc.pipe(res);
  } catch (error) {
    console.error('[exportIncomePdf] Error:', error.message);
    return res.status(500).json({ error: 'Unable to generate income report.' });
  }
}

module.exports = { exportIncomePdf };