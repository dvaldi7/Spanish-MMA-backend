import { createRequire } from 'module';
const require = createRequire(import.meta.url);

require('dotenv').config();

// TASK-0006 paso 2: fail-fast de configuración antes de crear pool/servidor.
// Sin secretos en los mensajes: solo nombres de variables faltantes.
const { validateRequiredEnv } = require('./config/env');
try {
    validateRequiredEnv();
} catch (err) {
    console.error(`[config] ${err.message}`);
    process.exit(1);
}

const express = require('express');
const cors = require('cors');
const pool = require("./config/db");
const path = require('path');
const fightersRouter = require("./routes/fighters.routes");
const companiesRouter = require("./routes/companies.routes");
const eventsRouter = require("./routes/events.routes");
const newsRouter = require("./routes/news.routes");
const authRoutes = require("./routes/auth.routes");


import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const app = express();
const PORT = process.env.PORT || 3001;

// TASK-0006 paso 3: solo se confía en X-Forwarded-For cuando el socket llega de Nginx
// (loopback). El backend está expuesto a Internet: conexiones directas NO son confiables
// y req.ip conserva la IP real del cliente (evita evasión con XFF falsificada).
app.set('trust proxy', 'loopback');

// Middleware para JSON
app.use(express.json());
app.use(cors());
app.use('/images', express.static(path.join(__dirname, 'public', 'images')));
app.use('/api/auth', authRoutes);

// Ruta de prueba
app.get('/', (req, res) => {
    res.json({
        status: "success",
        message: 'Spanish MMA Backend funcionando 🚀',
    });
});

//Rutas para llamar a la API
app.use("/api/fighters", fightersRouter);
app.use("/api/events", eventsRouter);
app.use("/api/companies", companiesRouter);
app.use("/api/news", newsRouter);


// Levantar servidor
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
