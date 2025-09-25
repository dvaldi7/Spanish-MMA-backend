const express = require('express');
const router = express.Router(); 

//Importar controladores 
const fightersController = require("../controllers/fighters.controllers");

//Rutas
router.get('/', fightersController.getFighters);
router.post('/', fightersController.createFighters);

// Exportamos el router para usarlo en index.js
module.exports = router;