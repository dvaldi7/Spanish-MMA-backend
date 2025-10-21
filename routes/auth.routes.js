const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controllers');

// Ruta de Login: POST /api/auth/login
router.post('/login', authController.login);

module.exports = router;