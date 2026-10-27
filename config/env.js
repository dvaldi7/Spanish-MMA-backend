// Fail-fast de configuración (TASK-0006 paso 2): validación centralizada que debe
// ejecutarse antes de crear el pool o levantar el servidor.
// - Solo exige lo esencial: JWT_SECRET y la conexión MySQL según el modo
//   (DB_SOCKET para preview/auth_socket; TCP host/credenciales para producción).
// - Nunca exige servicios opcionales (Cloudinary, etc.).
// - Los mensajes nombran la variable y el problema, JAMÁS su valor (sin secretos en logs).
const REQUIRED_ALWAYS = ['JWT_SECRET'];
const REQUIRED_TCP = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const REQUIRED_SOCKET = ['DB_SOCKET', 'DB_USER', 'DB_NAME'];

const missingVars = (names) => names.filter(
    (name) => !process.env[name] || String(process.env[name]).trim() === ''
);

const validateRequiredEnv = () => {
    const missing = missingVars(REQUIRED_ALWAYS);

    if (process.env.DB_SOCKET) {
        missing.push(...missingVars(REQUIRED_SOCKET));
    } else {
        missing.push(...missingVars(REQUIRED_TCP));
    }

    if (missing.length > 0) {
        throw new Error(
            `Configuración inválida: faltan variables obligatorias (${missing.join(', ')}). ` +
            'Arranque abortado. Revisa el .env del entorno o las variables inyectadas.'
        );
    }
};

module.exports = { validateRequiredEnv };
