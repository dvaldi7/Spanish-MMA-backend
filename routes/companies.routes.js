const express = require('express');
const router = express.Router(); 

//Importar controllador
const companiesController = require("../controllers/companies.controllers");

//Rutas
router.get('/', companiesController.getCompanies);
router.post('/', companiesController.createCompanies);

// Exportamos el router para usarlo en index.js
module.exports = router;