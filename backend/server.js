
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Importar rutas
const salasRoutes = require('./routes/salas');
const reservacionesRoutes = require('./routes/reservaciones');
const disponibilidadRoutes = require('./routes/disponibilidad');

// Registrar rutas
app.use('/api/salas', salasRoutes);
app.use('/api/reservaciones', reservacionesRoutes);
app.use('/api/disponibilidad', disponibilidadRoutes);

// Ruta de prueba
app.get('/', (req, res) => {
    res.json({
        mensaje: 'Servidor de reservaciones funcionando correctamente.'
    });
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Servidor funcionando en http://localhost:${PORT}`);
});
