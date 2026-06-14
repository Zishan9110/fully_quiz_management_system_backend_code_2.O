const multer = require('multer');
const fs = require('fs');
const path = require('path');
const ErrorResponse = require('../utils/ErrorResponse');

// CHANGE: Directly save to permanent folder, not temp
const uploadDir = 'uploads/avatars';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir); // Directly save to avatars folder
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const filename = unique + path.extname(file.originalname);
    cb(null, filename);
  }
});

const imageFilter = (req, file, cb) => {
  if (/^image\/(jpeg|png|jpg|gif|webp)$/.test(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ErrorResponse('Only images allowed', 400), false);
  }
};

const SIZE = 10 * 1024 * 1024;

exports.uploadAvatar = multer({ 
  storage, 
  fileFilter: imageFilter, 
  limits: { fileSize: SIZE } 
}).single('profilePicture');

exports.uploadThumbnail = multer({ 
  storage, 
  fileFilter: imageFilter, 
  limits: { fileSize: SIZE } 
}).single('thumbnail');

exports.uploadQuestionImage = multer({ 
  storage, 
  fileFilter: imageFilter, 
  limits: { fileSize: SIZE } 
}).single('image');

exports.uploadDocument = multer({ 
  storage, 
  fileFilter: (req, file, cb) => {
    const allowed = /\.(pdf|doc|docx|xls|xlsx|csv|txt)$/i;
    if (allowed.test(file.originalname)) cb(null, true);
    else cb(new ErrorResponse('Invalid file type', 400), false);
  }, 
  limits: { fileSize: SIZE } 
}).single('file');