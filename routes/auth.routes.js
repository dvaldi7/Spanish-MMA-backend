const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controllers');
const { loginLimiter } = require('../middleware/loginRateLimiter');

// Ruta de Login: POST /api/auth/login — con rate limit solo aquí (TASK-0006 paso 3)
router.post('/login', loginLimiter, authController.login);

module.exports = router;