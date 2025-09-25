const express = require('express');
const pool = require('../config/db');
const router = express.Router(); 

// Ruta eventos
router.get('/', async (req, res) => {
    try {
        const [events] = await pool.query('SELECT * FROM events');
        res.json(events);

    } catch (err) {
        console.error('Error al obtener eventos:', err);
        res.status(500).json({ error: 'Error interno del servidor al obtener eventos.' });
    }
});

// Exportamos el router para usarlo en index.js
module.exports = router;