import { createRequire } from 'module';
const require = createRequire(import.meta.url);

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require("./config/db");
const path = require('path');
const fightersRouter = require("./routes/fighters.routes");
const companiesRouter = require("./routes/companies.routes");
const eventsRouter = require("./routes/events.routes");
const authRoutes = require("./routes/auth.routes");
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const app = express();
const PORT = process.env.PORT || 3001;

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


// Levantar servidor
app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
