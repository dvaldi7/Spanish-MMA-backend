const pool = require("../config/db");

// Ver compañías
const getCompanies = ('/', async (req, res) => {
    try {
        const [companies] = await pool.query('SELECT * FROM companies');
        res.json(companies);

    } catch (err) {
        console.error('Error al obtener compañías:', err);
        res.status(500).json({
            error: 'Error interno del servidor al obtener compañías.'
        });
    }
});

//Crear nueva compañía


module.exports= {
    getCompanies,
}