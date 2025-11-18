const express = require('express');
const router = express.Router(); 
const upload = require('../middleware/multerConfig');

//Importar controllador
const companiesController = require("../controllers/companies.controllers");
const auth = require("../middleware/auth");

//RUTAS PÚBLICAS
router.get('/', companiesController.getCompanies);
router.get('/id/:id', companiesController.getCompaniesById);
router.get('/slug/:slug', companiesController.getCompaniesBySlug);
router.get('/search', companiesController.searchCompanies);
router.get('/slug/:slug/fighters', companiesController.getCompanyFighters);

//RUTAS PRIVADAS
router.post('/', auth(['admin']), upload.single('logo'), companiesController.createCompanies);
router.put('/id/:id', auth(['admin']), upload.single('logo'), companiesController.updateCompanies);
router.delete('/id/:id', auth(['admin']), companiesController.deleteCompanies);

// Exportamos el router para usarlo en index.js
module.exports = router;