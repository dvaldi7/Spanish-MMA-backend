const pool = require("../config/db");
const slugify = require("slugify");
const path = require('path');
const fs = require('fs/promises');

// Ver eventos
const getEvents = async (req, res) => {

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const searchTerm = req.query.search || '';

    const offset = (page - 1) * limit;

    // Inicializamos las consultas y los parámetros
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

// Crear eventos
const createEvents = async (req, res) => {

    try {
        const { name, location, date, is_completed } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                status: "error",
                message: "El campo nombre es obligatorio",
            });
        }

        let poster_url = null;
        if (req.file) {
            poster_url = `uploads/${req.file.filename}`;
        }

        const slug = slugify(name, { lower: true, strict: true });

        const dateValue = date && date.trim() !== '' ? date : null;
        const locationValue = location && location.trim() !== '' ? location : null;

        const [result] = await pool.query(
            `INSERT INTO events (name, slug, location, date, is_completed, poster_url)
     VALUES (?, ?, ?, ?, ?, ?)`,
            [
                name,
                slug,
                locationValue,
                dateValue,
                is_completed === "true" ? 1 : 0,
                poster_url,
            ]
        );

        res.status(201).json({
            status: "success",
            message: "Evento creado con éxito",
            event_id: result.insertId,
        });
    } catch (error) {
        console.error("Error al crear el evento:", error);

        // Manejo de error si slug duplicado
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                status: "error",
                message:
                    "Ya existe un evento con un nombre similar. Prueba con otro nombre",
            });
        }

        res.status(500).json({
            status: "error",
            message: "Error al intentar crear el evento",
        });
    }
}


//Obtener evento por ID
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

//Obterner evento por SLUG
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

//Actualizar evento
const updateEvents = async (req, res) => {
    const { id } = req.params;
    const fieldsToUpdate = req.body;

    if ((!req.body || Object.keys(fieldsToUpdate).length === 0) && !req.file) {
        return res.status(400).json({
            status: "error",
            message: "Debes enviar datos para actualizar!",
        });
    }

    try {
        const [currentEventRows] = await pool.query(
            'SELECT * FROM events WHERE event_id = ?',
            [id]
        );

        if (currentEventRows.length === 0) {

            if (req.file) {
                await fs.unlink(req.file.path).catch(err => console.error("Error al borrar archivo", err));
            }

            return res.status(404).json({
                status: "error",
                message: "Evento no encontrado para actualizar",
            });
        }

        const currentEvent = currentEventRows[0];

        // Si se envía un nuevo nombre, generar nuevo slug
        if (fieldsToUpdate.name) {
            const finalName = fieldsToUpdate.name || currentEvent.name;
            fieldsToUpdate.slug = slugify(finalName, { lower: true, strict: true });
        }

        // Si se sube un nuevo póster, reemplazar el anterior
        if (req.file) {
            const newPosterUrl = path.join('images/events', req.file.filename).replace(/\\/g, '/');

            // Borrar imagen anterior si existía
            if (currentEvent.poster_url) {
                const oldPath = path.join(__dirname, '../public', currentEvent.poster_url);
                await fs.unlink(oldPath).catch(err => console.warn("No se pudo borrar la imagen anterior:", err));
            }

            fieldsToUpdate.poster_url = newPosterUrl;
        }

        // Filtrar solo campos válidos y no vacíos
        const validKeys = [];
        const validValues = [];

        for (const key in fieldsToUpdate) {
            const value = fieldsToUpdate[key];
            if (value !== "" && value !== null && typeof value !== 'undefined') {
                validKeys.push(key);
                validValues.push(value);
            }
        }

        if (validKeys.length === 0) {
            if (req.file) {
                await fs.unlink(req.file.path).catch(err => console.error("Error al borrar archivo no utilizado:", err));
            }
            return res.status(400).json({
                status: "error",
                message: "La solicitud no contiene datos válidos para actualizar",
            });
        }

        const change = validKeys.map(key => `${key} = ?`).join(', ');
        const finalValues = [...validValues, id];

        const sqlUpdate = `UPDATE events SET ${change} WHERE event_id = ?`;

        const [result] = await pool.query(sqlUpdate, finalValues);

        if (result.affectedRows === 0) {
            return res.status(200).json({
                status: "success",
                message: "Evento encontrado, pero no se detectaron cambios",
            });
        }

        res.status(200).json({
            status: "success",
            message: "Evento actualizado con éxito",
            data_updated: fieldsToUpdate,
        });

    } catch (error) {
        console.error("No se ha podido actualizar el evento: ", error);

        // Si hay error, eliminar el archivo recién subido
        if (req.file) {
            await fs.unlink(req.file.path).catch(err => console.error("Error al borrar archivo tras fallo:", err));
        }

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                status: "error",
                message: "Ya existe un evento con un slug similar. Intente modificar el nombre.",
            });
        }

        res.status(500).json({
            status: "error",
            message: "Error al intentar actualizar el evento",
        });
    }
}

//Borrar evento
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

//Añadir un peleador a un evento de MMA
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

    try {

        const sqlQuery = `SELECT f.fighter_id, f.first_name, f.last_name, f.nickname, f.weight_class, f.slug
            FROM event_fighters ef JOIN fighters f ON ef.fighter_id = f.fighter_id WHERE ef.event_id = ?`;

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

//Borrar peleadores de un evento
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