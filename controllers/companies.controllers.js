const pool = require("../config/db");
const slugify = require('slugify'); 

// Ver compañías
const getCompanies = async (req, res) => {

    const page = parseInt(req.query.page) || 1; 
    const limit = parseInt(req.query.limit) || 20; 
    
    const offset = (page - 1) * limit; 

    try {
        const sqlQuery = `SELECT * FROM companies ORDER BY company_id ASC LIMIT ? OFFSET ?;`;
        
        const countQuery = 'SELECT COUNT(company_id) AS total_companies FROM companies;';
        
        const [ companies ] = await pool.query(sqlQuery, [limit, offset]);
        const [ totalResults ] = await pool.query(countQuery);
        
        const totalCompanies = totalResults[0].total_companies;
        const totalPages = Math.ceil(totalCompanies / limit);

        res.status(200).json({
            status: "success",
            pagination: {
                total_items: totalCompanies,
                total_pages: totalPages,
                current_page: page,
                limit: limit
            },
            results: companies.length,
            companies: companies,
        });

    } catch (error){
        console.error('Error al obtener compañías:', error)
        res.status(500).json({
            status: "error",
            message: 'Error interno del servidor al obtener compañías',
        });
    }
}

//Crear nueva compañía
const createCompanies = async (req, res) => {
    const { name, headquarters, country, website } = req.body;

    if (!name) {
        return res.status(400).json({
            status: "error",
            message: "Falta un campo obligatorio (nombre)",
        });
    }

    try {
        const companySlug = slugify(name, { lower: true, strict: true });

        const sqlQuery = ` INSERT INTO companies (name, headquarters, country, website, slug) VALUES (?, ?, ?, ?, ?)`;
        const values = [
            name,
            headquarters || null,
            country || null,
            website || null,
            companySlug,
            ];

        const [result] = await pool.query(sqlQuery, values);
        const newCompanyId = result.insertId;

        res.status(201).json({
            status: "success",
            message: "Compañía creada con éxito",
            company_id: newCompanyId,
            company_slug: companySlug,
            data: req.body
        });


    } catch (error) {
        console.error("Error al crear la compañía: ", error);

        // Si el Slug ya existe
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                status: "error",
                message: "Ya existe una compañía con ese nombre (slug duplicado)",
            });
        }

        return res.status(500).json({
            error: "error",
            message: "Error al crear la compañía",
        });
    }
}

//Obtener compañías por ID
const getCompaniesById = async (req, res) => {

    const { id } = req.params;

    try{
        const sqlQuery = 'SELECT * FROM companies WHERE company_id = ?';
        const [ companies ] = await pool.query(sqlQuery, [id]);

        if (companies.length === 0){
            return res.status(404).json({
                status: "error",
                message: "Error al obtener la compañía con ese ID",
            });
        }

        res.status(200).json({
            status: "success",
            company: companies[0],
        })

    }catch(error){
        console.error("Error al obtener la compañía por su ID: ", error);

        res.status(500).json({
            status: "error",
            message: "Error al obtener la compañía por su ID",
        })
    }
}

//Obtener compañías por SLUG
const getCompaniesBySlug = async (req, res) => {

    const { slug } = req.params;

    try{

        const sqlQuery = 'SELECT * FROM companies WHERE slug = ?';
        const [ companies ] = await pool.query(sqlQuery, [slug]);

         if (companies.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Compañía no encontrada por Slug",
            });
        }

        res.status(200).json({
            status: "success",
            company: companies[0],
        });

    }catch(error){
        console.error("Error al obtener la compañía por su SLUG: ", error);

        res.status(500).json({
            status: "error",
            message: "Error al obtener la compañía por su SLUG",
        });
    }
}

//Actualizar compañías
const updateCompanies = async (req, res) => {
    
    const { id } = req.params;
    const fieldsToUpdate = req.body;

    if(!req.body || Object.keys(fieldsToUpdate).length === 0){
        return res.status(400).json({
            status: "error",
            message: "Debe enviar datos para actualizar la compañía",
        })
    }

    try{
        const [currentCompanyRows] = await pool.query('SELECT name FROM companies WHERE company_id = ?', [id]);
        
        if (currentCompanyRows.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Compañía no encontrada para actualizar",
            });
        }
        
        const currentCompany = currentCompanyRows[0];

        if (fieldsToUpdate.name) {
            const finalName = fieldsToUpdate.name || currentCompany.name; 

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
        
        const sqlUpdate = `UPDATE companies SET ${change} WHERE company_id = ?`;

        const [result] = await pool.query(sqlUpdate, finalValues);

        if (result.affectedRows === 0 && result.changedRows === 0) {
            return res.status(200).json({
                status: "success",
                message: "Compañía encontrada, pero no se detectaron cambios" 
            });
        }

        res.status(200).json({
            status: "success",
            message: "Compañía actualizada con éxito",
            data_updated: fieldsToUpdate,
        });

    }catch(error){
        console.error("Error al actualizar la compañia: ", error);

          // Error si slug está duplicado
        if (error.code === 'ER_DUP_ENTRY') {
             return res.status(409).json({
                 status: "error",
                 message: "Ya existe una compañía con un slug similar. Intente modificar el nombre." 
             });
        }

        res.status(500).json({
            status: "error",
            message: "Error al actualizar la compañia",
        });
    }
}

//Borrar compañías
const deleteCompanies = async (req, res) => {
    const { id } = req.params;

    try{

        const sqlQuery = 'DELETE FROM companies WHERE company_id = ?';
        const [ result ] = await pool.query(sqlQuery, [id]);

        if (result.affectedRows === 0){
            return res.status(400).json({
                status: "error",
                message: "Compañía no encontrada para eliminar",
            })
        }

        res.status(200).json({
            status: "success",
            message: `Compañía con id ${id} eliminada con éxito`,
        })

    }catch(error){
        console.error("Error al intentar borrar la compañía: ", error);
        res.status(500).json({
            status: "error",
            message: "Error al intentar borrar la compaía!",
        })
    }
}

//Buscar compañías
const searchCompanies = async (req, res) => {
    const searchTerm = req.query.q;

    if (!searchTerm) {
        return res.status(400).json({
            status: "error",
            message: "Falta el parámetro de búsqueda 'q' ",
        });
    }

    try {
        const searchPattern = `%${searchTerm}%`;

        const sqlQuery = `SELECT company_id, name, headquarters, slug FROM companies 
                             WHERE name LIKE ? OR headquarters LIKE ? OR slug LIKE ?`;

        const [companies] = await pool.query(sqlQuery, [searchPattern, searchPattern, searchPattern,]);

        res.status(200).json({
            status: "success",
            results: companies.length,
            companies: companies,
        });

    } catch (error) {
        console.error("Error al buscar compañías: ", error);
        res.status(500).json({
            status: "error",
            message: "Error interno del servidor al realizar la búsqueda",
        });
    }
};



module.exports = {
    getCompanies,
    createCompanies,
    getCompaniesById,
    getCompaniesBySlug,
    updateCompanies,
    deleteCompanies,
    searchCompanies,
}