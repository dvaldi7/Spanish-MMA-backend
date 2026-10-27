// TASK-0006 paso 6: manejador global de errores (Express 5 — los errores de rutas
// asíncronas también llegan aquí) y 404 JSON para rutas /api inexistentes.
//
// - Logs útiles sin secretos: método, ruta y tipo de error; JAMÁS body/headers
//   (pueden contener credenciales o tokens) ni valores de la BD.
// - Respuestas: 500 genérico (sin stack ni detalles internos); errores de cliente
//   (<500) conservan el mensaje porque no son internos.
// - Si la respuesta ya se envió, delega en Express (sin duplicar respuesta).

const notFoundApi = (req, res) => {
    res.status(404).json({
        status: 'error',
        message: 'Ruta no encontrada',
    });
};

const errorHandler = (err, req, res, next) => {
    // req.path (sin query string): evita registrar posibles secretos en parámetros de URL
    console.error(`[error] ${req.method} ${req.path} -> ${err.name || 'Error'}: ${err.message}`);

    if (res.headersSent) return next(err);

    const status = Number(err.status || err.statusCode) || 500;
    if (status >= 500) {
        return res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor',
        });
    }

    // Errores de cliente generados por Express (p.ej. JSON inválido en el body)
    const message = err.type === 'entity.parse.failed'
        ? 'El cuerpo de la petición no es JSON válido'
        : err.message;

    return res.status(status).json({ status: 'error', message });
};

module.exports = { errorHandler, notFoundApi };
