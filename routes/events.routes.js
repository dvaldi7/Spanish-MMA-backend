const express = require('express');
const router = express.Router(); 

//Importar controlador
const eventsController = require("../controllers/events.controllers");

//Rutas
router.get('/', eventsController.getEvents);
router.post('/', eventsController.createEvents);
router.get('/id/:id', eventsController.getEventsById);      
router.get('/slug/:slug', eventsController.getEventsBySlug); 
router.put('/id/:id', eventsController.updateEvents);        
router.delete('/id/:id', eventsController.deleteEvents);    




// Exportamos el router para usarlo en index.js
module.exports = router;