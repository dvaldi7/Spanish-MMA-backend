const express = require('express');
const router = express.Router(); 

//Importar controlador
const eventsController = require("../controllers/events.controllers");

//Rutas
router.get('/', eventsController.getEvents);
router.post('/', eventsController.createEvents);
//router.get('/id/:id', eventsController.getEventById);      
//router.get('/slug/:slug', eventsController.getEventBySlug); 
//router.put('/id/:id', eventsController.updateEvent);        
//router.delete('/id/:id', eventsController.deleteEvent);    




// Exportamos el router para usarlo en index.js
module.exports = router;