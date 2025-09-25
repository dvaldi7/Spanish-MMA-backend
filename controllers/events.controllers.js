const pool = require("../config/db");

// Ruta eventos
const getEvents = ('/', async (req, res) => {
    try {
        const [events] = await pool.query('SELECT * FROM events');
        res.json(events);

    } catch (err) {
        console.error('Error al obtener eventos:', err);
        res.status(500).json({ 
            error: 'Error interno del servidor al obtener eventos.',
        });
    }
});


module.exports = {
    getEvents,
};