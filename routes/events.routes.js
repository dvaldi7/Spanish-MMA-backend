const express = require('express');
const router = express.Router(); 

//Importar controlador
const eventsController = require("../controllers/events.controllers");

router.get('/', eventsController.getEvents);
router.post('/', eventsController.createEvents);

// Exportamos el router para usarlo en index.js
module.exports = router;