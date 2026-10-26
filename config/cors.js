// TASK-0006 paso 4: allowlist CORS configurable mediante ALLOWED_ORIGINS.
// - Sin comodines: solo orígenes explícitos.
// - Peticiones sin cabecera Origin (clientes API no navegadores) se permiten
//   sin cabeceras CORS (el middleware simplemente no añade Access-Control-*).
// - Origen no permitido: se responde SIN cabeceras CORS (el navegador bloquea la
//   lectura); la petición en sí no se rechaza con error para no generar 500.
// - ALLOWED_ORIGINS (env, separada por comas) AÑADE orígenes sin tocar código:
//   útil si Vercel sirve el frontend desde otro dominio/alias.
const DEFAULT_ORIGINS = [
    'https://spanish-mma.vercel.app', // frontend de producción (Vercel, verificado 200)
    'http://localhost:5173',          // frontend de desarrollo / preview local (Vite)
    'http://127.0.0.1:5173',
    'http://localhost:5174',          // preview vía túnel SSH del propietario (5174→5173)
    'http://127.0.0.1:5174',
];

const parseAllowedOrigins = () => {
    const extra = (process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
    return [...new Set([...DEFAULT_ORIGINS, ...extra])];
};

const buildCorsOptions = () => ({
    // Allowlist evaluada por petición (permite leer ALLOWED_ORIGINS dinámicamente en tests)
    origin(origin, callback) {
        if (!origin) return callback(null, true); // sin Origin: clientes no navegador
        if (parseAllowedOrigins().includes(origin)) return callback(null, true);
        return callback(null, false); // no permitido: sin cabeceras CORS
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false, // auth por Bearer en cabecera, sin cookies
});

module.exports = { DEFAULT_ORIGINS, parseAllowedOrigins, buildCorsOptions };
