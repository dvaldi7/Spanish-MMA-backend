const express = require('express');
const router = express.Router(); 

//Importar controllador
const companiesController = require("../controllers/companies.controllers");
const auth = require("../middleware/auth");

//RUTAS PÚBLICAS
router.get('/', companiesController.getCompanies);
router.get('/id/:id', companiesController.getCompaniesById);
router.get('/slug/:slug', companiesController.getCompaniesBySlug);
router.get('/search', companiesController.searchCompanies);

//RUTAS PRIVADAS
router.post('/', auth(['admin']), companiesController.createCompanies);
router.put('/id/:id', auth(['admin']), companiesController.updateCompanies);
router.delete('/id/:id', auth(['admin']), companiesController.deleteCompanies);

// Exportamos el router para usarlo en index.js
module.exports = router;