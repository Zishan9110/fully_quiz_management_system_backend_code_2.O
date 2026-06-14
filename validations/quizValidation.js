const { body, validationResult } = require('express-validator');

const handleErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg });
  }
  next();
};

exports.createQuizValidation = [
  body('title').trim().notEmpty().withMessage('Quiz title is required').isLength({ max: 200 }),
  body('duration').isInt({ min: 1, max: 480 }).withMessage('Duration must be 1-480 minutes'),
  body('type').isIn(['exam', 'practice', 'assignment']).withMessage('Invalid quiz type'),
  handleErrors
];

exports.questionValidation = [
  body('text').trim().notEmpty().withMessage('Question text is required'),
  body('type').isIn(['single_choice','multiple_choice','true_false','fill_blank','short_answer']).withMessage('Invalid question type'),
  body('marks').isInt({ min: 1 }).withMessage('Marks must be at least 1'),
  handleErrors
];
