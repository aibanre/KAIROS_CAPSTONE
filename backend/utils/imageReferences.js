function parseImageUrls(images) {
  if (!images) return [];
  if (Array.isArray(images)) return images.map(String).map((value) => value.trim()).filter(Boolean);
  try {
    const parsed = JSON.parse(images);
    return Array.isArray(parsed) ? parseImageUrls(parsed) : parsed ? [String(parsed).trim()] : [];
  } catch (error) {
    return [String(images).trim()].filter(Boolean);
  }
}

function isCloudinaryUrlForFolder(value, folder) {
  try {
    const url = new URL(value);
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    return url.protocol === 'https:'
      && url.hostname === 'res.cloudinary.com'
      && (!cloudName || url.pathname.startsWith(`/${cloudName}/image/upload/`))
      && url.pathname.includes(`/${folder}/`);
  } catch (error) {
    return false;
  }
}

async function validateExistingImage(pool, imageUrl, folder) {
  if (typeof imageUrl !== 'string' || !imageUrl.trim()) return null;
  const candidate = imageUrl.trim();
  const [rooms] = await pool.query('SELECT images FROM Rooms WHERE images IS NOT NULL AND images <> ""');
  const [venues] = await pool.query('SELECT images FROM Venues WHERE images IS NOT NULL AND images <> ""');
  const referenced = [...rooms, ...venues].some((row) => parseImageUrls(row.images).includes(candidate));
  return referenced || isCloudinaryUrlForFolder(candidate, folder) ? candidate : null;
}

module.exports = { parseImageUrls, validateExistingImage };
