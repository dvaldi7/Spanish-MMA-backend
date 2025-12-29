const express = require('express');
const router = express.Router();
const path = require('path');
const upload = require('../middleware/multerConfig');
const newsController = require('../controllers/news.controllers');
const auth = require('../middleware/auth');

// Rutas públicas
router.get('/', newsController.getNews)

// Rutas privadas
router.post('/', auth(['admin']), upload.single('image'), newsController.createNews);



module.exports = router;