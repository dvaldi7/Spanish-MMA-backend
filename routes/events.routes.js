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

// Ruta para obtener los luchadores de un evento
//router.get('/id/:eventId/fighters', eventsController.getEventRoster);

// Ruta para añadir un luchador a un evento
router.post('/id/:eventId/fighters', eventsController.addFighterToEvent);    




// Exportamos el router para usarlo en index.js
module.exports = router;