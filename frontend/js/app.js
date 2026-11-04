
document.addEventListener('DOMContentLoaded', () => {
    iniciarAplicacion();
});

const estadoSeleccion = {
    sala: null,
    fecha: '',
    bloques: []
};

const HORARIOS = [];

for (let hora = 8; hora < 21; hora++) {
    HORARIOS.push({
        inicio: `${String(hora).padStart(2, '0')}:00:00`,
        fin: `${String(hora + 1).padStart(2, '0')}:00:00`
    });
}

// Inicializar la aplicación
async function iniciarAplicacion() {
    configurarMenu();

    const filtro = document.getElementById('filterForm');
    const fecha = document.getElementById('fecha');
    const espacio = document.getElementById('espacio');
    const formulario = document.getElementById('reservationForm');
    const limpiar = document.getElementById('btnLimpiarSeleccion');

    if (!filtro || !fecha || !espacio || !formulario) {
        return;
    }

    fecha.value = obtenerFechaLocal();

    filtro.addEventListener('submit', (event) => {
        event.preventDefault();
        cargarDisponibilidad();
    });

    fecha.addEventListener('change', () => {
        limpiarSeleccion();
        cargarDisponibilidad();
    });

    espacio.addEventListener('change', () => {
        limpiarSeleccion();
        cargarDisponibilidad();
    });

    limpiar?.addEventListener('click', limpiarSeleccion);

    formulario.addEventListener('submit', registrarReservacion);

    await cargarDisponibilidad();
}

// Fecha local sin problemas de zona horaria
function obtenerFechaLocal() {
    const fecha = new Date();
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');

    return `${anio}-${mes}-${dia}`;
}

// Menú móvil
function configurarMenu() {
    const boton = document.getElementById('menuToggle');
    const menu = document.getElementById('navLinks');

    boton?.addEventListener('click', () => {
        menu?.classList.toggle('active');
    });
}

// Consultar disponibilidad
async function cargarDisponibilidad() {
    const fecha = document.getElementById('fecha').value;
    const espacio = document.getElementById('espacio').value;
    const contenedor = document.getElementById('availabilityContainer');

    if (!fecha || !contenedor) return;

    contenedor.innerHTML = '<p>Consultando disponibilidad...</p>';

    try {
        const datos = await API.obtenerDisponibilidad(fecha, espacio);

        const salas = Array.isArray(datos)
            ? datos
            : datos.salas || [];

        const reservaciones = datos.reservaciones || [];

        if (!salas.length) {
            contenedor.textContent = 'No hay salas registradas.';
            return;
        }

        estadoSeleccion.fecha = fecha;

        mostrarSalas(salas, reservaciones);

    } catch (error) {
        contenedor.textContent =
            `No se pudo consultar la disponibilidad: ${error.message}`;
    }
}

// Mostrar salas y horarios
function mostrarSalas(salas, reservaciones) {
    const contenedor = document.getElementById('availabilityContainer');
    const filtro = document.getElementById('espacio').value;

    contenedor.innerHTML = '';

    const salasFiltradas = filtro === 'todos'
        ? salas
        : salas.filter(sala => String(sala.id_sala) === filtro);

    if (!salasFiltradas.length) {
        contenedor.textContent = 'No se encontraron salas.';
        return;
    }

    salasFiltradas.forEach(sala => {
        const tarjeta = document.createElement('article');
        tarjeta.className = 'availability-card';

        const encabezado = document.createElement('div');
        encabezado.className = 'card-header';

        const titulo = document.createElement('h3');
        titulo.textContent = sala.nombre;

        const ubicacion = document.createElement('p');
        ubicacion.textContent = sala.edificio || '';

        encabezado.append(titulo, ubicacion);

        const cuadrilla = document.createElement('div');
        cuadrilla.className = 'slots-grid';

        HORARIOS.forEach((horario, indice) => {
            const ocupado = reservaciones.some(reserva => {
                return (
                    Number(reserva.id_sala) === Number(sala.id_sala) &&
                    reserva.estado !== 'cancelada' &&
                    horario.inicio < reserva.hora_fin &&
                    horario.fin > reserva.hora_inicio
                );
            });

            const boton = document.createElement('button');
            boton.type = 'button';
            const seleccionado =
                estadoSeleccion.sala &&
                Number(estadoSeleccion.sala.id_sala) === Number(sala.id_sala) &&
                estadoSeleccion.bloques.includes(indice);

            boton.className = ocupado
                ? 'slot occupied'
                : seleccionado
                    ? 'slot selected'
                    : 'slot available';

            boton.textContent =
                `${horario.inicio.slice(0, 5)} - ${horario.fin.slice(0, 5)}`;

            boton.disabled = ocupado;

            if (!ocupado) {
                boton.addEventListener('click', () => {
                    seleccionarBloque(sala, indice, boton);
                });
            }

            cuadrilla.appendChild(boton);
        });

        tarjeta.append(encabezado, cuadrilla);
        contenedor.appendChild(tarjeta);
    });
}

// Seleccionar bloques consecutivos
function seleccionarBloque(sala, indice) {
    if (
        estadoSeleccion.sala !== null &&
        Number(estadoSeleccion.sala.id_sala) !== Number(sala.id_sala)
    ) {
        limpiarSeleccion();
    }

    estadoSeleccion.sala = sala;

    const bloques = estadoSeleccion.bloques;

    if (bloques.includes(indice)) {
        // Solo permite quitar el primero o el último bloque
        if (
            indice !== Math.min(...bloques) &&
            indice !== Math.max(...bloques)
        ) {
            mostrarMensaje('Solo puedes quitar bloques de los extremos.', 'error');
            return;
        }

        estadoSeleccion.bloques =
            bloques.filter(i => i !== indice);

    } else {
        if (
            bloques.length === 0 ||
            indice === Math.min(...bloques) - 1 ||
            indice === Math.max(...bloques) + 1
        ) {
            estadoSeleccion.bloques.push(indice);
        } else {
            mostrarMensaje('Selecciona horarios consecutivos.', 'error');
            return;
        }
    }

    estadoSeleccion.bloques.sort((a, b) => a - b);

    actualizarFormulario();
    cargarDisponibilidadVisual();
}
// Actualizar los campos del formulario
function actualizarFormulario() {
    const bloques = estadoSeleccion.bloques;

    document.getElementById('formSala').value =
        estadoSeleccion.sala?.id_sala || '';

    document.getElementById('formFecha').value =
        estadoSeleccion.fecha;

    if (!bloques.length) {
        document.getElementById('formHorarioTexto').value = '';
        document.getElementById('formHoraInicio').value = '';
        document.getElementById('formHoraFin').value = '';
        return;
    }

    const inicio = HORARIOS[bloques[0]].inicio;
    const fin = HORARIOS[bloques[bloques.length - 1]].fin;

    document.getElementById('formHoraInicio').value = inicio;
    document.getElementById('formHoraFin').value = fin;

    document.getElementById('formHorarioTexto').value =
        `${inicio.slice(0, 5)} - ${fin.slice(0, 5)} (${bloques.length} bloques)`;
}

// Volver a consultar para actualizar los colores
function cargarDisponibilidadVisual() {
    cargarDisponibilidad();
}

// Limpiar selección
function limpiarSeleccion() {
    estadoSeleccion.sala = null;
    estadoSeleccion.bloques = [];

    const formulario = document.getElementById('reservationForm');
    formulario?.reset();

    document.getElementById('formFecha').value =
        document.getElementById('fecha').value;

    const mensaje = document.getElementById('formSystemMessage');

    if (mensaje) {
        mensaje.style.display = 'none';
        mensaje.textContent = '';
    }
}

// Registrar reservación
async function registrarReservacion(event) {
    event.preventDefault();

    const boton = document.getElementById('btnEnviarReserva');

    if (!estadoSeleccion.sala || !estadoSeleccion.bloques.length) {
        mostrarMensaje('Primero selecciona un horario disponible.', 'error');
        return;
    }

    const datos = {
        id_sala: Number(estadoSeleccion.sala.id_sala),
        fecha: document.getElementById('formFecha').value,
        hora_inicio: document.getElementById('formHoraInicio').value,
        hora_fin: document.getElementById('formHoraFin').value,
        area_solicitante: document.getElementById('formArea').value.trim(),
        responsable: document.getElementById('formResponsable').value.trim(),
        correo: document.getElementById('formCorreo').value.trim()
    };

    if (!datos.area_solicitante ||
        !datos.responsable ||
        !datos.correo) {
        mostrarMensaje('Completa todos los campos.', 'error');
        return;
    }

    boton.disabled = true;
    boton.textContent = 'Registrando...';

    try {
        const respuesta = await API.crearReservacion(datos);

        mostrarMensaje(
            respuesta.mensaje || 'Reservación registrada correctamente.',
            'success'
        );

        document.getElementById('reservationForm').reset();

        estadoSeleccion.sala = null;
        estadoSeleccion.bloques = [];

        await cargarDisponibilidad();

    } catch (error) {
        mostrarMensaje(error.message, 'error');

    } finally {
        boton.disabled = false;
        boton.textContent = 'Confirmar Reservación →';
    }
}

// Mostrar mensajes
function mostrarMensaje(mensaje, tipo) {
    const contenedor = document.getElementById('formSystemMessage');

    if (!contenedor) return;

    contenedor.textContent = mensaje;
    contenedor.className = `system-alert ${tipo}`;
    contenedor.style.display = 'block';
}
