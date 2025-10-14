const express = require('express');
const router = express.Router(); 

//Importar controllador
const companiesController = require("../controllers/companies.controllers");

//Rutas
router.get('/', companiesController.getCompanies);
router.post('/', companiesController.createCompanies);
//router.get('/id/:id', companiesController.getCompaniesById);
//router.get('/slug/:slug', companiesController.getCompaniesBySlug);
//router.put('/id/:id', companiesController.updateCompanies);
//router.delete('/id/:id', companiesController.deleteCompanies);

// Exportamos el router para usarlo en index.js
module.exports = router;