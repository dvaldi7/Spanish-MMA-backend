const express = require('express');
const router = express.Router();
const upload = require('../middleware/multerConfig'); 

//Importar controlador
const eventsController = require("../controllers/events.controllers");
const auth = require("../middleware/auth");

//RUTAS PÚBLICAS
router.get('/', eventsController.getEvents);
router.get('/id/:id', eventsController.getEventsById);      
router.get('/slug/:slug', eventsController.getEventsBySlug);
router.get('/search', eventsController.searchEvents);
// Ruta para obtener los luchadores de un evento (pública)
router.get('/id/:eventId/fighters', eventsController.getEventRoster);

//RUTAS PRIVADAS
router.post('/', auth(['admin']), upload.single('poster'), eventsController.createEvents);
router.put('/id/:id', auth(['admin']), upload.single('poster'), eventsController.updateEvents);        
router.delete('/id/:id', auth(['admin']), eventsController.deleteEvents); 
// Ruta para añadir un luchador a un evento
router.post('/id/:eventId/fighters', auth(['admin']), upload.single('poster'), eventsController.addFighterToEvent);
// Ruta para eliminar un luchador de un evento
router.delete('/id/:eventId/fighters/:fighterId', auth(['admin']), eventsController.deleteFighterFromEvent);




// Exportamos el router para usarlo en index.js
module.exports = router;