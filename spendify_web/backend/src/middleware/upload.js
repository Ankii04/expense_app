const multer = require('multer');

// Store file in memory as buffer (perfect for ephemeral servers like Render/Vercel)
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const isCsv = file.mimetype === 'text/csv' || 
                file.mimetype === 'application/vnd.ms-excel' ||
                file.originalname.toLowerCase().endsWith('.csv');
  
  if (isCsv) {
    cb(null, true);
  } else {
    cb(new Error('Only CSV files are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

module.exports = upload;
