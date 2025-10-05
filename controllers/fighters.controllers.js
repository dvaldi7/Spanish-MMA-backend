const pool = require("../config/db");

// Ver peleadores
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

//Obtener peleador por ID
const getFightersById = async (req, res) => {

    const { id } = req.params;

    try{
        const [fighters ] = await pool.query('SELECT * FROM fighters WHERE fighter_id = ?', [id]);

        if(fighters.length === 0){
            return res.status(404).json({
                status: "Error",
                message: "La id no coincide con ningú peleador registrado",
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

//Actualizar peleador
const updateFighter = async (req, res) => {

    const { id } = req.params;
    const { first_name, last_name, nickname, weight_class, record_wins, record_losses, record_draws } = req.body;

    if (!req.body){
        return res.status(400).json({
            error: "Debe enviar datos para actualizar"
        })  
    }

    try{

    }catch(error){
        console.error("Error al actualizar el peleador: ", error);
        res.status(500).json({
            error: "Error interno al actualizar el peleador"
        })
    }

}

//Borrar peleador

module.exports = {
    getFighters,
    createFighters,
    getFightersById,
    updateFighter,
}