
const API_URL = 'http://localhost:3000/api';

// Función general para realizar peticiones al backend
async function solicitar(endpoint, opciones = {}) {
    try {
        const respuesta = await fetch(`${API_URL}${endpoint}`, {
            ...opciones,
            headers: {
                'Content-Type': 'application/json',
                ...opciones.headers
            }
        });

        const datos = await respuesta.json().catch(() => ({}));

        if (!respuesta.ok) {
            throw new Error(
                datos.mensaje || datos.error || `Error HTTP ${respuesta.status}`
            );
        }

        return datos;

    } catch (error) {
        console.error('Error en la API:', error);
        throw error;
    }
}

// API centralizada
const API = {

    // Obtener todas las salas
    obtenerSalas() {
        return solicitar('/salas');
    },

    // Consultar disponibilidad por fecha
    obtenerDisponibilidad(fecha, espacio = 'todos') {
        const parametros = new URLSearchParams({ fecha });

        if (espacio !== 'todos') {
            parametros.append('espacio', espacio);
        }

        return solicitar(`/disponibilidad?${parametros.toString()}`);
    },

    // Registrar una reservación
    crearReservacion(datos) {
        return solicitar('/reservaciones', {
            method: 'POST',
            body: JSON.stringify(datos)
        });
    },

    // Registrar una nueva sala
    registrarSala(datos) {
        return solicitar('/salas', {
            method: 'POST',
            body: JSON.stringify(datos)
        });
    },

    // Modificar una sala existente
    modificarSala(id, datos) {
        return solicitar(`/salas/${id}`, {
            method: 'PUT',
            body: JSON.stringify(datos)
        });
    }
};

// Permite utilizar API desde app.js y admin-salas.js
window.API = API;
