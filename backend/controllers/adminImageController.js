const pool = require('../config/db');
const { parseImageUrls } = require('../utils/imageReferences');

async function listImages(req, res) {
  try {
    const [rooms] = await pool.query("SELECT room_number, images FROM Rooms WHERE images IS NOT NULL AND images <> ''");
    const [venues] = await pool.query("SELECT venue_name, images FROM Venues WHERE images IS NOT NULL AND images <> ''");
    const images = new Map();

    const addReferences = (rows, type, labelKey) => {
      rows.forEach((row) => {
        parseImageUrls(row.images).forEach((url) => {
          const current = images.get(url) || { url, used_by: [], usage_count: 0 };
          current.used_by.push({ type, label: row[labelKey] });
          current.usage_count += 1;
          images.set(url, current);
        });
      });
    };

    addReferences(rooms, 'room', 'room_number');
    addReferences(venues, 'venue', 'venue_name');

    return res.json({
      images: [...images.values()].map((image) => ({
        url: image.url,
        used_by: image.used_by,
        usage_count: image.usage_count,
      })),
    });
  } catch (error) {
    console.error('[listImages] Error:', error.message);
    return res.status(500).json({ error: 'Failed to load uploaded images.' });
  }
}

module.exports = { listImages };
