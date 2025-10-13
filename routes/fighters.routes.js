const express = require('express');
const router = express.Router(); 

//Importar controladores 
const fightersController = require("../controllers/fighters.controllers");

//Rutas
router.get('/', fightersController.getFighters);
router.post('/', fightersController.createFighters);
router.get('/id/:id', fightersController.getFightersById);
router.get('/slug/:slug', fightersController.getFightersBySlug);
router.put('/id/:id', fightersController.updateFighter);
router.delete('/id/:id', fightersController.deleteFighter);



// Exportamos el router para usarlo en index.js
module.exports = router;