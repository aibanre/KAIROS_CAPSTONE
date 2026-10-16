// utils/cloudinaryUpload.js
const cloudinary = require('../config/cloudinary');

function uploadImageToCloudinary(fileBuffer, folder) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image' },
      (error, result) => {
        if (error) return reject(error);
        return resolve(result.secure_url);
      }
    );

    uploadStream.end(fileBuffer);
  });
}

function getCloudinaryPublicId(imageUrl) {
  const parsedUrl = new URL(imageUrl);
  if (parsedUrl.hostname !== 'cloudinary.com' && !parsedUrl.hostname.endsWith('.cloudinary.com')) {
    throw new Error('Cannot delete an image that is not hosted by Cloudinary.');
  }

  const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
  const uploadIndex = pathSegments.indexOf('upload');
  if (uploadIndex < 0 || uploadIndex === pathSegments.length - 1) {
    throw new Error('Cannot determine the Cloudinary image identifier.');
  }

  const assetSegments = pathSegments.slice(uploadIndex + 1);
  if (/^v\d+$/.test(assetSegments[0])) assetSegments.shift();
  const lastSegmentIndex = assetSegments.length - 1;
  assetSegments[lastSegmentIndex] = assetSegments[lastSegmentIndex].replace(/\.[^.]+$/, '');
  return assetSegments.join('/');
}

function deleteImageFromCloudinary(imageUrl) {
  const publicId = getCloudinaryPublicId(imageUrl);
  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(publicId, { resource_type: 'image' }, (error, result) => {
      if (error) return reject(error);
      if (result?.result !== 'ok' && result?.result !== 'not found') {
        return reject(new Error(`Cloudinary image deletion failed: ${result?.result || 'unknown result'}.`));
      }
      return resolve(result);
    });
  });
}

module.exports = { uploadImageToCloudinary, deleteImageFromCloudinary };