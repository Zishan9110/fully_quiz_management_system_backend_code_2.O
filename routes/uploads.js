const express = require('express');
const router = express.Router();
const { protect, protectAdmin } = require('../middleware/auth');
const {
  uploadAvatar, uploadThumbnail, uploadQuestionImage, uploadDocument
} = require('../middleware/upload');
const {
  uploadProfilePicture, uploadAdminProfilePicture,
  uploadCourseThumbnail, uploadQuestionImage: uploadQuestionImageCtrl,
  uploadQuizFile, deleteImage
} = require('../controllers/uploadController');

// Student profile picture (Cloudinary)
router.post('/profile-picture', protect, uploadAvatar, uploadProfilePicture);

// Admin profile picture (Cloudinary)
router.post('/admin/profile-picture', protectAdmin, uploadAvatar, uploadAdminProfilePicture);

// Course thumbnail (Cloudinary)
router.post('/thumbnail', protectAdmin, uploadThumbnail, uploadCourseThumbnail);

// Question image (Cloudinary)
router.post('/question-image', protectAdmin, uploadQuestionImage, uploadQuestionImageCtrl);

// Quiz file upload for question extraction (disk → parse → return JSON)
router.post('/quiz-file', protectAdmin, uploadDocument, uploadQuizFile);

// Delete image from Cloudinary
router.delete('/image', protectAdmin, deleteImage);

module.exports = router;
