const express = require('express');
const router = express.Router(); 
const path = require('path');

//Importar controladores 
const fightersController = require("../controllers/fighters.controllers");
const auth = require("../middleware/auth");
const multer = require('multer');

// Configuración de Multer

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/images/fighters'); 
    },

    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname); 
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }
}).single('photo');

//Rutas públicas
router.get('/', fightersController.getFighters);
router.get('/id/:id', fightersController.getFightersById);
router.get('/slug/:slug', fightersController.getFightersBySlug);
/*router.get('/search', fightersController.searchFighters);*/

//Rutas privadas
router.post('/', auth(['admin']), upload, fightersController.createFighters);
router.put('/id/:id', auth(['admin']), upload, fightersController.updateFighter);
router.put('/assign/:fighterId/company/:companyId', auth(['admin']), fightersController.assignFighterToCompany);
router.delete('/id/:id', auth(['admin']), fightersController.deleteFighter);



// Exportamos el router para usarlo en index.js
module.exports = router;