const express = require('express');
const cors = require('cors');
const pool = require("./config/db");
const fightersRouter = require("./routes/fighters.routes");
const companiesRouter = require("./routes/companies.routes");
const eventsRouter = require("./routes/events.routes");

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware para JSON
app.use(express.json());
app.use(cors());

// Ruta de prueba
app.get('/', (req, res) => {
  res.json({ message: 'Spanish MMA Backend funcionando 🚀' });
});

//Rutas para llamar a la API
app.use("/api/fighters", fightersRouter);
app.use("/api/events", eventsRouter);
app.use("/api/companies", companiesRouter);

// Ruta de prueba de la conexión a la base de datos
app.get('/test-db', async (req, res) => {
    try {
        // verificar la conexión
        const [rows] = await pool.query('SELECT "Conexión Exitosa" AS status');

        // Devolvemos el resultado
        res.json({ 
            message: 'Conexión a MySQL establecida correctamente', 
            status: rows[0].status 
        });
    } catch (err) {
        // Si hay un error
        console.error('Error al conectar con la base de datos:', err.message);
        res.status(500).json({ 
            error: 'Falló la conexión a la base de datos',
            details: err.code 
        });
    }
});

// Levantar servidor
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
