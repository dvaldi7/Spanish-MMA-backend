const pool = require("../config/db");
const slugify = require("slugify");

// Ver eventos
const getEvents = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const searchTerm = req.query.search || '';

    const offset = (page - 1) * limit;

    let sqlQuery = `SELECT * FROM events`;
    let countQuery = `SELECT COUNT(event_id) AS total_events FROM events`;

    let queryParams = [];
    let countParams = [];

    if (searchTerm) {
        const searchPattern = `%${searchTerm}%`;
        const whereClause = ` WHERE name LIKE ? `;
        countQuery += whereClause;
        sqlQuery += whereClause;
        queryParams.push(searchPattern);
        countParams.push(searchPattern);
    }

    sqlQuery += ` ORDER BY date ASC LIMIT ? OFFSET ? ;`;
    queryParams.push(limit, offset);

    try {
        const [events] = await pool.query(sqlQuery, queryParams);
        const [totalResults] = await pool.query(countQuery, countParams);

        const totalEvents = totalResults[0].total_events;
        const totalPages = Math.ceil(totalEvents / limit);

        res.status(200).json({
            status: "success",
            pagination: {
                total_items: totalEvents,
                total_pages: totalPages,
                current_page: page,
                limit: limit
            },
            results: events.length,
            events: events,
        });
    } catch (error) {
        console.error('Error al obtener eventos:', error);
        res.status(500).json({
            status: "error",
            message: 'Error interno del servidor al obtener eventos',
        });
    }
}

// Crear eventos con luchadores
const createEvents = async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();

        const { name, location, date, is_completed, fighter_ids } = req.body;

        if (!name || !name.trim()) {
            await connection.rollback();
            return res.status(400).json({
                status: "error",
                message: "El campo nombre es obligatorio",
            });
        }

        let poster_url = req.file ? req.file.path : null;

        const slug = slugify(name, { lower: true, strict: true });
        const dateValue = date && date.trim() !== '' ? date : null;
        const locationValue = location && location.trim() !== '' ? location : null;
        const isCompletedValue = (is_completed === 'true' || is_completed === true) ? 1 : 0;

        const [existingSlug] = await connection.query(
            `SELECT event_id FROM events WHERE slug = ?`,
            [slug]
        );

        if (existingSlug.length > 0) {
            await connection.rollback();
            return res.status(409).json({
                status: "error",
                message: "Ya existe un evento con un nombre similar. Prueba con otro nombre",
            });
        }

        // Insertar el evento
        const [result] = await connection.query(
            `INSERT INTO events (name, slug, location, date, is_completed, poster_url)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [name, slug, locationValue, dateValue, isCompletedValue, poster_url]
        );

        const eventId = result.insertId;

        // Procesar fighter_ids
        let fighterIdsArray = [];
        if (fighter_ids) {
            // Si viene como string JSON, parsearlo
            if (typeof fighter_ids === 'string') {
                try {
                    fighterIdsArray = JSON.parse(fighter_ids);
                } catch (e) {
                    console.log('fighter_ids no es JSON válido, intentando como array');
                    fighterIdsArray = Array.isArray(fighter_ids) ? fighter_ids : [fighter_ids];
                }
            } else if (Array.isArray(fighter_ids)) {
                fighterIdsArray = fighter_ids;
            } else {
                fighterIdsArray = [fighter_ids];
            }
        }

        console.log('Fighter IDs a insertar:', fighterIdsArray);

        // Insertar relaciones en event_fighters
        if (fighterIdsArray.length > 0) {
            const values = fighterIdsArray.map(fighterId => [eventId, parseInt(fighterId)]);
            await connection.query(
                'INSERT INTO event_fighters (event_id, fighter_id) VALUES ?',
                [values]
            );
        }

        await connection.commit();

        res.status(201).json({
            status: "success",
            message: "Evento creado con éxito",
            event_id: eventId,
            fighters_added: fighterIdsArray.length
        });
    } catch (error) {
        await connection.rollback();
        console.error("Error al crear el evento:", error);

        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                status: "error",
                message: "Ya existe un evento con un nombre similar. Prueba con otro nombre",
            });
        }

        res.status(500).json({
            status: "error",
            message: "Error al intentar crear el evento",
        });
    } finally {
        connection.release();
    }
}

// Obtener evento por ID
const getEventsById = async (req, res) => {
    const { id } = req.params;

    try {
        const sqlQuery = 'SELECT * FROM events WHERE event_id = ?';
        const [events] = await pool.query(sqlQuery, [id]);

        if (events.length === 0) {
            return res.status(400).json({
                status: "error",
                message: "Evento no encontrado por ID"
            });
        }

        res.status(200).json({
            status: "success",
            event: events[0],
        })
    } catch (error) {
        console.error("Error al obtener el evento: ", error);
        res.status(500).json({
            status: "error",
            message: "Error al obtener el evento",
        })
    }
}

// Obtener evento por SLUG
const getEventsBySlug = async (req, res) => {
    const { slug } = req.params;

    try {
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
    } catch (error) {
        console.error("No se ha encontrado ningún evento con este nombre de Slug", error);
        res.status(500).json({
            status: "error",
            message: "No se ha encontrado ningún evento con este nombre de Slug",
        })
    }
}

// Actualizar evento CON luchadores
const updateEvents = async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();

        const { name, location, date, is_completed, fighter_ids } = req.body;
        const { id } = req.params;

        if (!id) {
            await connection.rollback();
            return res.status(400).json({
                status: "error",
                message: "Falta el ID del evento a actualizar",
            });
        }
        
        if (!name || !name.trim()) {
            await connection.rollback();
            return res.status(400).json({
                status: "error",
                message: "El campo nombre es obligatorio",
            });
        }

        const slug = slugify(name, { lower: true, strict: true });
        const dateValue = date && date.trim() !== '' ? date : null;
        const locationValue = location && location.trim() !== '' ? location : null;
        const isCompletedValue = (is_completed === 'true' || is_completed === true) ? 1 : 0;

        let poster_url = req.file ? req.file.path : null;

        const [existingSlug] = await connection.query(
            `SELECT event_id FROM events WHERE slug = ? AND event_id != ?`,
            [slug, id]
        );

        if (existingSlug.length > 0) {
            await connection.rollback();
            return res.status(409).json({
                status: "error",
                message: "Ya existe otro evento con un nombre similar. Prueba con otro nombre",
            });
        }

        // Actualizar el evento
        let updateQuery = `
            UPDATE events 
            SET name = ?, slug = ?, location = ?, date = ?, is_completed = ?`;
        const queryParams = [name, slug, locationValue, dateValue, isCompletedValue];

        if (poster_url) {
            updateQuery += `, poster_url = ?`;
            queryParams.push(poster_url);
        }

        updateQuery += ` WHERE event_id = ?`;
        queryParams.push(id);

        const [result] = await connection.query(updateQuery, queryParams);

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({
                status: "error",
                message: "No se encontró el evento a actualizar",
            });
        }

        // Procesar fighter_ids
        let fighterIdsArray = [];
        if (fighter_ids) {
            if (typeof fighter_ids === 'string') {
                try {
                    fighterIdsArray = JSON.parse(fighter_ids);
                } catch (e) {
                    console.log('fighter_ids no es JSON válido, intentando como array');
                    fighterIdsArray = Array.isArray(fighter_ids) ? fighter_ids : [fighter_ids];
                }
            } else if (Array.isArray(fighter_ids)) {
                fighterIdsArray = fighter_ids;
            } else {
                fighterIdsArray = [fighter_ids];
            }
        }

        console.log('Fighter IDs a actualizar:', fighterIdsArray);

        // Eliminar todas las relaciones existentes
        await connection.query(
            'DELETE FROM event_fighters WHERE event_id = ?',
            [id]
        );

        // Insertar las nuevas relaciones
        if (fighterIdsArray.length > 0) {
            const values = fighterIdsArray.map(fighterId => [id, parseInt(fighterId)]);
            await connection.query(
                'INSERT INTO event_fighters (event_id, fighter_id) VALUES ?',
                [values]
            );
        }

        await connection.commit();

        res.status(200).json({
            status: "success",
            message: "Evento actualizado con éxito",
            fighters_updated: fighterIdsArray.length
        });
    } catch (error) {
        await connection.rollback();
        console.error("No se ha podido actualizar el evento: ", error);
        res.status(500).json({
            status: "error",
            message: "Error al intentar actualizar el evento",
        });
    } finally {
        connection.release();
    }
}

// Borrar evento
const deleteEvents = async (req, res) => {
    const { id } = req.params;

    try {
        const sqlQuery = 'DELETE FROM events WHERE event_id = ?';
        const [result] = await pool.query(sqlQuery, [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                status: "error",
                message: "Evento no encontrado para eliminar",
            });
        }

        res.status(200).json({
            status: "success",
            message: `Evento con id ${id} eliminado`
        });
    } catch (error) {
        console.error("Error al eliminar el evento: ", error);
        res.status(500).json({
            status: "error",
            message: "Error al intentar eliminar el evento",
        })
    }
}

// Añadir un peleador a un evento de MMA
const addFighterToEvent = async (req, res) => {
    const { eventId } = req.params;
    const { fighterId } = req.body;

    if (!fighterId) {
        return res.status(400).json({
            status: "error",
            message: "Falta el campo 'fighterId' para añadir el pelador al evento",
        });
    }

    try {
        const sqlQuery = 'INSERT INTO event_fighters (event_id, fighter_id) VALUES (?, ?)';
        const values = [eventId, fighterId];

        const [result] = await pool.query(sqlQuery, values);

        res.status(200).json({
            status: "success",
            message: `Luchador con id ${fighterId} añadido al evento ${eventId}`,
            event_fighter_id: result.insertId,
        })
    } catch (error) {
        console.error("Error al añadir al luchador al evento: ", error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                status: "error",
                message: "El luchador ya se encuentra en la lista de este evento",
            });
        }

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

// Obtener todos los peleadores de un evento
const getEventRoster = async (req, res) => {
    const { eventId } = req.params;

    try {
        const sqlQuery = `
            SELECT f.fighter_id, f.first_name, f.last_name, f.nickname, f.weight_class, f.slug, f.photo_url
            FROM event_fighters ef 
            JOIN fighters f ON ef.fighter_id = f.fighter_id 
            WHERE ef.event_id = ?`;

        const [fighters] = await pool.query(sqlQuery, [eventId]);

        if (fighters.length === 0) {
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
    } catch (error) {
        console.error("Error al obtener los peleadores del evento");
        res.status(500).json({
            status: "error",
            message: "Error al obtener los peleadores del evento",
        })
    }
}

// Borrar peleadores de un evento
const deleteFighterFromEvent = async (req, res) => {
    const { eventId, fighterId } = req.params;

    try {
        const sqlQuery = 'DELETE FROM event_fighters WHERE event_id = ? AND fighter_id = ?';
        const [result] = await pool.query(sqlQuery, [eventId, fighterId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                status: "error",
                message: "No se ha encontrado relación entre el evento y el luchador",
            });
        }

        res.status(200).json({
            status: "success",
            message: `Luchador con id ${fighterId} eliminado del evento ${eventId}`,
        })
    } catch (error) {
        console.error("Error al eliminar la relación luchador/evento: ", error);
        res.status(500).json({
            status: "error",
            message: "Error interno al eliminar la relación peleador/evento",
        });
    }
}

// Buscar eventos
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
            SELECT event_id, name, location, date, slug 
            FROM events 
            WHERE name LIKE ? OR location LIKE ? OR slug LIKE ?`;

        const [events] = await pool.query(sqlQuery, [searchPattern, searchPattern, searchPattern]);

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
}


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