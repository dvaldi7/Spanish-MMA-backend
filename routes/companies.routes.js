const express = require('express');
const pool = require('../config/db');
const router = express.Router(); 

// Ruta luchadores
router.get('/', async (req, res) => {
    try {
        const [companies] = await pool.query('SELECT * FROM companies');
        res.json(companies);

    } catch (err) {
        console.error('Error al obtener compañías:', err);
        res.status(500).json({ error: 'Error interno del servidor al obtener compañías.' });
    }
});

// Exportamos el router para usarlo en index.js
module.exports = router;