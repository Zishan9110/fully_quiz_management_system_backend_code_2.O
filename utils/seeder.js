const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Admin = require('../models/Admin');
const Settings = require('../models/Settings');
const connectDB = require('../config/db');

const seed = async () => {
  await connectDB();

  // Super Admin
  const existing = await Admin.findOne({ email: 'superadmin@quizmaster.com' });
  if (!existing) {
    await Admin.create({
      firstName: 'Zishan', lastName: 'Shams',
      email: 'zishanshams44@gmail.com',
      password: '11111111',
      role: 'super_admin',
      permissions: {
        manageStudents: true, manageQuizzes: true, manageCourses: true,
        manageAdmins: true, viewReports: true, manageSettings: true
      }
    });
    console.log('✅ Super admin created: superadmin@quizmaster.com / Admin@123456');
  } else {
    console.log('ℹ️  Super admin already exists');
  }

  const defaultSettings = [
    { key: 'site_name',             value: 'QuizMaster',             group: 'general',  isPublic: true  },
    { key: 'site_tagline',          value: 'Enterprise Quiz System', group: 'general',  isPublic: true  },
    { key: 'allow_registration',    value: true,                     group: 'auth',     isPublic: true  },
    { key: 'email_verification',    value: true,                     group: 'auth',     isPublic: false },
    { key: 'max_file_size_mb',      value: 10,                       group: 'uploads',  isPublic: false },
    { key: 'default_quiz_duration', value: 60,                       group: 'quiz',     isPublic: true  },
    { key: 'leaderboard_enabled',   value: true,                     group: 'features', isPublic: true  }
  ];
  for (const s of defaultSettings) {
    await Settings.findOneAndUpdate({ key: s.key }, s, { upsert: true });
  }
  console.log('✅ Default settings seeded');

  mongoose.connection.close();
  console.log('🎉 Seeding complete!');
};

seed().catch(err => { console.error('❌ Seed error:', err); process.exit(1); });
