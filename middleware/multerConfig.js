const multer = require('multer');
const path = require('path');
const fs = require('fs');

const baseDir = path.join(__dirname, '../public/images');

const storage = multer.diskStorage({

destination: (req, file, cb) => {
        
      let subDir = 'default';
        
        if (file.fieldname === 'photo') {
            subDir = 'fighters'; 
        } else if (file.fieldname === 'logo') {
            subDir = 'companies'; 
        } else if (file.fieldname === 'poster') {
            subDir = 'events'; 
        }

        const uploadDir = path.join(baseDir, subDir);

        // Crear carpeta si no existe
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        cb(null, uploadDir);
      },

  filename: (req, file, cb) => {

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const safeName = file.originalname.replace(/\s+/g, '_');
    cb(null, `${uniqueSuffix}-${safeName}${ext}`);
  },
});

module.exports = multer({ storage });
