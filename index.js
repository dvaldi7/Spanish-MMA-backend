require('dotenv').config();

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
