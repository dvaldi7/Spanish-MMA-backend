const pool = require("../config/db");
const slugify = require('slugify'); 

// Ver compañías
const getCompanies = async (req, res) => {
    try {
        const [companies] = await pool.query('SELECT * FROM companies');
        res.json(companies);

    } catch (error){
        console.error('Error al obtener compañías:', error)
        res.status(500).json({
            error: 'Error interno del servidor al obtener compañías.'
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

//Actualizar compañías

//Borrar compañías

module.exports = {
    getCompanies,
    createCompanies,
    getCompaniesById,
}