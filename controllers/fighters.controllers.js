const pool = require("../config/db");
const slugify = require("slugify");

//Límites del listado de luchadores (TASK-0035)
const FIGHTERS_DEFAULT_LIMIT = 10;
const FIGHTERS_MAX_LIMIT = 50;

//Normaliza page/limit dentro de una allowlist: valores inválidos vuelven al default, limit acotado a MAX
const normalizePagination = (page, limit) => {
    const parsedPage = parseInt(page, 10);
    const parsedLimit = parseInt(limit, 10);

    const safePage = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const safeLimit = Number.isInteger(parsedLimit) && parsedLimit > 0
        ? Math.min(parsedLimit, FIGHTERS_MAX_LIMIT)
        : FIGHTERS_DEFAULT_LIMIT;

    return { page: safePage, limit: safeLimit };
};

//Escapa los comodines de LIKE para que el término se trate como literal
const escapeLikePattern = (term) => term.replace(/[\\%_]/g, (char) => `\\${char}`);

//Ver peleadores
const getFighters = async (req, res) => {
    const { page, limit } = normalizePagination(req.query.page, req.query.limit);
    const searchTerm = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const offset = (page - 1) * limit;

    try {
        let sqlQuery = `SELECT f.*, c.name AS company_name, c.slug AS company_slug 
                        FROM fighters f
                        LEFT JOIN companies c ON f.company_id = c.company_id`;

        let countQuery = 'SELECT COUNT(fighter_id) AS total_fighters FROM fighters;';
        let queryParams = [];
        let countParams = [];

        if (searchTerm) {
            const searchPattern = `%${escapeLikePattern(searchTerm)}%`;
            const like = (column) => `${column} LIKE ? ESCAPE '\\\\'`;
            //COUNT sin alias; listado cualifica con f. (slug existe también en companies)
            const countWhere = `WHERE ${[
                like('first_name'),
                like('last_name'),
                like('nickname'),
                like('slug'),
                like("CONCAT_WS(' ', first_name, last_name)"),
            ].join(' OR ')}`;
            const listWhere = `WHERE ${[
                like('f.first_name'),
                like('f.last_name'),
                like('f.nickname'),
                like('f.slug'),
                like("CONCAT_WS(' ', f.first_name, f.last_name)"),
            ].join(' OR ')}`;

            countQuery = `SELECT COUNT(fighter_id) AS total_fighters FROM fighters ${countWhere}`;
            sqlQuery += ` ${listWhere} `;
            queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
            countParams.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
        }

        sqlQuery += ` ORDER BY f.fighter_id ASC LIMIT ? OFFSET ? ;`;
        queryParams.push(limit, offset);

        const [fighters] = await pool.query(sqlQuery, queryParams);
        const [totalResults] = await pool.query(countQuery, countParams);

        const totalFighters = totalResults[0].total_fighters;
        const totalPages = Math.ceil(totalFighters / limit);

        res.status(200).json({
            status: "success",
            pagination: {
                total_items: totalFighters,
                total_pages: totalPages,
                current_page: page,
                limit: limit
            },
            results: fighters.length,
            fighters: fighters,
        });

    } catch (error) {
        console.error("Error al obtener los peleadores: ", error);
        res.status(500).json({ status: "error", message: "Error al obtener los luchadores" });
    }
};

//Crear nuevo peleador
const createFighters = async (req, res) => {
    const {
        first_name,
        last_name,
        nickname,
        record_wins,
        record_losses,
        record_draws,
        company_id,
        weight_class,
        team,
        city,
        bio,
        recent_fights
    } = req.body;

    // Validación básica
    if (!first_name || !last_name) {
        return res.status(400).json({
            status: "error",
            message: "Faltan algunos campos obligatorios (nombre o apellido)",
        });
    }

    const nameForSlug = `${first_name} ${last_name}`;
    const slug = slugify(nameForSlug, { lower: true, strict: true });

    // Cloudinary nos da la URL en req.file.path
    let photo_url = req.file ? req.file.path : '';

    const final_company_id = company_id === '' ? null : parseInt(company_id);

    try {
        const [result] = await pool.query(
            `INSERT INTO fighters 
            (first_name, last_name, nickname, record_wins, record_losses, record_draws, weight_class, slug, 
            photo_url, company_id, team, city, bio, recent_fights) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                first_name,
                last_name,
                nickname,
                record_wins || 0,
                record_losses || 0,
                record_draws || 0,
                weight_class,
                slug,
                photo_url,
                final_company_id,
                team || null,
                city || null,
                bio || null,
                recent_fights || null,
            ]
        );

        res.status(201).json({
            message: 'Peleador creado con éxito',
            fighterId: result.insertId,
            photo_url: photo_url,
            slug_generated: slug,
        });

    } catch (error) {
        console.error("Error al crear el peleador: ", error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                status: "error",
                message: "Error de duplicidad: Ya existe un peleador con ese nombre (slug)",
            });
        }
        res.status(500).json({ status: "error", message: "Error al crear el peleador" });
    }
};

//Obtener peleador por ID
const getFightersById = async (req, res) => {

    const { id } = req.params;

    try {

        const sqlQuery = `SELECT f.*, c.name AS company_name, c.slug AS company_slug 
                            FROM fighters f
                            LEFT JOIN companies c ON f.company_id = c.company_id
                            WHERE f.fighter_id = ?`;
        const [fighters] = await pool.query(sqlQuery, [id]);

        if (fighters.length === 0) {
            return res.status(404).json({
                status: "Error",
                message: "La id no coincide con ningún peleador registrado",
            })
        }

        res.json(fighters[0]);

    } catch (error) {
        console.error("Error al obetener al peleador por su id: ", error);
        return res.status(500).json({
            status: "Error",
            message: "Peleador no encontrado"
        })
    }
}

//Obterner peleador por SLUG
const getFightersBySlug = async (req, res) => {

    const { slug } = req.params;

    try {
        const sqlQuery = `
      SELECT f.*, c.name AS company_name, c.slug AS company_slug FROM fighters f
      LEFT JOIN companies c ON f.company_id = c.company_id
      WHERE f.slug = ?
      LIMIT 1;
    `;

        const [fighters] = await pool.query(sqlQuery, [slug]);

        if (fighters.length === 0) {
            return res.status(404).json({
                status: "Error",
                message: "Luchador no encontrado con ese nombre",
            });
        }

        res.json(fighters[0]);

    } catch (error) {
        console.error("Error al obetener al peleador por su slug: ", error);
        return res.status(500).json({
            status: "Error",
            message: "Peleador no encontrado"
        });
    }
}

//Allowlist y validación de updateFighter (TASK-0003): solo columnas permitidas,
//tipos válidos y rechazo explícito de campos desconocidos (evita mass assignment)
const UPDATE_ALLOWED_TEXT_FIELDS = [
    'first_name',
    'last_name',
    'nickname',
    'weight_class',
    'team',
    'city',
    'bio',
    'recent_fights',
];
const UPDATE_ALLOWED_COUNT_FIELDS = ['record_wins', 'record_losses', 'record_draws'];
const UPDATE_ALLOWED_SPECIAL_FIELDS = ['company_id', 'photo_url'];
const COMPANY_ID_FIELD = 'company_id';

const isNonNegativeInteger = (value) => {
    if (typeof value === 'string') {
        // Multer entrega multipart como strings; solo dígitos (sin signos, decimales o espacios)
        return /^[0-9]+$/.test(value.trim());
    }
    return Number.isInteger(value) && value >= 0;
};

//Actualizar peleador
const updateFighter = async (req, res) => {
    const { id } = req.params;

    //1. Rechazo explícito de campos fuera de la allowlist (mass assignment y columnas ajenas)
    if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
        const allowed = [...UPDATE_ALLOWED_TEXT_FIELDS, ...UPDATE_ALLOWED_COUNT_FIELDS, ...UPDATE_ALLOWED_SPECIAL_FIELDS];
        const unknownFields = Object.keys(req.body).filter((key) => !allowed.includes(key));
        if (unknownFields.length > 0) {
            return res.status(400).json({
                status: 'error',
                message: `Campos no permitidos en la actualización de peleador: ${unknownFields.join(', ')}`,
            });
        }
    }

    const fieldsToUpdate = {};
    const validationErrors = [];

    //2. Campos de texto: solo strings (multer multipart); '' escribe vacío como el comportamiento legacy
    for (const field of UPDATE_ALLOWED_TEXT_FIELDS) {
        const value = req.body[field];
        if (value === undefined) continue;
        if (typeof value !== 'string') {
            validationErrors.push(`${field} debe ser texto`);
            continue;
        }
        fieldsToUpdate[field] = value;
    }

    //3. Counters de récord: enteros no negativos
    for (const field of UPDATE_ALLOWED_COUNT_FIELDS) {
        const value = req.body[field];
        if (value === undefined) continue;
        if (!isNonNegativeInteger(value)) {
            validationErrors.push(`${field} debe ser un número entero no negativo`);
            continue;
        }
        fieldsToUpdate[field] = typeof value === 'string' ? parseInt(value, 10) : value;
    }

    //4. company_id: id positivo o vacío (null = "Sin compañía")
    const companyIdRaw = req.body[COMPANY_ID_FIELD];
    if (companyIdRaw !== undefined) {
        if (companyIdRaw === null || (typeof companyIdRaw === 'string' && companyIdRaw.trim() === '')) {
            fieldsToUpdate[COMPANY_ID_FIELD] = null;
        } else if (isNonNegativeInteger(companyIdRaw) && parseInt(companyIdRaw, 10) > 0) {
            fieldsToUpdate[COMPANY_ID_FIELD] = typeof companyIdRaw === 'string'
                ? parseInt(companyIdRaw, 10)
                : companyIdRaw;
        } else {
            validationErrors.push('company_id debe ser un identificador positivo o vacío');
        }
    }

    //5. photo_url solo acepta vaciado (''): la foto se cambia subiendo un archivo ('photo'); evita sobrescribir el asset remoto por texto arbitrario
    const photoUrlRaw = req.body.photo_url;
    if (photoUrlRaw !== undefined) {
        if (typeof photoUrlRaw === 'string' && photoUrlRaw === '') {
            if (!req.file) fieldsToUpdate.photo_url = '';
        } else {
            validationErrors.push('photo_url solo puede vaciarse; cambia la foto subiendo un archivo');
        }
    }

    //6. Foto nueva subida a Cloudinary (única vía autorizada para photo_url)
    if (req.file) {
        fieldsToUpdate.photo_url = req.file.path;
    }

    if (validationErrors.length > 0) {
        return res.status(400).json({
            status: 'error',
            message: 'Datos de actualización inválidos',
            errors: validationErrors,
        });
    }

    if (Object.keys(fieldsToUpdate).length === 0) {
        return res.status(400).json({
            status: 'error',
            message: 'No hay datos válidos para actualizar.',
        });
    }

    const setClauses = Object.keys(fieldsToUpdate).map((key) => `${key} = ?`).join(', ');
    const query = `UPDATE fighters SET ${setClauses} WHERE fighter_id = ?`;
    const finalValues = [...Object.values(fieldsToUpdate), id];

    try {
        await pool.query(query, finalValues);
        res.status(200).json({
            message: 'Peleador actualizado con éxito',
            fighter_id: id,
            new_photo_url: fieldsToUpdate.photo_url
        });
    } catch (error) {
        console.error("Error al actualizar el peleador:", error);
        res.status(500).json({ message: 'Error al actualizar el peleador' });
    }
};
//Borrar peleador
const deleteFighter = async (req, res) => {

    const { id } = req.params;

    try {

        const sqlQuery = 'DELETE FROM fighters WHERE fighter_id = ?';
        const [result] = await pool.query(sqlQuery, [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                status: "error",
                message: "Luchador no encontrado ",
            });
        }

        console.log("Luchador eliminado con éxito!");
        res.status(204).send();

    } catch (error) {
        console.error("Error al borrar al peleador: ", error);

        res.status(500).json({
            status: "error",
            message: "Error al intentar borrar al peleador",
        })
    }

}

//Buscar peleadores (pasado a getFighters para añadirle buscador)
/*const searchFighters = async (req, res) => {
  
    const searchTerm = req.query.q;

    if (!searchTerm) {
        return res.status(400).json({
            status: "error",
            message: "Falta el parámetro de búsqueda para el peleador"
        });
    }

    try {
      
        const searchPattern = `%${searchTerm}%`;
        const sqlQuery = `SELECT f.*, c.name AS company_name, c.slug AS company_slug 
                            FROM fighters f
                            LEFT JOIN companies c ON f.company_id = c.company_id
                            WHERE f.first_name LIKE ? OR f.last_name LIKE ? OR 
                                    f.nickname LIKE ? OR f.slug LIKE ?`;

        const [fighters] = await pool.query(sqlQuery, [
            searchPattern,
            searchPattern,
            searchPattern,
            searchPattern
        ]);

        res.status(200).json({
            status: "success",
            results: fighters.length,
            fighters: fighters,
        });

    } catch (error) {
        console.error("Error al buscar luchadores: ", error);
        res.status(500).json({
            status: "error",
            message: "Error interno del servidor al realizar la búsqueda",
        });
    }
}
*/

//Añadir un peleador a una compañía
const assignFighterToCompany = async (req, res) => {

    const { fighterId, companyId } = req.params;

    try {

        const sqlQuery = 'UPDATE fighters SET company_id = ? WHERE fighter_id = ?';
        const [result] = await pool.query(sqlQuery, [companyId, fighterId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                status: "error",
                message: `Luchador con el id ${fighterId} no encontrado`,
            });
        }

        res.status(200).json({
            status: "success",
            message: `Luchador ${fighterId} asignado a la compañía ${companyId} con éxito.`,
        })

    } catch (error) {
        console.error("Error al añadir al peleador: ", error);
        res.status(500).json({
            status: "error",
            message: "Error al añadir al peleador a la compañía",
        })
    }
}




module.exports = {
    getFighters,
    createFighters,
    getFightersById,
    updateFighter,
    deleteFighter,
    getFightersBySlug,
    /*searchFighters,*/
    assignFighterToCompany,
}