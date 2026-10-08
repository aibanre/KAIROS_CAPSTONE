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

function deleteImageFromCloudinary(secureUrl) {
  if (!secureUrl) return Promise.resolve();

  const uploadMarker = '/upload/';
  const uploadIndex = secureUrl.indexOf(uploadMarker);
  if (uploadIndex < 0) return Promise.resolve();

  const publicIdWithVersion = secureUrl.slice(uploadIndex + uploadMarker.length).split('?')[0];
  const publicId = publicIdWithVersion.replace(/^v\d+\//, '').replace(/\.[^/.]+$/, '');

  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(publicId, { resource_type: 'image' }, (error) => {
      if (error) return reject(error);
      return resolve();
    });
  });
}

module.exports = { uploadImageToCloudinary, deleteImageFromCloudinary };