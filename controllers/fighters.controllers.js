const pool = require("../config/db");
const slugify = require("slugify");
const path = require("path"); 
const fs = require("fs/promises"); 

//Ver peleadores
const getFighters = async (req, res) => {

    const page = parseInt(req.query.page) || 1; 
    const limit = parseInt(req.query.limit) || 10;
    const searchTerm = req.query.search || '';


    const offset = (page - 1) * limit;

    try {
        let sqlQuery = `SELECT f.*, c.name AS company_name, c.slug AS company_slug 
                            FROM fighters f
                            LEFT JOIN companies c ON f.company_id = c.company_id`;

        let countQuery = 'SELECT COUNT(fighter_id) AS total_fighters FROM fighters;';

        let queryParams = [];
        let countParams = [];

        if (searchTerm){
            const searchPattern = `%${searchTerm}%`;

            const whereClause = `WHERE first_name LIKE ? OR last_name LIKE ? OR nickname LIKE ? `;
            countQuery = `SELECT COUNT(fighter_id) AS total_fighters FROM fighters ${whereClause}`;
           
            sqlQuery += ` WHERE f.first_name LIKE ? OR f.last_name LIKE ? OR f.nickname LIKE ? `;
 
            queryParams.push(searchPattern, searchPattern, searchPattern);
            countParams.push(searchPattern, searchPattern, searchPattern)
        }

        sqlQuery += ` ORDER BY f.fighter_id ASC LIMIT ? OFFSET ? ;`;

        queryParams.push(limit, offset);

        
        const [ fighters ] = await pool.query(sqlQuery, queryParams);
        const [ totalResults ] = await pool.query(countQuery, countParams);
        
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
        company_id,
        weight_class 
    } = req.body;

    const nameForSlug = `${first_name} ${last_name}`;
    const slug = slugify(nameForSlug, { lower: true, strict: true });

    let photo_url = req.file 
        ? path.join('images/fighters', req.file.filename).replace(/\\/g, '/') 
        : '';
    
    // Si compañía como string vacío, la convertimos a null
    const final_company_id = company_id === '' ? null : parseInt(company_id);

 if (!first_name || !last_name ) {
        if (req.file) {
             await fs.unlink(req.file.path).catch(err => console.error("Error al borrar archivo tras validación:", err));
        }
        return res.status(400).json({
            status: "error",
            message: "Faltan algunos campos obligatorios (nombre o apellido)",
        });
    }

    try {
        const [result] = await pool.query(
            `INSERT INTO fighters 
            (first_name, last_name, nickname, record_wins, record_losses, record_draws, weight_class, slug, 
            photo_url, company_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

        if (req.file) {
             await fs.unlink(req.file.path).catch(err => console.error("Error al borrar archivo tras fallo en DB:", err)); 
        }

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

        const sqlQuery = `SELECT f.*, c.name AS company_name, c.slug AS company_slug 
                            FROM fighters f
                            LEFT JOIN companies c ON f.company_id = c.company_id
                            WHERE f.fighter_id = ?`;
        const [ fighters ] = await pool.query(sqlQuery, [id]);

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
    const newFile = req.file; // 💡 NUEVO: Archivo subido (si existe)

    if (!req.body || Object.keys(fieldsToUpdate).length === 0 && !newFile) {
        return res.status(400).json({
            status: "error",
            message: "Debe enviar datos o un archivo para actualizar",
        });
    }

    try {
        const [currentFighterRows] = await pool.query(
            'SELECT first_name, last_name, photo_url FROM fighters WHERE fighter_id = ?', [id]
        );
        
        if (currentFighterRows.length === 0) {

            if (newFile) {
                await fs.unlink(newFile.path).catch(err => console.error("Error al borrar archivo 404:", err));
            }
            return res.status(404).json({ status: "error", message: "Luchador no encontrado para actualizar" });
        }
        
        const currentFighter = currentFighterRows[0];
        let oldPhotoPath = currentFighter.photo_url; 


        if (fieldsToUpdate.first_name || fieldsToUpdate.last_name) {
             const finalFirstName = fieldsToUpdate.first_name || currentFighter.first_name;
             const finalLastName = fieldsToUpdate.last_name || currentFighter.last_name;
             const nameForSlug = `${finalFirstName} ${finalLastName}`.trim();

             if (nameForSlug.length > 0) {
                 fieldsToUpdate.slug = slugify(nameForSlug, { lower: true, strict: true });
             }
        }
        

        if (newFile) {

            fieldsToUpdate.photo_url = path.join('images/fighters', newFile.filename).replace(/\\/g, '/');
            
            if (oldPhotoPath) {
                const fullOldPath = path.join(__dirname, '..', 'public', oldPhotoPath);
                await fs.unlink(fullOldPath).catch(err => {

                    if (err.code !== 'ENOENT') { 
                        console.error(`Error al intentar borrar la foto antigua ${oldPhotoPath}:`, err);
                    }
                });
            }
        } else if (fieldsToUpdate.photo_url === '') {
             if (oldPhotoPath) {
                const fullOldPath = path.join(__dirname, '..', 'public', oldPhotoPath);
                await fs.unlink(fullOldPath).catch(err => {
                    if (err.code !== 'ENOENT') { 
                        console.error(`Error al intentar borrar la foto antigua ${oldPhotoPath}:`, err);
                    }
                });
            }
            fieldsToUpdate.photo_url = null; 
        }

        if (fieldsToUpdate.company_id === '' || fieldsToUpdate.company_id === 'null') {
             fieldsToUpdate.company_id = null;
        }

        const validKeys = [];
        const validValues = [];
        
        for (const key in fieldsToUpdate) {
             const value = fieldsToUpdate[key];

             if (value !== undefined) {
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


        res.status(200).json({ 
            status: "success",
            message: "Luchador actualizado con éxito",
            data_updated: fieldsToUpdate,
        });

    } catch (error) {
        console.error("Error al actualizar el peleador: ", error);
        
        if (newFile) {
            await fs.unlink(newFile.path).catch(err => 
                console.error("Error al borrar archivo tras fallo de actualización:", err));
        }

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
    /*searchFighters,*/
    assignFighterToCompany,
}