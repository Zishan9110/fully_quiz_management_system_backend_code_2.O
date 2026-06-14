// config/cloudinary.js
require('dotenv').config();
const cloudinary = require('cloudinary').v2;

console.log("🔥 CLOUDINARY FILE LOADED");
console.log("CLOUDINARY CHECK:");
console.log("cloud:", process.env.CLOUDINARY_CLOUD_NAME);
console.log("key:", process.env.CLOUDINARY_API_KEY);
console.log("secret exists:", !!process.env.CLOUDINARY_API_SECRET);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

module.exports = cloudinary;