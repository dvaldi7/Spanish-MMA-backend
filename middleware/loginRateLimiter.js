// TASK-0006 paso 3: rate limit del login (10 intentos FALLIDOS / 15 min / IP).
// - skipSuccessfulRequests: el login correcto no consume cupo (sin lockout del admin).
// - standardHeaders draft-7: incluye Retry-After en la respuesta 429.
// - Clave: req.ip, que con trust proxy 'loopback' es la IP real del cliente
//   (XFF solo se confía cuando el socket llega de Nginx; conexiones directas no).
// - Store en memoria del proceso: se limpia en restart (sin Redis, sin persistencia).
const rateLimit = require('express-rate-limit');

const createLoginLimiter = () => rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
        status: 'error',
        message: 'Demasiados intentos fallidos de inicio de sesión. Espera 15 minutos e inténtalo de nuevo.',
    },
});

// Instancia única para la ruta real; los tests crean instancias propias con createLoginLimiter()
const loginLimiter = createLoginLimiter();

module.exports = { createLoginLimiter, loginLimiter };
