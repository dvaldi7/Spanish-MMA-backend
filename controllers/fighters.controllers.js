const pool = require("../config/db");

// Ver luchadores
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

// Crear nuevo peleador
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

   if (!first_name || !last_name || !weight_class) {
        return res.status(400).json({
            status: "error",
            message: "Faltan algunos campos obligatorios (nombre, apellido o apodo)",
        });
    }

    try {
        const [result] = await pool.query(
                    `INSERT INTO fighters 
            (first_name, last_name, nickname, record_wins, record_losses, record_draws, weight_class) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                first_name, 
                last_name, 
                nickname, 
                record_wins || 0, 
                record_losses || 0, 
                record_draws || 0, 
                weight_class
            ]
        );
        
                res.status(201).json({
                    message: 'Peleador creado con éxito',
                    fighterId: result.insertId,
                    data: req.body
                });
    
    } catch (error) {
        console.error("Error al crear el peleador: ", error);
        res.status(500).json({
            status: "error",
            message: "Error al crear el peleador",
        })
    }
}

module.exports = {
    getFighters,
    createFighters,
}