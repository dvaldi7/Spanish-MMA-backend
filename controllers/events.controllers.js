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
        console.error("No se ha encontrado ningún evento con este nombre de Slug", error);
        res.status(500).json({
            status: "error",
            message: "No se ha encontrado ningún evento con este nombre de Slug",
        })
    }
}

//Actualizar evento
const updateEvents = async (req, res) => {

    const { id } = req.params;
    const fieldsToUpdate = req.body;

    if (!req.body || Object.keys(fieldsToUpdate).length === 0){
        return res.status(400).json({
            status: "error",
            message: "Debes enviar datos para actualizar!",
        })
    }

    try{
        const [currentEventRows] = await pool.query(
            'SELECT name FROM events WHERE event_id = ?', [id]
        );
        
        if (currentEventRows.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Evento no encontrado para actualizar",
            });
        }
        
        const currentEvent = currentEventRows[0];

        if (fieldsToUpdate.name) {
            const finalName = fieldsToUpdate.name || currentEvent.name; 
            
            fieldsToUpdate.slug = slugify(finalName, { lower: true, strict: true });
        }
        
        const validKeys = [];
        const validValues = [];
        
        for (const key in fieldsToUpdate) {
            const value = fieldsToUpdate[key];
            
            if (value !== "" && value !== null) {
                validKeys.push(key);
                validValues.push(value);
            }
        }

        if (validKeys.length === 0) {
            return res.status(400).json({ 
                 status: "error",
                 message: 'La solicitud no contiene datos válidos para actualizar' 
            });
        }

        const change = validKeys.map(key => `${key} = ?`).join(', ');
        const finalValues = [...validValues, id];
        
        const sqlUpdate = `UPDATE events SET ${change} WHERE event_id = ?`;

        const [result] = await pool.query(sqlUpdate, finalValues);

        if (result.affectedRows === 0) {
            return res.status(200).json({
                status: "success",
                message: "Evento encontrado, pero no se detectaron cambios" 
            });
        }

        res.status(200).json({ 
            status: "success",
            message: "Evento actualizado con éxito",
            data_updated: fieldsToUpdate,
        });



    }catch(error){
        console.error("No se ha podido actualizar el evento: ", error);
        
        // Manejo de error si slug duplicado
        if (error.code === 'ER_DUP_ENTRY') {
             return res.status(409).json({
                 status: "error",
                 message: "Ya existe un evento con un slug similar. Intente modificar el nombre." 
             });
        }
        
        res.status(500).json({
            status: "error",
            message: "Error al intentar actualizar el evento",
        })
    }
}

//Borrar evento
const deleteEvents = async (req, res) => {

    const { id } = req.params;

    try{

        const sqlQuery = 'DELETE FROM events WHERE event_id = ?';
        const [ result ] = await pool.query(sqlQuery, [id]);

        if (result.affectedRows === 0){
            return res.status(404).json({
                status: "error",
                message: "Evento no encontrado para eliminar",
            });
        }
        
        res.status(200).json({
            status: "success",
            message: `Evento con id ${id} eliminado`
        });

    }catch(error){
        console.error("Error al eliminar el evento: ", error);

        res.status(500).json({
            status: "error",
            message: "Error al intentar eliminar el evento",
        })
    }
}

//Añadir un peleador a un evento de MMA
const addFighterToEvent = async (req, res) => {
    
    const { eventId } = req.params;
    const { fighterId } = req.body;

    if (!fighterId){
        return res.status(400).json({
            status: "error",
            message: "Falta el campo 'fighterId' para añadir el pelador al evento",
        });
    }

    try{
        const sqlQuery = 'INSERT INTO event_fighters (event_id, fighter_id) VALUES (?, ?)';
        const values = [eventId, fighterId];

        const [ result ] = await pool.query(sqlQuery, values);

        res.status(200).json({
            status: "success",
            message: `Luchador con id ${fighterId} añadido al evento ${eventId}`,
            event_fighter_id: result.insertId,
        })

    }catch(error){
        console.error("Error al añadir al luchador al evento: ", error);

        // si el luchador ya está en el evento para que no se duplique
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                status: "error",
                message: "El luchador ya se encuentra en la lista de este evento",
            });
        }

        // Si event_id o fighter_id no existen
        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
             return res.status(404).json({
                 status: "error",
                 message: "El evento o el luchador especificado no existen",
             });
        }

        res.status(500).json({
            status: "error",
            message: "Error al añadir al luchador al evento",
        })
    }
}

//Obtener todos los peleadores de un evento
const getEventRoster = async (req, res) => {

    const { eventId } = req.params;

    try{

        const sqlQuery = `SELECT f.fighter_id, f.first_name, f.last_name, f.nickname, f.weight_class, f.slug
            FROM event_fighters ef JOIN fighters f ON ef.fighter_id = f.fighter_id WHERE ef.event_id = ?`;
        
        const [ fighters ] = await pool.query(sqlQuery, [eventId]);

        if (fighters.length === 0){
            return res.status(200).json({
                status: "success",
                message: `El evento ${eventId} no tiene luchadores asignados (o el evento no existe)`,
                roster: [],
            });
        }

        res.status(200).json({
            status: "success",
            results: fighters.length,
            roster: fighters,
        });

    }catch(error){
        console.error("Error al obtener los peleadores del evento");
        res.status(500).json({
            status: "error",
            message: "Error al obtener los peleadores del evento",
        })
    }
}

//Borrar peleadores de un evento
const deleteFighterFromEvent = async (req, res) => {

    const { eventId, fighterId } = req.params;

    try{
        const sqlQuery = 'DELETE FROM event_fighters WHERE event_id = ? AND fighter_id = ?';
        const [ result ] = await pool.query(sqlQuery, [eventId, fighterId]);

        if (result.affectedRows === 0){
            return res.status(404).json({
             status: "error",
                message: "No se ha encontrado relación entre el evento y el luchador",
            });
        }

        res.status(200).json({
            status: "success",
            message: `Luchador con id ${fighterId} eliminado del evento ${eventId}`,
        })

    }catch(error){
        console.error("Error al eliminar la relación luchador/evento: ", error);
        res.status(500).json({ 
            status: "error",
            message: "Error interno al eliminar la relación peleador/evento",
        });
    }
}

//Buscar eventos
const searchEvents = async (req, res) => {
    const searchTerm = req.query.q;

    if (!searchTerm) {
        return res.status(400).json({
            status: "error",
            message: "Falta el parámetro de búsqueda 'q' ",
        });
    }

    try {
        const searchPattern = `%${searchTerm}%`;

        const sqlQuery = `
            SELECT event_id, name, location, date, slug FROM events WHERE name LIKE ? OR location LIKE ? OR slug LIKE ?`;

        const [events] = await pool.query(sqlQuery, [searchPattern, searchPattern, searchPattern,]);

        res.status(200).json({
            status: "success",
            results: events.length,
            events: events,
        });

    } catch (error) {
        console.error("Error al buscar eventos:", error);
        res.status(500).json({
            status: "error",
            message: "Error interno del servidor al realizar la búsqueda",
        });
    }
};


module.exports = {
    getEvents,
    createEvents,
    getEventsById,
    getEventsBySlug,
    updateEvents,
    deleteEvents,
    addFighterToEvent,
    getEventRoster,
    deleteFighterFromEvent,
    searchEvents,
};