const express = require('express');
const router = express.Router();
const path = require('path');
const upload = require('../middleware/multerConfig');
const fightersController = require('../controllers/fighters.controllers');
const auth = require('../middleware/auth');

// Rutas públicas
router.get('/', fightersController.getFighters);
router.get('/id/:id', fightersController.getFightersById);
router.get('/slug/:slug', fightersController.getFightersBySlug);

// Rutas privadas
router.post('/', auth(['admin']), upload.single('photo'), fightersController.createFighters);
router.put('/id/:id', auth(['admin']), upload.single('photo'), fightersController.updateFighter);
router.put('/assign/:fighterId/company/:companyId', auth(['admin']), fightersController.assignFighterToCompany);
router.delete('/id/:id', auth(['admin']), fightersController.deleteFighter);

module.exports = router;
