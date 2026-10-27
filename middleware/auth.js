require('dotenv').config();
const jwt = require('jsonwebtoken');
const { JWT_ALGORITHMS, JWT_ISSUER, JWT_AUDIENCE } = require('../config/jwt');

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
        // TASK-0006: solo HS256 y tokens emitidos por esta API (iss/aud)
        const decoded = jwt.verify(token, process.env.JWT_SECRET, {
            algorithms: JWT_ALGORITHMS,
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE,
        });
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