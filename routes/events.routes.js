const express = require('express');
const pool = require('../config/db');
const router = express.Router(); 

//Importar controlador
const eventsController = require("../controllers/events.controllers");

router.get('/', eventsController.getEvents);

// Exportamos el router para usarlo en index.js
module.exports = router;