const pool = require("../config/db");
const slugify = require("slugify");

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

        const eventSlug = slugify(name, { lower: true, strict: true });
        const sqlQuery = `
            INSERT INTO events (name, location, date, slug)
            VALUES (?, ?, ?, ?)
        `;
        const values = [name, location, date, eventSlug];

        const [result] = await pool.query(sqlQuery, values);

        res.status(201).json({
            status: "success",
            message: 'Evento creado con éxito',
            event_id: result.insertId,
            event_slug: eventSlug,
            data: req.body
        });

    } catch (error) {
        console.error("Error al crear el evento nuevo: ", error);

        //Manejo clave duplicada si existe el slug
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                status: "error",
                message: "Ya existe un evento con un nombre similar (slug duplicado)"
            });
        }

        res.status(500).json({
            status: "error",
            message: "Error al crear el nuevo evento",
        })
    }
}

//Obtener evento por ID
const getEventsById = async (req, res) => {

    const { id } = req.params;
    
    try{

        const sqlQuery = 'SELECT * FROM events WHERE event_id = ?';
        const [events] = await pool.query(sqlQuery, [id]);

        if (events.length === 0){
            return res.status(400).json({
                status: "error",
                message: "Evento no encontrado por ID"
            });
        }

        res.status(200).json({
            status: "success",
            event: events[0],
        })

    }catch(error){
        console.error("Error al obtener el evento: ", error);
        res.status(500).json({
            status: "error",
            message: "Error al obtener el evento",
        })
    }

}

//Obterner evento por SLUG
const getEventsBySlug = async (req, res) => {

    const { slug } = req.params;

    try{

        const sqlQuery = 'SELECT * FROM events WHERE slug = ?';
        const [events] = await pool.query(sqlQuery, [slug]);

        if (events.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Evento no encontrado por Slug.",
            });
        }

        res.status(200).json({
            status: "success",
            event: events[0],
        })

    }catch(error){
        console.error("No se ha encontrado ningún evento con este nombre de Slug");
        res.status(500).json({
            status: "error",
            message: "No se ha encontrado ningún evento con este nombre de Slug",
        })
    }
}

//Actualizar evento


//Borrar evento




module.exports = {
    getEvents,
    createEvents,
    getEventsById,
    getEventsBySlug,

};