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

module.exports = { uploadImageToCloudinary };