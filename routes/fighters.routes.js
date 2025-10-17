const express = require('express');
const router = express.Router(); 

//Importar controladores 
const fightersController = require("../controllers/fighters.controllers");
const auth = require("../middleware/auth");

//Rutas públicas
router.get('/', fightersController.getFighters);
router.get('/id/:id', fightersController.getFightersById);
router.get('/slug/:slug', fightersController.getFightersBySlug);

//Rutas privadas
router.post('/', auth(['admin']), fightersController.createFighters);
router.put('/id/:id', auth(['admin']), fightersController.updateFighter);
router.delete('/id/:id', auth(['admin']), fightersController.deleteFighter);



// Exportamos el router para usarlo en index.js
module.exports = router;