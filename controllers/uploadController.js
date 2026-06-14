const User = require('../models/User');
const Admin = require('../models/Admin');
const asyncHandler = require('../middleware/asyncHandler');
const ErrorResponse = require('../utils/ErrorResponse');
const fs = require('fs');
const path = require('path');

// @desc  Upload user profile picture - LOCAL
exports.uploadProfilePicture = asyncHandler(async (req, res, next) => {
  console.log("📸 Upload request");
  
  if (!req.file) {
    return next(new ErrorResponse('No image uploaded', 400));
  }

  try {
    // File already saved by multer, just get the URL
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    // Convert Windows backslash to forward slash for URL
    const relativePath = req.file.path.replace(/\\/g, '/');
    const imageUrl = `${baseUrl}/${relativePath}`;
    
    console.log("File saved at:", req.file.path);
    console.log("Image URL:", imageUrl);
    
    // Update user in database
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { profilePicture: imageUrl },
      { new: true }
    );
    
    return res.json({
      success: true,
      data: { 
        profilePicture: user.profilePicture,
        filePath: req.file.path
      }
    });
    
  } catch (err) {
    console.error("Upload error:", err);
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// @desc  Upload admin profile picture - LOCAL
exports.uploadAdminProfilePicture = asyncHandler(async (req, res, next) => {
  console.log("📸 Admin upload request");
  
  if (!req.file) {
    return next(new ErrorResponse('No image uploaded', 400));
  }

  try {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const relativePath = req.file.path.replace(/\\/g, '/');
    const imageUrl = `${baseUrl}/${relativePath}`;
    
    console.log("Admin file:", req.file.path);
    console.log("Admin URL:", imageUrl);
    
    const admin = await Admin.findByIdAndUpdate(
      req.admin._id,
      { profilePicture: imageUrl },
      { new: true }
    );
    
    return res.json({
      success: true,
      data: { 
        profilePicture: admin.profilePicture 
      }
    });
    
  } catch (err) {
    console.error("Upload error:", err);
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// Keep other functions (thumbnails, question images, etc.)
exports.uploadCourseThumbnail = asyncHandler(async (req, res, next) => {
  if (!req.file) return next(new ErrorResponse('No image uploaded', 400));
  
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const relativePath = req.file.path.replace(/\\/g, '/');
  const imageUrl = `${baseUrl}/${relativePath}`;
  
  res.json({ success: true, data: { url: imageUrl, public_id: req.file.filename } });
});

exports.uploadQuestionImage = asyncHandler(async (req, res, next) => {
  if (!req.file) return next(new ErrorResponse('No image uploaded', 400));
  
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const relativePath = req.file.path.replace(/\\/g, '/');
  const imageUrl = `${baseUrl}/${relativePath}`;
  
  res.json({ success: true, data: { url: imageUrl, public_id: req.file.filename } });
});

exports.uploadQuizFile = asyncHandler(async (req, res, next) => {
  if (!req.file) return next(new ErrorResponse('No file uploaded', 400));

  const ext = path.extname(req.file.originalname).toLowerCase();
  let questions = [];

  try {
    if (ext === '.csv') {
      questions = await parseCSV(req.file.path);
    } else if (ext === '.txt') {
      questions = await parseTXT(req.file.path);
    } else if (ext === '.xlsx' || ext === '.xls') {
      questions = await parseExcel(req.file.path);
    }
    
    // Clean up
    try { fs.unlinkSync(req.file.path); } catch(e) {}
    
    res.json({
      success: true,
      message: `Parsed ${questions.length} questions`,
      data: { questions, filename: req.file.originalname }
    });
  } catch (err) {
    try { if(req.file) fs.unlinkSync(req.file.path); } catch(e) {}
    return next(new ErrorResponse(`File parsing error: ${err.message}`, 400));
  }
});

exports.deleteImage = asyncHandler(async (req, res, next) => {
  const { publicId } = req.body;
  if (!publicId) return next(new ErrorResponse('publicId required', 400));
  
  // Find and delete file
  const filePath = path.join('uploads/avatars', publicId);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  
  res.json({ success: true, message: 'Image deleted' });
});

// Keep all parsers (CSV, Excel, TXT) as they were...
async function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const csvParser = require('csv-parser');
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (row) => {
        if (row.text) {
          const q = {
            text: row.text?.trim(),
            type: (row.type || 'single_choice').trim(),
            marks: parseInt(row.marks) || 1,
            difficulty: (row.difficulty || 'medium').trim(),
            subject: row.subject?.trim() || '',
            explanation: row.explanation?.trim() || ''
          };
          if (['single_choice','multiple_choice','true_false'].includes(q.type)) {
            const options = [];
            ['a','b','c','d','e'].forEach(letter => {
              if (row[`option_${letter}`]) {
                options.push({
                  text: row[`option_${letter}`].trim(),
                  isCorrect: (row.correct_option || '').toLowerCase().includes(letter)
                });
              }
            });
            q.options = options;
          } else {
            q.correctAnswer = row.correct_answer?.trim() || '';
          }
          results.push(q);
        }
      })
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

async function parseExcel(filePath) {
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const ws = wb.worksheets[0];
  if (!ws) return [];

  const questions = [];
  let headers = [];

  ws.eachRow((row, rowNum) => {
    const values = row.values.slice(1);
    if (rowNum === 1) {
      headers = values.map(v => String(v || '').toLowerCase().trim());
      return;
    }
    const obj = {};
    headers.forEach((h, i) => { obj[h] = values[i] !== undefined ? String(values[i]).trim() : ''; });
    if (obj.text) {
      const q = {
        text: obj.text,
        type: obj.type || 'single_choice',
        marks: parseInt(obj.marks) || 1,
        difficulty: obj.difficulty || 'medium',
        subject: obj.subject || '',
        explanation: obj.explanation || ''
      };
      if (['single_choice','multiple_choice','true_false'].includes(q.type)) {
        const options = [];
        ['a','b','c','d','e'].forEach(letter => {
          if (obj[`option_${letter}`]) {
            options.push({ text: obj[`option_${letter}`], isCorrect: (obj.correct_option || '').toLowerCase().includes(letter) });
          }
        });
        q.options = options;
      } else {
        q.correctAnswer = obj.correct_answer || '';
      }
      questions.push(q);
    }
  });
  return questions;
}

async function parseTXT(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const blocks = content.split(/\n\s*\n/).filter(b => b.trim());
  const questions = [];

  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) continue;

    const q = { text: '', type: 'single_choice', marks: 1, options: [], difficulty: 'medium' };

    for (const line of lines) {
      if (/^Q[\d.):]\s*/i.test(line) || (!q.text && !/^[A-E][\s.)]/i.test(line) && !/^Answer:/i.test(line))) {
        q.text = line.replace(/^Q[\d.):]\s*/i, '').trim();
      } else if (/^[A-E][\s.)]/i.test(line)) {
        const letter = line[0].toLowerCase();
        const text = line.replace(/^[A-E][\s.)]/i, '').trim();
        q.options.push({ text, isCorrect: false });
      } else if (/^Answer:/i.test(line)) {
        const ans = line.replace(/^Answer:\s*/i, '').trim().toLowerCase();
        q.options.forEach((opt, i) => {
          opt.isCorrect = ans.includes(String.fromCharCode(97 + i));
        });
      } else if (/^Marks:/i.test(line)) {
        q.marks = parseInt(line.replace(/^Marks:\s*/i, '')) || 1;
      } else if (/^Difficulty:/i.test(line)) {
        q.difficulty = line.replace(/^Difficulty:\s*/i, '').trim().toLowerCase();
      } else if (/^Subject:/i.test(line)) {
        q.subject = line.replace(/^Subject:\s*/i, '').trim();
      }
    }
    if (q.text) questions.push(q);
  }
  return questions;
}