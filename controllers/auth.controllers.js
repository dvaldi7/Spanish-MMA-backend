require('dotenv').config(); 

const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const login = async (req, res) => {
   
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            status: "error", 
            message: "Faltan email o contraseña",
         });
    }

    try {
      
        const [users] = await pool.query(
            'SELECT user_id, password_hash, role FROM users WHERE email = ?', 
            [email]
        );
        
        if (users.length === 0) {
            return res.status(401).json({
                status: "error",
                message: "Credenciales inválidas",
            });
        }
        
        const user = users[0];

        const isMatch = await bcrypt.compare(password, user.password_hash);
        
        if (!isMatch) {
            return res.status(401).json({
                status: "error",
                message: "Credenciales inválidas",
            });
        }

        const payload = { 
            user_id: user.user_id, 
            role: user.role,
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' }); 

        res.status(200).json({ 
            status: "success", 
            message: "Login exitoso",
            token: token,
            role: user.role
        });

    } catch (error) {
        console.error("Error en el login:", error);
        res.status(500).json({
            status: "error",
            message: "Error interno del servidor",
        });
    }
};

module.exports = { login };