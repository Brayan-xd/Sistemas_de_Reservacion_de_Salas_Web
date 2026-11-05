
document.addEventListener('DOMContentLoaded', () => {
    iniciarAdministracion();
});

let salasRegistradas = [];

// Inicializar administración
function iniciarAdministracion() {
    configurarMenuAdmin();

    const formulario = document.getElementById('salaForm');
    const botonNueva = document.getElementById('btnNuevaSala');
    const botonCancelar = document.getElementById('btnCancelarEdicion');
    const buscador = document.getElementById('buscarSala');
    const tabla = document.getElementById('tablaSalasBody');

    formulario?.addEventListener('submit', guardarSala);
    botonNueva?.addEventListener('click', prepararNuevaSala);
    botonCancelar?.addEventListener('click', prepararNuevaSala);

    buscador?.addEventListener('input', filtrarSalas);

    tabla?.addEventListener('click', manejarAccionesTabla);

    cargarSalas();
}

// Menú móvil
function configurarMenuAdmin() {
    const boton = document.getElementById('menuToggle');
    const menu = document.getElementById('navLinks');

    boton?.addEventListener('click', () => {
        menu?.classList.toggle('active');
    });
}

// Consultar salas al backend
async function cargarSalas() {
    const cuerpo = document.getElementById('tablaSalasBody');

    cuerpo.innerHTML = `
        <tr>
            <td colspan="7">Cargando salas...</td>
        </tr>
    `;

    try {
        const respuesta = await API.obtenerSalas();

        salasRegistradas = Array.isArray(respuesta)
            ? respuesta
            : respuesta.salas || [];

        mostrarSalas(salasRegistradas);

    } catch (error) {
        cuerpo.innerHTML = `
            <tr>
                <td colspan="7">
                    Error al cargar las salas: ${escaparHTML(error.message)}
                </td>
            </tr>
        `;
    }
}

// Mostrar salas en la tabla
function mostrarSalas(salas) {
    const cuerpo = document.getElementById('tablaSalasBody');
    const contador = document.getElementById('contadorSalas');

    cuerpo.innerHTML = '';

    contador.textContent = `${salas.length} salas`;

    if (salas.length === 0) {
        const fila = document.createElement('tr');
        const celda = document.createElement('td');

        celda.colSpan = 7;
        celda.textContent = 'No se encontraron salas registradas.';

        fila.appendChild(celda);
        cuerpo.appendChild(fila);
        return;
    }

    salas.forEach(sala => {
        const fila = document.createElement('tr');

        const valores = [
            sala.id_sala,
            sala.nombre,
            sala.edificio,
            `${sala.capacidad} personas`,
            sala.encargado
        ];

        valores.forEach(valor => {
            const celda = document.createElement('td');
            celda.textContent = valor ?? '';
            fila.appendChild(celda);
        });

        // Estado de la sala
        const celdaEstado = document.createElement('td');
        const estado = document.createElement('span');

        const activa = Number(sala.activa) === 1;

        estado.className = activa
            ? 'badge badge-available'
            : 'badge badge-occupied';

        estado.textContent = activa ? 'Activa' : 'Inactiva';

        celdaEstado.appendChild(estado);
        fila.appendChild(celdaEstado);

        // Acciones
        const celdaAcciones = document.createElement('td');

        const botonEditar = document.createElement('button');
        botonEditar.type = 'button';
        botonEditar.textContent = 'Editar';
        botonEditar.className = 'btn-secondary';
        botonEditar.dataset.accion = 'editar';
        botonEditar.dataset.id = sala.id_sala;

        celdaAcciones.appendChild(botonEditar);
        fila.appendChild(celdaAcciones);

        cuerpo.appendChild(fila);
    });
}

// Buscar salas
function filtrarSalas() {
    const texto = document.getElementById('buscarSala')
        .value.toLowerCase()
        .trim();

    const resultados = salasRegistradas.filter(sala => {
        return (
            String(sala.nombre || '').toLowerCase().includes(texto) ||
            String(sala.edificio || '').toLowerCase().includes(texto) ||
            String(sala.encargado || '').toLowerCase().includes(texto)
        );
    });

    mostrarSalas(resultados);
}

// Detectar clic en los botones de la tabla
function manejarAccionesTabla(event) {
    const boton = event.target.closest('button[data-accion="editar"]');

    if (!boton) return;

    const id = Number(boton.dataset.id);

    const sala = salasRegistradas.find(
        elemento => Number(elemento.id_sala) === id
    );

    if (sala) {
        cargarSalaEnFormulario(sala);
    }
}

// Preparar formulario para editar
function cargarSalaEnFormulario(sala) {
    document.getElementById('id_sala').value = sala.id_sala;
    document.getElementById('nombre').value = sala.nombre || '';
    document.getElementById('edificio').value = sala.edificio || '';
    document.getElementById('capacidad').value = sala.capacidad || '';
    document.getElementById('encargado').value = sala.encargado || '';
    document.getElementById('activa').value = String(sala.activa);

    document.getElementById('formTag').textContent = 'EDICIÓN DE ESPACIO';
    document.getElementById('formTitle').textContent = 'Modificar sala';

    document.getElementById('btnGuardarSala').textContent =
        'Guardar Cambios';

    document.getElementById('btnCancelarEdicion').style.display =
        'inline-block';

    limpiarAlerta();

    document.getElementById('salaForm').scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });
}

// Preparar formulario para registrar una sala nueva
function prepararNuevaSala() {
    document.getElementById('salaForm').reset();
    document.getElementById('id_sala').value = '';

    document.getElementById('formTag').textContent =
        'REGISTRO DE ESPACIO';

    document.getElementById('formTitle').textContent =
        'Registrar nueva sala';

    document.getElementById('btnGuardarSala').textContent =
        'Guardar Sala';

    document.getElementById('btnCancelarEdicion').style.display =
        'none';

    document.getElementById('activa').value = '1';

    limpiarAlerta();
}

// Registrar o modificar una sala
async function guardarSala(event) {
    event.preventDefault();

    const id = document.getElementById('id_sala').value;

    const datos = {
        nombre: document.getElementById('nombre').value.trim(),
        edificio: document.getElementById('edificio').value.trim(),
        capacidad: Number(document.getElementById('capacidad').value),
        encargado: document.getElementById('encargado').value.trim(),
        activa: Number(document.getElementById('activa').value)
    };

    if (
        !datos.nombre ||
        !datos.edificio ||
        !datos.encargado ||
        !Number.isInteger(datos.capacidad) ||
        datos.capacidad < 1 ||
        ![0, 1].includes(datos.activa)
    ) {
        mostrarAlerta('Verifica los datos del formulario.', 'error');
        return;
    }

    const boton = document.getElementById('btnGuardarSala');

    boton.disabled = true;
    boton.textContent = 'Guardando...';

    try {
        let respuesta;

        if (id) {
            respuesta = await API.modificarSala(id, datos);
        } else {
            respuesta = await API.registrarSala(datos);
        }

        mostrarAlerta(
            respuesta.mensaje || 'La operación se realizó correctamente.',
            'success'
        );

        prepararNuevaSala();
        await cargarSalas();

    } catch (error) {
        mostrarAlerta(error.message, 'error');

    } finally {
        boton.disabled = false;

        boton.textContent = document.getElementById('id_sala').value
            ? 'Guardar Cambios'
            : 'Guardar Sala';
    }
}

// Mostrar mensajes del formulario
function mostrarAlerta(mensaje, tipo) {
    const alerta = document.getElementById('formAlert');

    alerta.textContent = mensaje;
    alerta.className = `admin-alert ${tipo}`;
    alerta.style.display = 'block';
}

// Limpiar mensajes
function limpiarAlerta() {
    const alerta = document.getElementById('formAlert');

    alerta.textContent = '';
    alerta.style.display = 'none';
}

// Escapar texto en mensajes de error
function escaparHTML(texto) {
    return String(texto).replace(/[&<>"']/g, caracter => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[caracter]);
}
