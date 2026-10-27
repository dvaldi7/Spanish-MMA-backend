// TASK-0006 paso 5: cabeceras de seguridad con Helmet para una API REST + imágenes
// estáticas (/images) detrás de Nginx.
//
// Decisiones (documentadas):
// - Defaults de Helmet: X-Content-Type-Options nosniff, X-Frame-Options SAMEORIGIN,
//   Referrer-Policy no-referrer, CSP default-src 'self', HSTS 180d + includeSubDomains,
//   COOP same-origin, COEP require-corp, y eliminación de X-Powered-By.
//   Este backend NO sirve documentos HTML (solo JSON y /images), por lo que CSP/COEP son
//   refuerzo neutro: no restringen ninguna página real.
// - Cross-Origin-Resource-Policy: 'cross-origin' (NO el default same-origin): las imágenes
//   legacy /images las incrusta el frontend de otro origen (Vercel/preview) y con
//   same-origin serían bloqueadas por el navegador.
// - HSTS: el backend está detrás de Nginx HTTPS; en respuestas por HTTP directo la
//   cabecera se ignora (inofensiva). Nginx no añade ninguna cabecera de seguridad
//   (auditado: 0 add_header), así que no hay duplicación.
// - Helmet añade HSTS también en respuestas HTTP: los navegadores la ignoran en claro.
const helmet = require('helmet');

const buildHelmetOptions = () => ({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
        useDefaults: true,
        directives: {
            'default-src': ["'self'"],
        },
    },
    strictTransportSecurity: {
        maxAge: 15552000, // 180 días
        includeSubDomains: true,
    },
    referrerPolicy: { policy: 'no-referrer' },
    frameguard: { action: 'sameorigin' },
    noSniff: true,
    xPoweredBy: false,
    crossOriginEmbedderPolicy: { policy: 'require-corp' },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
});

module.exports = { buildHelmetOptions };
