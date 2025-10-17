require('dotenv').config();
const jwt = require('jsonwebtoken');

const auth = (allowedRoles) => (req, res, next) => {

    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token) {
        return res.status(401).json({
            status: "error",
            message: "Acceso denegado. Token no proporcionado",
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET); 
        req.user = decoded; 

        if (allowedRoles && !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ 
                status: "error",
                message: "Acceso prohibido. Rol insuficiente para esta operación", 
            });
        }

        next();
        
    } catch (error) {

        return res.status(401).json({
            status: "error",
            message: "Token inválido o expirado"
        });
    }
};

module.exports = auth;