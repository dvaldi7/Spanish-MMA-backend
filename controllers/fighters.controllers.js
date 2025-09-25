const pool = require("../config/db");

// Ruta luchadores
const getFighters = async (req, res) => {
    try {
        const [fighters] = await pool.query('SELECT * FROM fighters');
        res.json(fighters); 

    } catch (err) { 
        console.error("Error al obtener los peleadores", err)
        res.status(500).json({
            error: "Error al obtener luchadores",
        });
    }
};

module.exports = {
    getFighters,
}