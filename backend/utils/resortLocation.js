const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const pool = require('../config/db');
const { DEFAULT_RESORT_INFO } = require('../config/resortInfo');

const MAX_MAP_IMAGE_BYTES = 1024 * 1024;

function isMissingTableError(error) {
  return error?.code === 'ER_NO_SUCH_TABLE' || error?.code === 'ER_TABLEACCESS_DENIED_ERROR';
}

async function loadResortInfo() {
  try {
    const [rows] = await pool.query(
      'SELECT resort_name, address FROM ResortSettings WHERE settings_id = 1 LIMIT 1'
    );
    return {
      resortName: rows[0]?.resort_name || DEFAULT_RESORT_INFO.resort_name,
      address: rows[0]?.address || DEFAULT_RESORT_INFO.address,
    };
  } catch (error) {
    if (!isMissingTableError(error)) {
      console.error('[resortLocation] Failed to load resort settings:', error.message);
    }
    return {
      resortName: DEFAULT_RESORT_INFO.resort_name,
      address: DEFAULT_RESORT_INFO.address,
    };
  }
}

function normalizeEnvValue(value) {
  const trimmed = String(value || '').trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1).trim();
    }
  }
  return trimmed;
}

function getDirectionsUrl(address) {
  const configuredUrl = normalizeEnvValue(process.env.RESORT_MAPS_URL);
  if (configuredUrl.startsWith('https://')) {
    return { source: 'maps_url', directionsUrl: configuredUrl };
  }

  const configuredQuery = normalizeEnvValue(process.env.RESORT_MAP_QUERY);
  const query = configuredQuery || address;
  return {
    source: configuredQuery ? 'map_query' : 'address',
    directionsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
    query,
  };
}

async function readImageBuffer(response) {
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_MAP_IMAGE_BYTES) {
    throw new Error('Map image exceeds the size limit.');
  }

  if (!response.body) {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_MAP_IMAGE_BYTES) throw new Error('Map image exceeds the size limit.');
    return buffer;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_MAP_IMAGE_BYTES) throw new Error('Map image exceeds the size limit.');
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total);
}

async function fetchMapImage(query, bookingReference) {
  if (!process.env.GOOGLE_MAPS_STATIC_API_KEY) {
    console.warn(`[resortLocation] Map image skipped booking=${bookingReference}: GOOGLE_MAPS_STATIC_API_KEY is not configured.`);
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const mapUrl = new URL('https://maps.googleapis.com/maps/api/staticmap');
    mapUrl.searchParams.set('center', query);
    mapUrl.searchParams.set('zoom', '15');
    mapUrl.searchParams.set('size', '600x300');
    mapUrl.searchParams.set('scale', '2');
    mapUrl.searchParams.set('maptype', 'roadmap');
    mapUrl.searchParams.set('markers', `color:red|${query}`);
    mapUrl.searchParams.set('key', process.env.GOOGLE_MAPS_STATIC_API_KEY);

    const response = await fetch(mapUrl, { signal: controller.signal });
    const contentType = response.headers.get('content-type') || '';
    if (response.status !== 200 || !contentType.toLowerCase().startsWith('image/')) {
      throw new Error('Map image response was not a valid image.');
    }
    return await readImageBuffer(response);
  } catch (error) {
    console.warn(`[resortLocation] Map image skipped booking=${bookingReference}: map service unavailable.`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function getResortLocation(bookingReference) {
  const { resortName, address } = await loadResortInfo();
  const configuredQuery = normalizeEnvValue(process.env.RESORT_MAP_QUERY);
  const query = configuredQuery || address;
  const directions = getDirectionsUrl(address);
  const mapImageBuffer = await fetchMapImage(query, bookingReference);
  return {
    resortName,
    address,
    directionsSource: directions.source,
    directionsUrl: directions.directionsUrl,
    mapImageBuffer,
  };
}

module.exports = { getResortLocation, normalizeEnvValue };
