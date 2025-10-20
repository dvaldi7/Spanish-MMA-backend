const pool = require("../config/db");
const slugify = require("slugify");

//Ver peleadores
const getFighters = async (req, res) => {
    try {
        const sqlQuery = `SELECT f.*, c.name AS company_name, c.slug AS company_slug 
                            FROM fighters f
                            LEFT JOIN companies c ON f.company_id = c.company_id
                            ORDER BY f.fighter_id ASC;`;

        const [ fighters ] = await pool.query(sqlQuery);
        
        res.status(200).json({
            status: "success",
            results: fighters.length,
            fighters: fighters,
        })

    } catch (error) {
        console.error("Error al obtener los peleadores: ", error)
        res.status(500).json({
            error: "error",
            message: "Error al obtener los luchadores",
        });
    }
}

//Crear nuevo peleador
const createFighters = async (req, res) => {
    const { 
        first_name, 
        last_name, 
        nickname, 
        record_wins, 
        record_losses, 
        record_draws, 
        weight_class 
    } = req.body;

    const nameForSlug = `${first_name} ${last_name}`;
    const slug = slugify(nameForSlug, { lower: true, strict: true });


   if (!first_name || !last_name ) {
        return res.status(400).json({
            status: "error",
            message: "Faltan algunos campos obligatorios (nombre o apellido)",
        });
    }

    try {
        const [result] = await pool.query(
                    `INSERT INTO fighters 
            (first_name, last_name, nickname, record_wins, record_losses, record_draws, weight_class, slug) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                first_name, 
                last_name, 
                nickname, 
                record_wins || 0, 
                record_losses || 0, 
                record_draws || 0, 
                weight_class,
                slug,
            ]
        );
        
                res.status(201).json({
                    message: 'Peleador creado con éxito',
                    fighterId: result.insertId,
                    data: req.body,
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

        res.status(500).json({
            status: "error",
            message: "Error al crear el peleador",
        })
    }
}

//Obtener peleador por ID
const getFightersById = async (req, res) => {

    const { id } = req.params;

    try{
        const [fighters ] = await pool.query('SELECT * FROM fighters WHERE fighter_id = ?', [id]);

        if(fighters.length === 0){
            return res.status(404).json({
                status: "Error",
                message: "La id no coincide con ningún peleador registrado",
            })
        }

        res.json(fighters[0]);

    }catch(error){
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

    try{
        const [fighters ] = await pool.query('SELECT * FROM fighters WHERE slug = ?', [slug]);

        if(fighters.length === 0){
            return res.status(404).json({
                status: "Error",
                message: "Luchador no encontrado con ese nombre",
            });
        }

        res.json(fighters[0]);

    }catch(error){
        console.error("Error al obetener al peleador por su slug: ", error);
        return res.status(500).json({
            status: "Error",
            message: "Peleador no encontrado"
        });
    }
}

//Actualizar peleador
const updateFighter = async (req, res) => {
    const { id } = req.params;
    const fieldsToUpdate = req.body;

    if (!req.body || Object.keys(fieldsToUpdate).length === 0) {
        return res.status(400).json({
            status: "error",
            message: "Debe enviar datos para actualizar",
        });
    }

    try {
        //Obtener nombre actual para asegurar SLUG completo
        const [currentFighterRows] = await pool.query(
            'SELECT first_name, last_name FROM fighters WHERE fighter_id = ?', [id]
        );
        
        if (currentFighterRows.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Luchador no encontrado para actualizar",
            });
        }
        
        const currentFighter = currentFighterRows[0];

        if (fieldsToUpdate.first_name || fieldsToUpdate.last_name) {
            
            const finalFirstName = fieldsToUpdate.first_name || currentFighter.first_name;
            const finalLastName = fieldsToUpdate.last_name || currentFighter.last_name;
            
            const nameForSlug = `${finalFirstName} ${finalLastName}`.trim();

            if (nameForSlug.length > 0) {
                fieldsToUpdate.slug = slugify(nameForSlug, { lower: true, strict: true });
            }
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
             return res.status(400).json({ error: 'La solicitud no contiene datos válidos para actualizar' });
        }

        const change = validKeys.map(key => `${key} = ?`).join(', ');
        const finalValues = [...validValues, id];
        
        const sqlUpdate = `UPDATE fighters SET ${change} WHERE fighter_id = ?`;

        const [result] = await pool.query(sqlUpdate, finalValues);

        if (result.affectedRows === 0) {
            return res.status(200).json({
                status: "success",
                message: "Luchador encontrado, pero no se detectaron cambios",
            });
        }

        res.status(200).json({ 
            status: "success",
            message: "Luchador actualizado con éxito",
            data_updated: fieldsToUpdate,
        });

    } catch (error) {
        console.error("Error al actualizar el peleador: ", error);
        
        //Manejo de error de clave duplicada en el slug
        if (error.code === 'ER_DUP_ENTRY') {
             return res.status(409).json({
                 error: "error", 
                 message: "Ya existe otro luchador con un nombre de slug similar. Modifca el nombre",
                });
        }

        res.status(500).json({ 
            status: "error",
            message: "Error interno al actualizar el peleador" 
        });
    }
}

//Borrar peleador
const deleteFighter = async (req, res) => {

    const { id } = req.params;

    try{

        const sqlQuery = 'DELETE FROM fighters WHERE fighter_id = ?';
        const [ result ] = await pool.query(sqlQuery, [id] );

           if (result.affectedRows === 0) {
                return res.status(404).json({ 
                    status: "error",
                    message: "Luchador no encontrado ",
                });
            }

        console.log("Luchador eliminado con éxito!");
        res.status(204).send();
        
    }catch(error){
        console.error("Error al borrar al peleador: ", error);

        res.status(500).json({
            status: "error",
            message: "Error al intentar borrar al peleador",
        })
    }

}

//Buscar peleadores
const searchFighters = async (req, res) => {
  
    const searchTerm = req.query.q;

    if (!searchTerm) {
        return res.status(400).json({
            status: "error",
            message: "Falta el parámetro de búsqueda para el peleador"
        });
    }

    try {
      
        const searchPattern = `%${searchTerm}%`;
        const sqlQuery = `
            SELECT 
                fighter_id, first_name, last_name, nickname, weight_class, slug 
            FROM fighters 
            WHERE first_name LIKE ? OR last_name LIKE ? OR nickname LIKE ? OR slug LIKE ?
        `;

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

//Añadir un peleador a una compañía
const assignFighterToCompany = async (req, res) => {

    const { fighterId, companyId } = req. params;

    try{

        const sqlQuery = 'UPDATE fighters SET company_id = ? WHERE fighter_id = ?';
        const [ result ] = await pool.query(sqlQuery, [companyId, fighterId]);

        if (result.affectedRows === 0){
            return res.status(404).json({
                status: "error",
                message: `Luchador con el id ${fighterId} no encontrado`,
            });
        }

        res.status(200).json({
            status: "success",
            message: `Luchador ${fighterId} asignado a la compañía ${companyId} con éxito.`,
        })

    }catch(error){
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
    searchFighters,
    assignFighterToCompany,
}