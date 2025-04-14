const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const createUploadDirs = () => {
  const uploadDir = path.join(__dirname, '../../uploads');
  const logosDir = path.join(uploadDir, 'logos');
  
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  
  if (!fs.existsSync(logosDir)) {
    fs.mkdirSync(logosDir, { recursive: true });
  }
};

createUploadDirs();

const logoStorage = multer.diskStorage({
  destination: function(req, file, cb) {
    const uploadPath = path.join(__dirname, '../../uploads/logos');
    cb(null, uploadPath);
  },
  filename: function(req, file, cb) {
    const organizationId = req.user.organizationId;
    const fileExt = path.extname(file.originalname);
    const uniqueFilename = `${organizationId}_${uuidv4()}${fileExt}`;
    cb(null, uniqueFilename);
  }
});

const imageFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

const logoUpload = multer({
  storage: logoStorage,
  limits: {
    fileSize: 2 * 1024 * 1024
  },
  fileFilter: imageFilter
});


const uploadLogo = logoUpload.single('logo');

const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // A Multer error occurred
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: 'File is too large. Maximum size is 2MB.' });
    }
    return res.status(400).json({ message: `Upload error: ${err.message}` });
  } else if (err) {
    // Bonkers
    return res.status(500).json({ message: err.message });
  }
  next();
};

module.exports = {
  uploadLogo,
  handleMulterError
};