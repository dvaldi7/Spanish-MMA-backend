// Contrato JWT de Spanish-MMA (TASK-0006 paso 1): compartido por sign y verify
// para que ambos evolucionen siempre juntos.
module.exports = {
    JWT_ALGORITHMS: ['HS256'],
    JWT_ISSUER: 'spanish-mma-api',
    JWT_AUDIENCE: 'spanish-mma-web',
    JWT_EXPIRES_IN: '1h',
};
