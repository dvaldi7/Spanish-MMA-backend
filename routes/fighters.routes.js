const express = require('express');
const pool = require('../config/db');
const router = express.Router(); 

// Ruta luchadores
router.get('/', async (req, res) => {
    try {
        const [fighters] = await pool.query('SELECT * FROM fighters');
        res.json(fighters);

    } catch (err) {
        console.error('Error al obtener luchadores:', err);
        res.status(500).json({ error: 'Error interno del servidor al obtener luchadores.' });
    }
});

// Exportamos el router para usarlo en index.js
module.exports = router;