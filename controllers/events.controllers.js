const pool = require("../config/db");

// Ver eventos
const getEvents = async (req, res) => {

    try {
        const [events] = await pool.query('SELECT * FROM events');
        res.json(events);

    } catch (err) {
        console.error('Error al obtener eventos:', err);
        res.status(500).json({
            error: 'Error interno del servidor al obtener eventos.',
        });
    }
};


// Crear nuevos eventos
const createEvents = async (req, res) => {

    const { name, location, date } = req.body;

    if (!name || !date) {
        return res.status(400).json({
            status: "error",
            message: "Faltan algunos campos obligatorios (nombre o fecha)",
        });
    }

    try {
        const [result] = await pool.query(
            'INSERT INTO events (name, location, date) VALUES (?, ?, ?)',
            [name, location, date]
        );

        res.status(201).json({
            message: 'Evento creado con éxito',
            eventId: result.insertId,
            data: req.body
        });

    } catch (error) {
        console.error("Error al crear el evento nuevo: ", error);
        res.status(500).json({
            status: "error",
            message: "Error al crear el nuevo evento",
        })
    }
}


module.exports = {
    getEvents,
    createEvents,

};