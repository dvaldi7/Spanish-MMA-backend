const pool = require("../config/db");

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
};

//Crear nueva compañía
const createCompanies = async (req, res) => {
    const { name, headquarters, country } = req.body;

    if (!name) {
        return res.status(400).json({
            status: "error",
            message: "Falta un campo obligatorio (nombre)",
        });
    }

    try {

        const [result] = await pool.query(
            `INSERT INTO companies (name, headquarters, country) VALUES (?, ?, ?)`,
            [name, headquarters, country]
        );

        res.status(201).json({
            message: 'Compañía creada con éxito',
            companyId: result.insertId,
            data: req.body
        });


    } catch (error) {

        console.log(error);
        return res.status(500).json({
            error: "error",
            message: "Error al crear la compañía",
        });
    }
}

module.exports = {
    getCompanies,
    createCompanies,
}