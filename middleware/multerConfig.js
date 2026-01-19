const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        let subDir = 'default';
        if (file.fieldname === 'photo') subDir = 'fighters';
        else if (file.fieldname === 'logo') subDir = 'companies';
        else if (file.fieldname === 'poster') subDir = 'events';
        else if (file.fieldname === 'image') subDir = 'news';

        return {
            folder: `spanish-mma/${subDir}`, 
            allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
            public_id: `${Date.now()}-${file.originalname.replace(/\s+/g, '_').split('.')[0]}`
        };
    },
});


const upload = multer({ storage: storage });
module.exports = upload;