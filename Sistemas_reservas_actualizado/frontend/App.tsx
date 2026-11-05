import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { apiFetch } from './api.ts';
import {
  Calendar,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
  Lock,
  ArrowRight,
  RefreshCw,
  BookOpen,
  MonitorPlay,
  Bell,
  X,
  Trash2,
  Building2,
  Clock
} from 'lucide-react';

// Activos visuales institucionales enviados por el usuario
const CAMPUS_INICIO_IMAGE = '/assets/institucion/portada-inicio.jpg';
const CAMPUS_DISPONIBILIDAD_IMAGE = '/assets/institucion/portada-disponibilidad.jpeg';
const CAMPUS_CANCELAR_IMAGE = '/assets/institucion/portada-cancelar.jpeg';
const CAMPUS_NOTIFICACIONES_IMAGE = '/assets/institucion/portada-notificaciones.jpeg';
const LOGO_INSTITUCIONAL = '/assets/institucion/logo.png';

// =========================================================
// TIPOS DE DATOS
// =========================================================

interface Sala {
  id_sala: number;
  nombre: string;
  edificio: string;
  capacidad: number;
  encargado: string;
  activa: number;
}

interface Reservacion {
  id_reservacion: number;
  codigo: string;
  id_sala: number;
  nombre_sala?: string;
  edificio?: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  area_solicitante: string;
  responsable: string;
  correo: string;
  estado: string;
  cancelado_por?: string | null;
  motivo_cancelacion?: string | null;
  fecha_cancelacion?: string | null;
}

interface NotificacionCorreo {
  id_correo: number;
  destinatario: string;
  remitente: string;
  asunto: string;
  tipo: string;
  codigo_reserva?: string;
  cuerpo_html: string;
  leido: number;
  enviado_en: string;
}

type VistaActiva = 'inicio' | 'disponibilidad' | 'cancelar-cliente' | 'login' | 'admin';

// 13 bloques horarios consecutivos de 08:00 a 21:00 (lógica original intacta)
const HORARIOS = Array.from({ length: 13 }, (_, i) => {
  const hora = i + 8;
  return {
    inicio: `${String(hora).padStart(2, '0')}:00:00`,
    fin: `${String(hora + 1).padStart(2, '0')}:00:00`
  };
});

function obtenerFechaLocal(): string {
  const fecha = new Date();
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

export default function App() {
  // Sesión de Administrador (Token almacenado en memoria)
  const [adminSesionActiva, setAdminSesionActiva] = useState<boolean>(false);
  const [adminUsuario, setAdminUsuario] = useState<string>('');
  const [adminToken, setAdminToken] = useState<string>('');

  // Si el Administrador tiene sesión iniciada, entra directo a la pestaña de Administrador y desaparecen las vistas de cliente
  const [vista, setVista] = useState<VistaActiva>('inicio');

  // Datos principales desde el Backend (con las 4 salas iniciales listas desde el arranque)
  const [salas, setSalas] = useState<Sala[]>([
    { id_sala: 1, nombre: 'Sala Audiovisual 1', edificio: 'Edificio D1', capacidad: 60, encargado: 'Subdirección Académica', activa: 1 },
    { id_sala: 2, nombre: 'Sala Audiovisual 2', edificio: 'Edificio D1', capacidad: 60, encargado: 'Subdirección Académica', activa: 1 },
    { id_sala: 3, nombre: 'Sala Audiovisual 3', edificio: 'Edificio D2', capacidad: 45, encargado: 'Coordinación de Posgrado', activa: 1 },
    { id_sala: 4, nombre: 'Biblioteca', edificio: 'Centro de Información', capacidad: 120, encargado: 'Jefatura del Centro de Información', activa: 1 }
  ]);
  const [reservacionesDia, setReservacionesDia] = useState<Reservacion[]>([]);
  const [todasReservacionesAdmin, setTodasReservacionesAdmin] = useState<Reservacion[]>([]);
  const [correoAdminConfigurado, setCorreoAdminConfigurado] = useState<string>('eduardoenriquezramos8@gmail.com');

  // Activación de la bandeja de notificaciones para clientes (sin amarrar el encabezado a un solo correo en equipos compartidos)
  const [clienteCorreoRegistrado, setClienteCorreoRegistrado] = useState<string>(() => {
    return localStorage.getItem('cliente_correo_registrado') || '';
  });
  const [buscarNotificacionTexto, setBuscarNotificacionTexto] = useState<string>('');
  const [filtroTipoNotificacion, setFiltroTipoNotificacion] = useState<'todas' | 'confirmaciones' | 'cancelaciones'>(
    'todas'
  );

  // Notificaciones (Ocultas por defecto; sólo se activan para el Admin en sesión o cuando se realiza un trámite en la página)
  const [notificaciones, setNotificaciones] = useState<NotificacionCorreo[]>([]);
  const [notificacionSeleccionada, setNotificacionSeleccionada] = useState<NotificacionCorreo | null>(null);
  const [toastNotificacion, setToastNotificacion] = useState<{
    titulo: string;
    subtitulo: string;
  } | null>(null);

  // Estado de Disponibilidad y Selección Intuitiva por Sala
  const [fechaFiltro, setFechaFiltro] = useState<string>(obtenerFechaLocal());
  const [espacioFiltro, setEspacioFiltro] = useState<string>('1'); // Por defecto muestra la primera sala para no amontonar las 4 salas a la vez
  const [cargandoDisponibilidad, setCargandoDisponibilidad] = useState<boolean>(false);

  const [salaSeleccionada, setSalaSeleccionada] = useState<Sala | null>(null);
  const [bloquesSeleccionados, setBloquesSeleccionados] = useState<number[]>([]);

  // Formulario de Reservación (en blanco sin ejemplos precargados)
  const [formArea, setFormArea] = useState<string>('');
  const [formResponsable, setFormResponsable] = useState<string>('');
  const [formCorreo, setFormCorreo] = useState<string>('');
  const [enviandoReserva, setEnviandoReserva] = useState<boolean>(false);
  const [mensajeReserva, setMensajeReserva] = useState<{
    texto: string;
    tipo: 'success' | 'error' | 'warning';
    codigo?: string;
  } | null>(null);

  // Formulario de Cancelación del Cliente (en blanco)
  const [cancelCodigo, setCancelCodigo] = useState<string>('');
  const [cancelCorreo, setCancelCorreo] = useState<string>('');
  const [cancelMotivo, setCancelMotivo] = useState<string>('');
  const [enviandoCancelCliente, setEnviandoCancelCliente] = useState<boolean>(false);
  const [mensajeCancelCliente, setMensajeCancelCliente] = useState<{
    texto: string;
    tipo: 'success' | 'error';
  } | null>(null);

  // Formulario de Login Administrativo (en blanco)
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');
  const [enviandoLogin, setEnviandoLogin] = useState<boolean>(false);

  // Estado del Módulo Administrativo (Salas, Reservaciones, Notificaciones, Correo Admin y Base de Datos MySQL)
  const [adminSubTab, setAdminSubTab] = useState<'salas' | 'reservaciones' | 'notificaciones' | 'configuracion' | 'basedatos'>('salas');
  const [dbStudioDatos, setDbStudioDatos] = useState<{
    proyecto: string;
    motor: string;
    region: string;
    base_datos: string;
    conectado: boolean;
    tablas: Record<string, any[]>;
  } | null>(null);
  const [tablaActivaDB, setTablaActivaDB] = useState<string>('reservaciones');
  const [cargandoDBStudio, setCargandoDBStudio] = useState<boolean>(false);
  const [consultaSQLInput, setConsultaSQLInput] = useState<string>('SELECT * FROM reservaciones ORDER BY id_reservacion DESC;');
  const [resultadoSQL, setResultadoSQL] = useState<{ comando: string; total_filas: number; filas: any[] } | null>(null);
  const [errorSQL, setErrorSQL] = useState<string>('');
  const [ejecutandoSQL, setEjecutandoSQL] = useState<boolean>(false);
  const [idSalaEditando, setIdSalaEditando] = useState<number | null>(null);
  const [salaNombre, setSalaNombre] = useState<string>('');
  const [salaEdificio, setSalaEdificio] = useState<string>('');
  const [salaCapacidad, setSalaCapacidad] = useState<string>('');
  const [salaEncargado, setSalaEncargado] = useState<string>('');
  const [salaActiva, setSalaActiva] = useState<string>('1');
  const [buscarSalaTexto, setBuscarSalaTexto] = useState<string>('');
  const [guardandoSala, setGuardandoSala] = useState<boolean>(false);
  const [alertaAdminSala, setAlertaAdminSala] = useState<{ texto: string; tipo: 'success' | 'error' } | null>(null);

  // Cancelación desde el Administrador -> Notifica al Cliente
  const [buscarReservaAdmin, setBuscarReservaAdmin] = useState<string>('');
  const [filtroEstadoAdmin, setFiltroEstadoAdmin] = useState<string>('todas');
  const [reservaACancelarAdmin, setReservaACancelarAdmin] = useState<Reservacion | null>(null);
  const [motivoCancelAdmin, setMotivoCancelAdmin] = useState<string>('');
  const [procesandoCancelAdmin, setProcesandoCancelAdmin] = useState<boolean>(false);
  const [alertaAdminReservas, setAlertaAdminReservas] = useState<{ texto: string; tipo: 'success' | 'error' } | null>(null);

  // Personalización del Correo y Contraseña del Administrador en la Base de Datos
  const [nuevoCorreoAdminInput, setNuevoCorreoAdminInput] = useState<string>('');
  const [nuevaPasswordAdminInput, setNuevaPasswordAdminInput] = useState<string>('');
  const [guardandoCorreoAdmin, setGuardandoCorreoAdmin] = useState<boolean>(false);
  const [alertaCorreoAdmin, setAlertaCorreoAdmin] = useState<{ texto: string; tipo: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (adminSesionActiva && vista !== 'admin') {
      setVista('admin');
    }
  }, [adminSesionActiva, vista]);

  // =========================================================
  // FUNCIONES DE CARGA Y SINCRONIZACIÓN CON EL BACKEND
  // =========================================================

  async function cargarDatosIniciales() {
    try {
      const [resConfig, resSalas] = await Promise.all([
        apiFetch('/api/configuracion').then(r => r.json()),
        apiFetch('/api/salas').then(r => r.json())
      ]);

      if (resConfig.correo_admin) {
        setCorreoAdminConfigurado(resConfig.correo_admin);
        setNuevoCorreoAdminInput(resConfig.correo_admin);
      }
      if (Array.isArray(resSalas.salas) && resSalas.salas.length > 0) {
        setSalas(resSalas.salas);
        const activas = resSalas.salas.filter((s: Sala) => Number(s.activa) === 1);
        if (activas.length > 0 && espacioFiltro === '1') {
          setEspacioFiltro(String(activas[0].id_sala));
        }
      }
    } catch (err) {
      console.error('Error al cargar datos iniciales:', err);
    }
  }

  async function cargarDisponibilidad(fechaConsulta = fechaFiltro) {
    if (!fechaConsulta) return;
    setCargandoDisponibilidad(true);
    try {
      const params = new URLSearchParams({ fecha: fechaConsulta, espacio: 'todos' });
      const res = await apiFetch(`/api/disponibilidad?${params.toString()}`);
      const datos = await res.json();

      if (Array.isArray(datos?.salas) && datos.salas.length > 0) {
        setSalas(datos.salas);
      }
      if (Array.isArray(datos?.reservaciones)) {
        setReservacionesDia(datos.reservaciones);
      }
    } catch {
      // Mantiene las 4 salas institucionales activas sin bloquear la interfaz
    } finally {
      setCargandoDisponibilidad(false);
    }
  }

  async function cargarReservacionesAdmin(tokenActual = adminToken) {
    if (!tokenActual) return;
    try {
      const res = await apiFetch('/api/reservaciones', {
        headers: { Authorization: `Bearer ${tokenActual}` }
      });
      const datos = await res.json();
      if (Array.isArray(datos.reservaciones)) {
        setTodasReservacionesAdmin(datos.reservaciones);
      }
    } catch (err) {
      console.error('Error al cargar reservaciones para admin:', err);
    }
  }

  async function cargarDBStudio(tokenActual = adminToken) {
    if (!tokenActual) return;
    setCargandoDBStudio(true);
    try {
      const res = await apiFetch('/api/db-studio/tablas', {
        headers: { Authorization: `Bearer ${tokenActual}` }
      });
      const datos = await res.json();
      if (res.ok && datos.tablas) {
        setDbStudioDatos(datos);
      }
    } catch (err) {
      console.error('Error al cargar visor de base de datos:', err);
    } finally {
      setCargandoDBStudio(false);
    }
  }

  async function ejecutarSQLDirecto(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!adminToken || !consultaSQLInput.trim()) return;
    setEjecutandoSQL(true);
    setErrorSQL('');
    try {
      const res = await apiFetch('/api/db-studio/sql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ sql: consultaSQLInput })
      });
      const datos = await res.json();
      if (!res.ok) {
        setErrorSQL(datos.mensaje || 'Error al ejecutar la sentencia SQL.');
      } else {
        setResultadoSQL(datos);
        await cargarDBStudio(adminToken);
        await cargarDatosIniciales();
        await cargarReservacionesAdmin(adminToken);
      }
    } catch (err: any) {
      setErrorSQL(err.message || 'Error de conexión al ejecutar SQL.');
    } finally {
      setEjecutandoSQL(false);
    }
  }

  async function cargarNotificacionesActivas(
    tokenActual = adminToken,
    _correoClienteActual = '',
    mostrarAvisoNuevo = false
  ) {
    try {
      if (!tokenActual) {
        setNotificaciones([]);
        setNotificacionSeleccionada(null);
        return;
      }

      const res = await apiFetch('/api/notificaciones', {
        headers: { Authorization: `Bearer ${tokenActual}` }
      });
      const datos = await res.json();

      if (Array.isArray(datos.notificaciones)) {
        setNotificaciones(datos.notificaciones);
        if (datos.notificaciones.length > 0) {
          setNotificacionSeleccionada(prev => {
            const sigueExistiendo = datos.notificaciones.find(
              (n: NotificacionCorreo) => n.id_correo === prev?.id_correo
            );
            return sigueExistiendo || datos.notificaciones[0];
          });
          if (mostrarAvisoNuevo && adminSesionActiva) {
            const reciente = datos.notificaciones[0];
            setToastNotificacion({
              titulo: reciente.asunto,
              subtitulo: reciente.codigo_reserva
                ? `Código: ${reciente.codigo_reserva} · ${reciente.destinatario}`
                : `Para: ${reciente.destinatario}`
            });
            setTimeout(() => setToastNotificacion(null), 6000);
          }
        } else {
          setNotificacionSeleccionada(null);
        }
      }
    } catch (err) {
      console.error('Error al cargar notificaciones:', err);
    }
  }

  // Borrar una notificación individual
  async function eliminarNotificacion(idCorreo: number) {
    try {
      const res = await apiFetch(`/api/notificaciones/${idCorreo}`, {
        method: 'DELETE',
        headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : {}
      });

      if (res.ok) {
        const restantes = notificaciones.filter(n => n.id_correo !== idCorreo);
        setNotificaciones(restantes);
        if (notificacionSeleccionada?.id_correo === idCorreo) {
          setNotificacionSeleccionada(restantes.length > 0 ? restantes[0] : null);
        }
      }
    } catch (err) {
      console.error('Error al eliminar notificación:', err);
    }
  }

  // Vaciar todas las notificaciones
  async function vaciarTodasLasNotificaciones() {
    try {
      const res = await apiFetch(`/api/notificaciones`, {
        method: 'DELETE',
        headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : {}
      });

      if (res.ok) {
        setNotificaciones([]);
        setNotificacionSeleccionada(null);
      }
    } catch (err) {
      console.error('Error al vaciar notificaciones:', err);
    }
  }

  useEffect(() => {
    cargarDatosIniciales();
    cargarDisponibilidad(fechaFiltro);
  }, []);

  useEffect(() => {
    if (adminSesionActiva && adminToken) {
      cargarReservacionesAdmin(adminToken);
      cargarNotificacionesActivas(adminToken, '', false);
    } else {
      setNotificaciones([]);
      setNotificacionSeleccionada(null);
    }
  }, [adminSesionActiva, adminToken]);

  // =========================================================
  // LÓGICA DE SELECCIÓN DE BLOQUES CONSECUTIVOS (INTACTA)
  // =========================================================

  function limpiarSeleccion() {
    setSalaSeleccionada(null);
    setBloquesSeleccionados([]);
    setMensajeReserva(null);
  }

  function seleccionarBloque(sala: Sala, indice: number) {
    let bloquesActuales = [...bloquesSeleccionados];

    if (salaSeleccionada !== null && Number(salaSeleccionada.id_sala) !== Number(sala.id_sala)) {
      bloquesActuales = [];
    }

    setSalaSeleccionada(sala);

    if (bloquesActuales.includes(indice)) {
      if (indice !== Math.min(...bloquesActuales) && indice !== Math.max(...bloquesActuales)) {
        setMensajeReserva({
          texto: 'Solo puedes quitar bloques de los extremos.',
          tipo: 'warning'
        });
        return;
      }
      bloquesActuales = bloquesActuales.filter(i => i !== indice);
      if (bloquesActuales.length === 0) {
        setSalaSeleccionada(null);
      }
    } else {
      if (
        bloquesActuales.length === 0 ||
        indice === Math.min(...bloquesActuales) - 1 ||
        indice === Math.max(...bloquesActuales) + 1
      ) {
        bloquesActuales.push(indice);
      } else {
        setMensajeReserva({
          texto: 'Selecciona horarios consecutivos.',
          tipo: 'warning'
        });
        return;
      }
    }

    bloquesActuales.sort((a, b) => a - b);
    setBloquesSeleccionados(bloquesActuales);
    setMensajeReserva(null);
  }

  const infoHorarioSeleccionado = useMemo(() => {
    if (!bloquesSeleccionados.length) {
      return { texto: '', inicio: '', fin: '' };
    }
    const inicio = HORARIOS[bloquesSeleccionados[0]].inicio;
    const fin = HORARIOS[bloquesSeleccionados[bloquesSeleccionados.length - 1]].fin;
    return {
      inicio,
      fin,
      texto: `${inicio.slice(0, 5)} - ${fin.slice(0, 5)} (${bloquesSeleccionados.length} ${
        bloquesSeleccionados.length === 1 ? 'hora' : 'horas'
      })`
    };
  }, [bloquesSeleccionados]);

  // =========================================================
  // REGISTRO DE RESERVACIÓN DEL USUARIO NORMAL
  // =========================================================

  async function registrarReservacion(e: React.FormEvent) {
    e.preventDefault();

    if (!salaSeleccionada || !bloquesSeleccionados.length) {
      setMensajeReserva({
        texto: 'Primero selecciona un horario disponible.',
        tipo: 'error'
      });
      return;
    }

    if (!formArea.trim() || !formResponsable.trim() || !formCorreo.trim()) {
      setMensajeReserva({
        texto: 'Completa todos los campos.',
        tipo: 'error'
      });
      return;
    }

    setEnviandoReserva(true);
    setMensajeReserva(null);

    const correoLimpio = formCorreo.trim().toLowerCase();
    const nombreLimpio = formResponsable.trim();

    try {
      const res = await apiFetch('/api/reservaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_sala: Number(salaSeleccionada.id_sala),
          fecha: fechaFiltro,
          hora_inicio: infoHorarioSeleccionado.inicio,
          hora_fin: infoHorarioSeleccionado.fin,
          area_solicitante: formArea.trim(),
          responsable: nombreLimpio,
          correo: correoLimpio
        })
      });

      const datos = await res.json();
      if (!res.ok) throw new Error(datos.mensaje || 'Error al registrar la reservación.');

      localStorage.setItem('cliente_correo_registrado', correoLimpio);
      setClienteCorreoRegistrado(correoLimpio);

      setMensajeReserva({
        texto: datos.mensaje || 'Reservación registrada correctamente.',
        tipo: 'success',
        codigo: datos.codigo
      });

      setFormArea('');
      setFormResponsable('');
      setFormCorreo('');
      setSalaSeleccionada(null);
      setBloquesSeleccionados([]);

      await cargarDisponibilidad(fechaFiltro);
      if (adminSesionActiva && adminToken) {
        await cargarNotificacionesActivas(adminToken, '', true);
      }
    } catch (err: any) {
      setMensajeReserva({
        texto: err.message,
        tipo: 'error'
      });
    } finally {
      setEnviandoReserva(false);
    }
  }

  // =========================================================
  // CANCELACIÓN POR EL CLIENTE -> NOTIFICA AL ADMINISTRADOR
  // =========================================================

  async function manejarCancelacionCliente(e: React.FormEvent) {
    e.preventDefault();

    if (!cancelCodigo.trim() || !cancelCorreo.trim()) {
      setMensajeCancelCliente({
        texto: 'Ingresa el código de reservación y tu correo institucional.',
        tipo: 'error'
      });
      return;
    }

    setEnviandoCancelCliente(true);
    setMensajeCancelCliente(null);

    const correoLimpio = cancelCorreo.trim().toLowerCase();

    try {
      const res = await apiFetch('/api/reservaciones/cancelar-cliente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo: cancelCodigo.trim().toUpperCase(),
          correo: correoLimpio,
          motivo: cancelMotivo.trim() || 'Cancelación solicitada por el cliente'
        })
      });

      const datos = await res.json();
      if (!res.ok) throw new Error(datos.mensaje || 'No se pudo cancelar la reservación.');

      localStorage.setItem('cliente_correo_registrado', correoLimpio);
      setClienteCorreoRegistrado(correoLimpio);

      setMensajeCancelCliente({
        texto: datos.mensaje,
        tipo: 'success'
      });
      setCancelCodigo('');
      setCancelMotivo('');

      await cargarDisponibilidad(fechaFiltro);
      if (adminSesionActiva && adminToken) {
        await cargarNotificacionesActivas(adminToken, '', true);
      }
    } catch (err: any) {
      setMensajeCancelCliente({
        texto: err.message,
        tipo: 'error'
      });
    } finally {
      setEnviandoCancelCliente(false);
    }
  }

  // =========================================================
  // LOGIN Y ACCIONES DEL ADMINISTRADOR
  // =========================================================

  async function manejarLoginAdmin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError('');
    setEnviandoLogin(true);

    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginEmail.trim(),
          password: loginPassword.trim()
        })
      });

      const datos = await res.json();
      if (!res.ok) throw new Error(datos.mensaje || 'Credenciales incorrectas.');

      setAdminSesionActiva(true);
      setAdminUsuario(datos.usuario);
      setAdminToken(datos.token);
      setLoginEmail('');
      setLoginPassword('');
      setVista('admin');

      await Promise.all([
        cargarReservacionesAdmin(datos.token),
        cargarNotificacionesActivas(datos.token, '', true)
      ]);
    } catch (err: any) {
      setLoginError(err.message);
    } finally {
      setEnviandoLogin(false);
    }
  }

  async function cerrarSesionAdmin() {
    setAdminSesionActiva(false);
    setAdminUsuario('');
    setAdminToken('');
    setTodasReservacionesAdmin([]);
    setVista('inicio');
  }

  function prepararNuevaSala() {
    setIdSalaEditando(null);
    setSalaNombre('');
    setSalaEdificio('');
    setSalaCapacidad('');
    setSalaEncargado('');
    setSalaActiva('1');
    setAlertaAdminSala(null);
  }

  function cargarSalaEnFormulario(sala: Sala) {
    setIdSalaEditando(sala.id_sala);
    setSalaNombre(sala.nombre);
    setSalaEdificio(sala.edificio);
    setSalaCapacidad(String(sala.capacidad));
    setSalaEncargado(sala.encargado);
    setSalaActiva(String(sala.activa));
    setAlertaAdminSala(null);
  }

  async function guardarSalaAdmin(e: React.FormEvent) {
    e.preventDefault();
    setGuardandoSala(true);
    setAlertaAdminSala(null);

    const payload = {
      nombre: salaNombre.trim(),
      edificio: salaEdificio.trim(),
      capacidad: Number(salaCapacidad),
      encargado: salaEncargado.trim(),
      activa: Number(salaActiva)
    };

    try {
      const url = idSalaEditando ? `/api/salas/${idSalaEditando}` : '/api/salas';
      const method = idSalaEditando ? 'PUT' : 'POST';

      const res = await apiFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify(payload)
      });

      const datos = await res.json();
      if (!res.ok) throw new Error(datos.mensaje || 'Error al guardar la sala.');

      setAlertaAdminSala({
        texto: datos.mensaje || 'La operación se realizó correctamente.',
        tipo: 'success'
      });

      prepararNuevaSala();
      const resSalas = await apiFetch('/api/salas').then(r => r.json());
      if (Array.isArray(resSalas.salas)) setSalas(resSalas.salas);
      await cargarDisponibilidad(fechaFiltro);
    } catch (err: any) {
      setAlertaAdminSala({
        texto: err.message,
        tipo: 'error'
      });
    } finally {
      setGuardandoSala(false);
    }
  }

  async function confirmarCancelacionAdmin(e: React.FormEvent) {
    e.preventDefault();
    if (!reservaACancelarAdmin) return;

    setProcesandoCancelAdmin(true);
    setAlertaAdminReservas(null);

    try {
      const res = await apiFetch(`/api/reservaciones/${reservaACancelarAdmin.id_reservacion}/cancelar-admin?token=${encodeURIComponent(adminToken)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
          'X-Admin-Token': adminToken
        },
        body: JSON.stringify({
          motivo: motivoCancelAdmin.trim() || 'Cancelación administrativa de espacio institucional',
          token: adminToken,
          admin_token: adminToken
        })
      });

      const datos = await res.json();
      if (!res.ok) throw new Error(datos.mensaje || 'Error al cancelar la reservación.');

      setAlertaAdminReservas({
        texto: datos.mensaje,
        tipo: 'success'
      });
      setReservaACancelarAdmin(null);
      setMotivoCancelAdmin('');

      await Promise.all([
        cargarDisponibilidad(fechaFiltro),
        cargarReservacionesAdmin(adminToken),
        cargarNotificacionesActivas(adminToken, clienteCorreoRegistrado, true)
      ]);
    } catch (err: any) {
      setAlertaAdminReservas({
        texto: err.message,
        tipo: 'error'
      });
    } finally {
      setProcesandoCancelAdmin(false);
    }
  }

  async function eliminarReservacionAdmin(idReservacion: number, codigo: string) {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar permanentemente la reservación ${codigo}? Esta acción borrará el registro de la base de datos MySQL.`)) {
      return;
    }

    setAlertaAdminReservas(null);

    try {
      const res = await apiFetch(`/api/reservaciones/${idReservacion}?token=${encodeURIComponent(adminToken)}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
          'X-Admin-Token': adminToken
        },
        body: JSON.stringify({
          token: adminToken,
          admin_token: adminToken
        })
      });

      const datos = await res.json();
      if (!res.ok) throw new Error(datos.mensaje || 'Error al eliminar la reservación.');

      setAlertaAdminReservas({
        texto: datos.mensaje || `Reservación ${codigo} eliminada correctamente de la base de datos.`,
        tipo: 'success'
      });

      await Promise.all([
        cargarDisponibilidad(fechaFiltro),
        cargarReservacionesAdmin(adminToken),
        cargarNotificacionesActivas(adminToken, '', true)
      ]);
    } catch (err: any) {
      setAlertaAdminReservas({
        texto: err.message,
        tipo: 'error'
      });
    }
  }

  async function guardarConfiguracionAdminBD(e: React.FormEvent) {
    e.preventDefault();
    setGuardandoCorreoAdmin(true);
    setAlertaCorreoAdmin(null);

    try {
      const res = await apiFetch('/api/configuracion/correo-admin', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          correo_admin: nuevoCorreoAdminInput.trim(),
          nueva_password: nuevaPasswordAdminInput.trim() || undefined
        })
      });

      const datos = await res.json();
      if (!res.ok) throw new Error(datos.mensaje || 'Error al actualizar la configuración.');

      setCorreoAdminConfigurado(datos.correo_admin);
      setAdminUsuario(datos.correo_admin);
      sessionStorage.setItem('admin_usuario', datos.correo_admin);
      if (datos.token) {
        setAdminToken(datos.token);
        sessionStorage.setItem('admin_token', datos.token);
      }
      setNuevaPasswordAdminInput('');

      setAlertaCorreoAdmin({
        texto: datos.mensaje,
        tipo: 'success'
      });
      await cargarNotificacionesActivas(datos.token || adminToken, '', true);
    } catch (err: any) {
      setAlertaCorreoAdmin({
        texto: err.message,
        tipo: 'error'
      });
    } finally {
      setGuardandoCorreoAdmin(false);
    }
  }

  // Filtros
  const salasActivas = useMemo(() => {
    return salas.filter(s => Number(s.activa) === 1);
  }, [salas]);

  const salasMostradasEnDisponibilidad = useMemo(() => {
    if (espacioFiltro === 'todos') return salasActivas;
    const filtradas = salasActivas.filter(s => String(s.id_sala) === espacioFiltro);
    return filtradas.length > 0 ? filtradas : salasActivas.slice(0, 1);
  }, [salasActivas, espacioFiltro]);

  const salasFiltradasAdmin = useMemo(() => {
    const q = buscarSalaTexto.toLowerCase().trim();
    if (!q) return salas;
    return salas.filter(
      s =>
        s.nombre.toLowerCase().includes(q) ||
        s.edificio.toLowerCase().includes(q) ||
        s.encargado.toLowerCase().includes(q)
    );
  }, [salas, buscarSalaTexto]);

  const reservacionesFiltradasAdmin = useMemo(() => {
    return todasReservacionesAdmin.filter(r => {
      const coincideEstado =
        filtroEstadoAdmin === 'todas' || r.estado.toLowerCase() === filtroEstadoAdmin.toLowerCase();
      const q = buscarReservaAdmin.toLowerCase().trim();
      const coincideTexto =
        !q ||
        r.codigo.toLowerCase().includes(q) ||
        r.responsable.toLowerCase().includes(q) ||
        r.correo.toLowerCase().includes(q) ||
        r.area_solicitante.toLowerCase().includes(q) ||
        (r.nombre_sala || '').toLowerCase().includes(q);
      return coincideEstado && coincideTexto;
    });
  }, [todasReservacionesAdmin, filtroEstadoAdmin, buscarReservaAdmin]);

  const notificacionesFiltradas = useMemo(() => {
    return notificaciones.filter(n => {
      const coincideTipo =
        filtroTipoNotificacion === 'todas' ||
        (filtroTipoNotificacion === 'confirmaciones' && n.tipo.includes('CONFIRMACION')) ||
        (filtroTipoNotificacion === 'cancelaciones' && n.tipo.includes('CANCELACION'));
      const q = buscarNotificacionTexto.toLowerCase().trim();
      const coincideTexto =
        !q ||
        n.destinatario.toLowerCase().includes(q) ||
        n.asunto.toLowerCase().includes(q) ||
        (n.codigo_reserva || '').toLowerCase().includes(q);
      return coincideTipo && coincideTexto;
    });
  }, [notificaciones, filtroTipoNotificacion, buscarNotificacionTexto]);

  const imagenAmbientalActiva = useMemo(() => {
    if (vista === 'disponibilidad') return CAMPUS_DISPONIBILIDAD_IMAGE;
    if (vista === 'cancelar-cliente') return CAMPUS_CANCELAR_IMAGE;
    return CAMPUS_INICIO_IMAGE;
  }, [vista]);

  return (
    <div className="min-h-screen relative flex flex-col magicos-dark-dot-pattern text-white font-honor-medium">
      {/* FONDO AMBIENTAL CON TRAMA OSCURA Y PUNTOS OSCUROS NOTORIOS */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none magicos-dark-dot-pattern">
        <img
          src={imagenAmbientalActiva}
          alt="Campus Institucional"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover scale-110 filter blur-[40px] opacity-22 saturate-140"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(4, 8, 18, 0.72) 0%, rgba(5, 10, 22, 0.80) 55%, rgba(3, 6, 14, 0.90) 100%)'
          }}
        />
        {/* Capa de trama oscura con puntos notorios sobre el fondo */}
        <div className="absolute inset-0 magicos-dot-overlay opacity-95" />
      </div>

      {/* TOAST FLOTANTE LIQUID GLASS CUANDO LLEGA UNA NOTIFICACIÓN (SOLO PARA ADMIN) */}
      <AnimatePresence>
        {toastNotificacion && adminSesionActiva && (
          <motion.div
            initial={{ opacity: 0, y: -28, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -22, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 340, damping: 26 }}
            className="fixed top-24 right-6 z-50 max-w-sm magicos-liquid-glass rounded-2xl p-4 flex items-start gap-3 cursor-pointer"
            onClick={() => {
              setVista('admin');
              setAdminSubTab('notificaciones');
              setToastNotificacion(null);
            }}
          >
            <div className="w-9 h-9 rounded-xl magicos-btn-primary text-white flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-honor-bold text-[#38BDF8] tracking-wider block">
                NUEVA NOTIFICACIÓN
              </span>
              <p className="text-xs font-honor-bold text-white truncate mt-0.5">{toastNotificacion.titulo}</p>
              <p className="text-[11px] text-[#BAE6FD] truncate">{toastNotificacion.subtitulo}</p>
            </div>
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                setToastNotificacion(null);
              }}
              className="text-[#7DD3FC] hover:text-white p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ENCABEZADO SUPERIOR ESTILO IMAGEN DE REFERENCIA: LOGO.PNG + DOCK LIQUID GLASS CENTRAL + BOTÓN DERECHO */}
      <header className="sticky top-0 z-40 magicos-liquid-header">
        <div className="max-w-[1260px] mx-auto px-6 h-[82px] flex items-center justify-between gap-8">
          {/* Zona 1: Logo.png enviado por el usuario */}
          <button
            type="button"
            onClick={() => setVista(adminSesionActiva ? 'admin' : 'inicio')}
            className="flex items-center gap-3 group cursor-pointer shrink-0"
            title="Inicio"
          >
            <img
              src={LOGO_INSTITUCIONAL}
              alt="Logo Institucional"
              referrerPolicy="no-referrer"
              className="h-12 w-12 object-contain drop-shadow-[0_0_12px_rgba(56,189,248,0.35)] group-hover:scale-105 magicos-transition"
            />
          </button>

          {/* Zona 2: Barra de Navegación Flotante Liquid Glass (Exactamente como la imagen de referencia) */}
          <nav className="hidden md:flex items-center gap-7 px-8 py-2.5 rounded-full liquid-nav-pill text-xs font-honor-medium text-white/85">
            {adminSesionActiva ? (
              <button
                type="button"
                onClick={() => {
                  setVista('admin');
                  cargarReservacionesAdmin(adminToken);
                }}
                className="text-[#38BDF8] font-honor-bold whitespace-nowrap shrink-0 cursor-pointer"
              >
                Panel de Administración
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setVista('inicio')}
                  className={`magicos-transition whitespace-nowrap shrink-0 cursor-pointer ${
                    vista === 'inicio'
                      ? 'text-[#38BDF8] font-honor-bold'
                      : 'text-white/80 hover:text-white'
                  }`}
                >
                  Inicio
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVista('disponibilidad');
                    cargarDisponibilidad(fechaFiltro);
                  }}
                  className={`magicos-transition whitespace-nowrap shrink-0 cursor-pointer ${
                    vista === 'disponibilidad'
                      ? 'text-[#38BDF8] font-honor-bold'
                      : 'text-white/80 hover:text-white'
                  }`}
                >
                  Disponibilidad
                </button>
                <button
                  type="button"
                  onClick={() => setVista('cancelar-cliente')}
                  className={`magicos-transition whitespace-nowrap shrink-0 cursor-pointer ${
                    vista === 'cancelar-cliente'
                      ? 'text-[#38BDF8] font-honor-bold'
                      : 'text-white/80 hover:text-white'
                  }`}
                >
                  Cancelar Reserva
                </button>
              </>
            )}
          </nav>

          {/* Zona 3: Botón Liquid Glass Derecho */}
          <div className="flex items-center gap-3 shrink-0">
            {adminSesionActiva ? (
              <button
                type="button"
                onClick={cerrarSesionAdmin}
                className="px-5 py-2.5 rounded-full liquid-nav-pill hover:border-[#38BDF8] text-xs font-honor-bold text-white flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer magicos-transition"
              >
                <span>Cerrar sesión</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#38BDF8]" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setVista('disponibilidad');
                  cargarDisponibilidad(fechaFiltro);
                }}
                className="px-5 py-2.5 rounded-full liquid-nav-pill hover:border-[#38BDF8] text-xs font-honor-bold text-white flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer magicos-transition"
              >
                <span>Reservar sala</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#38BDF8]" />
              </button>
            )}
          </div>
        </div>

        {/* Barra móvil */}
        <div className="flex md:hidden items-center justify-around border-t border-[#38BDF8]/20 bg-[#030712]/90 px-3 py-2.5 text-xs font-honor-bold text-[#BAE6FD] overflow-x-auto gap-3">
          {adminSesionActiva ? (
            <button type="button" onClick={() => setVista('admin')} className="whitespace-nowrap shrink-0 text-[#38BDF8]">
              Panel de Administración
            </button>
          ) : (
            <>
              <button type="button" onClick={() => setVista('inicio')} className="whitespace-nowrap shrink-0">
                Inicio
              </button>
              <button type="button" onClick={() => setVista('disponibilidad')} className="whitespace-nowrap shrink-0">
                Disponibilidad
              </button>
              <button type="button" onClick={() => setVista('cancelar-cliente')} className="whitespace-nowrap shrink-0">
                Cancelar Reserva
              </button>
            </>
          )}
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 max-w-[1260px] w-full mx-auto px-6 py-8">
        <AnimatePresence mode="wait">
          {/* =====================================================
              VISTA 1: INICIO (DISEÑO INSPIRADO EN LA IMAGEN DE REFERENCIA)
          ===================================================== */}
          {!adminSesionActiva && vista === 'inicio' && (
            <motion.div
              key="vista-inicio"
              initial={{ opacity: 0, y: 18, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -14, scale: 0.99 }}
              transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-14"
            >
              {/* PORTADA PRINCIPAL CON ESTÉTICA DE LA REFERENCIA + BARRA DE BÚSQUEDA LIQUID GLASS INFERIOR */}
              <section className="relative min-h-[560px] rounded-[36px] overflow-hidden border border-[#7DD3FC]/30 shadow-2xl flex flex-col justify-between p-8 md:p-12 lg:p-14">
                {/* Imagen del edificio enviada por el usuario ambientada en tono nocturno/azul profundo */}
                <div className="absolute inset-0">
                  <img
                    src={CAMPUS_INICIO_IMAGE}
                    alt="Edificio Institucional"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover object-center scale-[1.02] filter brightness-75 contrast-115 saturate-110"
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        'linear-gradient(180deg, rgba(2, 6, 18, 0.55) 0%, rgba(3, 10, 26, 0.45) 45%, rgba(2, 4, 10, 0.92) 100%)'
                    }}
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        'radial-gradient(circle at 20% 35%, rgba(2, 8, 24, 0.65) 0%, transparent 60%)'
                    }}
                  />
                </div>

                {/* Bloque de título traslúcido estilo referencia */}
                <div className="relative z-10 max-w-2xl pt-8 md:pt-14 space-y-4">
                  <p className="text-xs font-honor-bold tracking-[0.22em] text-white/90">
                    INSTITUTO TECNOLÓGICO DE TUXTLA GUTIÉRREZ
                  </p>
                  <h1
                    className="text-4xl sm:text-6xl font-honor-bold tracking-tight leading-[1.08] liquid-hero-title"
                    style={{ textWrap: 'balance' }}
                  >
                    Reserva espacios institucionales en línea
                  </h1>
                  <p className="text-sm sm:text-base text-[#E0F2FE]/90 max-w-xl leading-relaxed font-honor-medium pt-1">
                    Consulta la disponibilidad de las tres salas audiovisuales y la biblioteca, elige tu horario y
                    confirma tu reservación al instante.
                  </p>
                </div>

                {/* Barra Inferior Flotante Liquid Glass (Idéntica al dock inferior de la imagen de referencia) */}
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    setVista('disponibilidad');
                    cargarDisponibilidad(fechaFiltro);
                  }}
                  className="relative z-10 mt-12 liquid-dock-bar rounded-full p-2.5 grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center"
                >
                  {/* Campo 1: Seleccionar fecha */}
                  <div className="md:col-span-5 liquid-dock-segment rounded-full px-5 py-3 flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-[#38BDF8] shrink-0" />
                    <div className="flex-1 flex items-center justify-between gap-2">
                      <span className="text-xs text-[#BAE6FD] whitespace-nowrap">Fecha de reserva:</span>
                      <input
                        type="date"
                        value={fechaFiltro}
                        onChange={e => setFechaFiltro(e.target.value)}
                        className="bg-transparent text-xs font-honor-bold text-white focus:outline-none tabular-nums cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Campo 2: Elegir espacio */}
                  <div className="md:col-span-4 liquid-dock-segment rounded-full px-5 py-3 flex items-center gap-3">
                    <Building2 className="w-4 h-4 text-[#38BDF8] shrink-0" />
                    <select
                      value={espacioFiltro}
                      onChange={e => setEspacioFiltro(e.target.value)}
                      className="w-full bg-transparent text-xs font-honor-bold text-white focus:outline-none cursor-pointer"
                    >
                      {salasActivas.map(s => (
                        <option key={s.id_sala} value={String(s.id_sala)} className="bg-[#040914] text-white">
                          {s.nombre} ({s.edificio})
                        </option>
                      ))}
                      <option value="todos" className="bg-[#040914] text-white">
                        Ver todos los espacios (4 salas)
                      </option>
                    </select>
                  </div>

                  {/* Botón 3: Consultar */}
                  <div className="md:col-span-3">
                    <button
                      type="submit"
                      className="w-full py-3 px-6 rounded-full magicos-btn-primary text-xs font-honor-bold flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                    >
                      <span>Consultar horarios</span>
                      <Search className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </form>
              </section>

              {/* SECCIÓN: LOS 4 ESPACIOS INSTITUCIONALES */}
              <section id="espacios" className="magicos-liquid-glass rounded-[32px] p-8 md:p-10">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                  <div>
                    <p className="text-xs font-honor-bold text-[#38BDF8]">Nuestros Espacios</p>
                    <h2 className="text-2xl md:text-3xl font-honor-bold text-white mt-1">
                      Espacios institucionales disponibles
                    </h2>
                    <p className="text-sm text-[#BAE6FD] mt-1">
                      Selecciona cualquiera de los cuatro recintos para consultar directamente sus horarios libres.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {salas.map((sala, index) => {
                    const esBiblioteca = sala.nombre.toLowerCase().includes('biblioteca');
                    return (
                      <article
                        key={sala.id_sala}
                        className="magicos-liquid-card rounded-2xl overflow-hidden flex flex-col justify-between magicos-transition magicos-hover-lift"
                      >
                        <div>
                          <div
                            className="h-32 p-5 flex flex-col justify-between relative border-b border-[#7DD3FC]/20"
                            style={{
                              background:
                                'linear-gradient(135deg, rgba(14, 165, 233, 0.24) 0%, rgba(2, 132, 199, 0.06) 100%)'
                            }}
                          >
                            <div className="flex items-center justify-between text-[#7DD3FC] text-xs font-mono tabular-nums">
                              <span>0{index + 1}</span>
                              <span>{sala.edificio}</span>
                            </div>
                            <div className="flex items-center justify-between text-white">
                              <span className="text-xs font-honor-bold tracking-wide text-[#E0F2FE]">
                                {esBiblioteca ? 'Biblioteca' : 'Audiovisual'}
                              </span>
                              {esBiblioteca ? (
                                <BookOpen className="w-5 h-5 text-[#38BDF8]" />
                              ) : (
                                <MonitorPlay className="w-5 h-5 text-[#38BDF8]" />
                              )}
                            </div>
                          </div>

                          <div className="p-5">
                            <h3 className="text-lg font-honor-bold text-white">{sala.nombre}</h3>
                            <p className="text-xs text-[#BAE6FD] mt-2 leading-relaxed">
                              {esBiblioteca
                                ? 'Espacio destinado para eventos académicos y conferencias.'
                                : `Espacio equipado para presentaciones y actividades en ${sala.edificio}.`}
                            </p>
                          </div>
                        </div>

                        <div className="px-5 pb-5">
                          <button
                            type="button"
                            onClick={() => {
                              setEspacioFiltro(String(sala.id_sala));
                              limpiarSeleccion();
                              setVista('disponibilidad');
                              cargarDisponibilidad(fechaFiltro);
                            }}
                            className="w-full py-2.5 px-4 rounded-xl magicos-btn-ghost text-xs font-honor-bold cursor-pointer"
                          >
                            Elegir este espacio →
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            </motion.div>
          )}

          {/* =====================================================
              VISTA 2: DISPONIBILIDAD Y RESERVACIÓN
              - Con la foto de portada del monumento Dr. Samuel León Brindis
              - Menú mucho más intuitivo, despejado y fácil de usar
          ===================================================== */}
          {!adminSesionActiva && vista === 'disponibilidad' && (
            <motion.div
              key="vista-disponibilidad"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-8"
            >
              {/* PORTADA DE DISPONIBILIDAD CON LA FOTO ENVIADA POR EL USUARIO */}
              <section className="relative min-h-[340px] rounded-[34px] overflow-hidden border border-[#7DD3FC]/30 shadow-2xl flex flex-col justify-between p-7 md:p-10">
                <div className="absolute inset-0">
                  <img
                    src={CAMPUS_DISPONIBILIDAD_IMAGE}
                    alt="Instituto Tecnológico de Tuxtla Gutiérrez"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover object-center filter brightness-75 contrast-110"
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        'linear-gradient(180deg, rgba(2, 6, 16, 0.55) 0%, rgba(3, 12, 28, 0.65) 55%, rgba(2, 4, 10, 0.94) 100%)'
                    }}
                  />
                </div>

                {/* Encabezado sobre la portada */}
                <div className="relative z-10 flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="max-w-xl">
                    <p className="text-xs font-honor-bold tracking-[0.2em] text-[#7DD3FC]">
                      CONSULTA Y REGISTRO DE RESERVACIONES
                    </p>
                    <h1 className="text-3xl sm:text-5xl font-honor-bold tracking-tight liquid-hero-title mt-1">
                      Disponibilidad de Espacios
                    </h1>
                    <p className="text-xs sm:text-sm text-[#E0F2FE] mt-2">
                      Paso 1: Elige la fecha y la sala · Paso 2: Toca los horarios consecutivos · Paso 3: Confirma tus
                      datos.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setVista('cancelar-cliente')}
                    className="px-4 py-2 rounded-full liquid-nav-pill hover:border-[#38BDF8] text-xs font-honor-bold text-white whitespace-nowrap shrink-0 cursor-pointer self-start"
                  >
                    ¿Deseas cancelar una reserva?
                  </button>
                </div>

                {/* BARRA DE CONTROLES INTUITIVA INTEGRADA EN LA PORTADA (FECHA + PESTAÑAS DE LAS 4 SALAS) */}
                <div className="relative z-10 mt-8 liquid-dock-bar rounded-3xl p-3 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                  {/* Selector de Fecha */}
                  <div className="liquid-dock-segment rounded-2xl px-4 py-2.5 flex items-center gap-3 shrink-0">
                    <Calendar className="w-4 h-4 text-[#38BDF8]" />
                    <label htmlFor="fechaDisp" className="text-xs text-[#BAE6FD] whitespace-nowrap">
                      Fecha:
                    </label>
                    <input
                      id="fechaDisp"
                      type="date"
                      value={fechaFiltro}
                      onChange={e => {
                        const nuevaFecha = e.target.value;
                        setFechaFiltro(nuevaFecha);
                        limpiarSeleccion();
                        cargarDisponibilidad(nuevaFecha);
                      }}
                      className="bg-transparent text-xs font-honor-bold text-white focus:outline-none tabular-nums cursor-pointer"
                    />
                  </div>

                  {/* Pestañas de selección directa de Sala (Mucho más limpio e intuitivo que amontonar todas) */}
                  <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
                    {salasActivas.map(s => {
                      const activaTab = espacioFiltro === String(s.id_sala);
                      return (
                        <button
                          key={s.id_sala}
                          type="button"
                          onClick={() => {
                            setEspacioFiltro(String(s.id_sala));
                            limpiarSeleccion();
                          }}
                          className={`px-4 py-2.5 rounded-2xl text-xs font-honor-bold whitespace-nowrap shrink-0 cursor-pointer magicos-transition ${
                            activaTab
                              ? 'magicos-btn-primary text-white'
                              : 'bg-white/5 hover:bg-white/12 text-[#BAE6FD] hover:text-white border border-transparent'
                          }`}
                        >
                          {s.nombre}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => {
                        setEspacioFiltro('todos');
                        limpiarSeleccion();
                      }}
                      className={`px-3.5 py-2.5 rounded-2xl text-xs font-honor-bold whitespace-nowrap shrink-0 cursor-pointer magicos-transition ${
                        espacioFiltro === 'todos'
                          ? 'magicos-btn-primary text-white'
                          : 'bg-white/5 hover:bg-white/12 text-[#7DD3FC] hover:text-white border border-transparent'
                      }`}
                    >
                      Ver todas
                    </button>
                  </div>
                </div>
              </section>

              {/* ÁREA DE TRABAJO LIMPIA Y DESPEJADA: HORARIOS DE LA SALA ACTIVA + FORMULARIO PASO A PASO */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Columna Izquierda: Bloques horarios amplios y cómodos */}
                <div className="lg:col-span-7 space-y-6">
                  {cargandoDisponibilidad ? (
                    <div className="magicos-liquid-glass rounded-3xl p-10 text-center text-sm text-[#BAE6FD]">
                      Consultando horarios disponibles...
                    </div>
                  ) : (
                    salasMostradasEnDisponibilidad.map(sala => (
                      <motion.article
                        key={sala.id_sala}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.22 }}
                        className="magicos-liquid-glass rounded-3xl p-6 md:p-8"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 mb-6 border-b border-[#7DD3FC]/20">
                          <div>
                            <span className="text-xs font-honor-bold text-[#38BDF8]">
                              {sala.edificio} · Capacidad para {sala.capacidad} personas
                            </span>
                            <h2 className="text-2xl font-honor-bold text-white mt-0.5">{sala.nombre}</h2>
                          </div>

                          {/* Leyenda compacta y clara */}
                          <div className="flex items-center gap-4 text-[11px] text-[#BAE6FD]">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-[#38BDF8]/30 border border-[#7DD3FC]" />
                              <span>Libre</span>
                            </span>
                            <span className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-[#38BDF8]" />
                              <span className="text-white font-honor-bold">Tu selección</span>
                            </span>
                            <span className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]/50" />
                              <span className="text-[#FCA5A5]">Ocupado</span>
                            </span>
                          </div>
                        </div>

                        <p className="text-xs text-[#BAE6FD] mb-4 flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-[#38BDF8]" />
                          <span>
                            Haz clic en uno o varios horarios libres consecutivos para armar tu bloque de reservación:
                          </span>
                        </p>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                          {HORARIOS.map((horario, indice) => {
                            const reservaOcupada = reservacionesDia.find(
                              r =>
                                Number(r.id_sala) === Number(sala.id_sala) &&
                                r.estado.toLowerCase() !== 'cancelada' &&
                                horario.inicio < r.hora_fin &&
                                horario.fin > r.hora_inicio
                            );

                            const ocupado = Boolean(reservaOcupada);
                            const seleccionado =
                              salaSeleccionada !== null &&
                              Number(salaSeleccionada.id_sala) === Number(sala.id_sala) &&
                              bloquesSeleccionados.includes(indice);

                            return (
                              <button
                                key={horario.inicio}
                                type="button"
                                disabled={ocupado}
                                onClick={() => {
                                  if (!ocupado) {
                                    seleccionarBloque(sala, indice);
                                  }
                                }}
                                className={`rounded-2xl py-4 px-4 text-left flex items-center justify-between gap-2 ${
                                  ocupado
                                    ? 'magicos-slot-occupied opacity-65 cursor-not-allowed'
                                    : seleccionado
                                    ? 'magicos-slot-selected cursor-pointer'
                                    : 'magicos-slot-available cursor-pointer'
                                }`}
                              >
                                <div>
                                  <div className="font-mono font-honor-bold text-sm tabular-nums">
                                    {horario.inicio.slice(0, 5)} – {horario.fin.slice(0, 5)}
                                  </div>
                                  <div
                                    className={`text-[11px] mt-0.5 ${
                                      ocupado
                                        ? 'text-[#FCA5A5]'
                                        : seleccionado
                                        ? 'text-white font-honor-bold'
                                        : 'text-[#7DD3FC]'
                                    }`}
                                  >
                                    {ocupado ? 'Ocupado' : seleccionado ? 'Seleccionado' : 'Disponible'}
                                  </div>
                                </div>
                                <div
                                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-honor-bold ${
                                    ocupado
                                      ? 'bg-[#EF4444]/20 text-[#FCA5A5]'
                                      : seleccionado
                                      ? 'bg-white text-[#0284C7]'
                                      : 'bg-white/10 text-[#7DD3FC]'
                                  }`}
                                >
                                  {ocupado ? '✕' : seleccionado ? '✓' : '+'}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </motion.article>
                    ))
                  )}
                </div>

                {/* Columna Derecha: Formulario de Reservación Guiado y Despejado */}
                <aside className="lg:col-span-5 magicos-liquid-glass rounded-3xl p-6 md:p-8 lg:sticky lg:top-24">
                  <div className="pb-4 mb-5 border-b border-[#7DD3FC]/20">
                    <span className="text-xs font-honor-bold text-[#38BDF8]">Confirmación de Solicitud</span>
                    <h2 className="text-xl font-honor-bold text-white mt-0.5">Completa tu reservación</h2>
                  </div>

                  {/* Resumen visual de lo que el usuario ha elegido */}
                  <div className="p-4 rounded-2xl magicos-liquid-card mb-5 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#BAE6FD]">Espacio elegido:</span>
                      <strong className="text-white font-honor-bold">
                        {salaSeleccionada ? salaSeleccionada.nombre : 'Selecciona un horario a la izquierda'}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#BAE6FD]">Fecha:</span>
                      <span className="font-mono text-white tabular-nums">{fechaFiltro}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-white/10">
                      <span className="text-[#BAE6FD]">Horario consecutivo:</span>
                      <div className="flex items-center gap-2">
                        <strong className="font-mono text-[#38BDF8] tabular-nums">
                          {infoHorarioSeleccionado.texto || 'Ningún bloque elegido'}
                        </strong>
                        {bloquesSeleccionados.length > 0 && (
                          <button
                            type="button"
                            onClick={limpiarSeleccion}
                            className="text-[11px] text-white/70 hover:text-white underline cursor-pointer"
                          >
                            Limpiar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {mensajeReserva && (
                    <div
                      className={`p-4 rounded-2xl mb-5 text-xs leading-relaxed border flex items-start gap-2.5 ${
                        mensajeReserva.tipo === 'success'
                          ? 'bg-[#064E3B]/60 border-[#34D399]/50 text-[#D1FAE5]'
                          : mensajeReserva.tipo === 'warning'
                          ? 'bg-[#78350F]/60 border-[#FBBF24]/50 text-[#FEF3C7]'
                          : 'bg-[#7F1D1D]/60 border-[#F87171]/50 text-[#FEE2E2]'
                      }`}
                    >
                      {mensajeReserva.tipo === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#34D399]" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <p className="font-honor-bold">{mensajeReserva.texto}</p>
                        {mensajeReserva.codigo && (
                          <div className="mt-2 pt-2 border-t border-white/20 flex items-center justify-between">
                            <span className="font-mono font-honor-bold text-xs">Código: {mensajeReserva.codigo}</span>
                            <span className="text-[11px] text-[#A7F3D0]">Enviado a tu correo institucional</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <form onSubmit={registrarReservacion} className="space-y-4">
                    <div>
                      <label htmlFor="formArea" className="block text-xs font-honor-bold text-white mb-1.5">
                        Área o departamento solicitante *
                      </label>
                      <input
                        id="formArea"
                        type="text"
                        value={formArea}
                        onChange={e => setFormArea(e.target.value)}
                        placeholder="Ingresa tu área o carrera"
                        maxLength={120}
                        required
                        className="w-full px-4 py-3 rounded-xl magicos-input text-xs"
                      />
                    </div>

                    <div>
                      <label htmlFor="formResponsable" className="block text-xs font-honor-bold text-white mb-1.5">
                        Nombre de la persona responsable *
                      </label>
                      <input
                        id="formResponsable"
                        type="text"
                        value={formResponsable}
                        onChange={e => setFormResponsable(e.target.value)}
                        placeholder="Nombre completo"
                        maxLength={120}
                        required
                        className="w-full px-4 py-3 rounded-xl magicos-input text-xs"
                      />
                    </div>

                    <div>
                      <label htmlFor="formCorreo" className="block text-xs font-honor-bold text-white mb-1.5">
                        Correo electrónico institucional *
                      </label>
                      <input
                        id="formCorreo"
                        type="email"
                        value={formCorreo}
                        onChange={e => setFormCorreo(e.target.value)}
                        placeholder="correo@institucion.edu.mx"
                        maxLength={160}
                        required
                        className="w-full px-4 py-3 rounded-xl magicos-input text-xs"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={enviandoReserva}
                      className="w-full py-3.5 px-5 rounded-xl magicos-btn-primary disabled:opacity-50 font-honor-bold text-sm cursor-pointer mt-2"
                    >
                      {enviandoReserva ? 'Registrando reservación...' : 'Confirmar Reservación →'}
                    </button>
                  </form>
                </aside>
              </div>
            </motion.div>
          )}

          {/* =====================================================
              VISTA 3: CANCELACIÓN POR EL CLIENTE (CON PORTADA INSTITUCIONAL)
          ===================================================== */}
          {!adminSesionActiva && vista === 'cancelar-cliente' && (
            <motion.div
              key="vista-cancelar-cliente"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-8"
            >
              {/* PORTADA DE CANCELAR RESERVA CON LA NUEVA FOTO DEL CAMPUS */}
              <section className="relative min-h-[300px] rounded-[34px] overflow-hidden border border-[#7DD3FC]/30 shadow-2xl flex flex-col justify-between p-7 md:p-10">
                <div className="absolute inset-0">
                  <img
                    src={CAMPUS_CANCELAR_IMAGE}
                    alt="Edificio Institucional - Cancelar Reservación"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover object-center filter brightness-75 contrast-110"
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        'linear-gradient(180deg, rgba(2, 6, 16, 0.50) 0%, rgba(3, 12, 28, 0.68) 55%, rgba(2, 4, 10, 0.94) 100%)'
                    }}
                  />
                </div>

                <div className="relative z-10 flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="max-w-2xl">
                    <p className="text-xs font-honor-bold tracking-[0.2em] text-[#7DD3FC]">
                      GESTIÓN Y LIBERACIÓN DE HORARIOS
                    </p>
                    <h1 className="text-3xl sm:text-5xl font-honor-bold tracking-tight liquid-hero-title mt-1">
                      Cancelar Reservación
                    </h1>
                    <p className="text-xs sm:text-sm text-[#E0F2FE] mt-2 max-w-xl leading-relaxed">
                      Ingresa tu código de reservación y el correo institucional con el que registraste tu solicitud. Al
                      cancelar, el horario quedará libre de inmediato y recibirás un correo confirmando tu cancelación.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setVista('disponibilidad')}
                    className="px-4 py-2 rounded-full liquid-nav-pill hover:border-[#38BDF8] text-xs font-honor-bold text-white whitespace-nowrap shrink-0 cursor-pointer self-start"
                  >
                    ← Volver a Disponibilidad
                  </button>
                </div>

                {/* Indicador rápido en la parte inferior de la portada */}
                <div className="relative z-10 mt-6 liquid-dock-bar rounded-2xl px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-[#BAE6FD]">
                  <span>
                    Verifica tu código de confirmación (ejemplo de formato: <strong className="text-white font-mono">RSV-000001</strong>)
                  </span>
                  <span className="text-[#38BDF8] font-honor-bold">
                    Comprobante de cancelación enviado a tu correo
                  </span>
                </div>
              </section>

              {/* FORMULARIO DE CANCELACIÓN */}
              <div className="max-w-2xl mx-auto">
                <div className="magicos-liquid-glass rounded-3xl p-8">
                  <div className="pb-5 mb-6 border-b border-[#7DD3FC]/20">
                    <span className="text-xs font-honor-bold text-[#38BDF8]">Datos de Verificación</span>
                    <h2 className="text-2xl font-honor-bold text-white mt-1">
                      Confirmar cancelación de sala
                    </h2>
                    <p className="text-xs text-[#BAE6FD] mt-1">
                      Completa los datos exactos de la reservación que deseas dar de baja.
                    </p>
                  </div>

                  {mensajeCancelCliente && (
                    <div
                      className={`p-4 rounded-2xl mb-5 text-xs leading-relaxed border flex items-start gap-2.5 ${
                        mensajeCancelCliente.tipo === 'success'
                          ? 'bg-[#064E3B]/60 border-[#34D399]/50 text-[#D1FAE5]'
                          : 'bg-[#7F1D1D]/60 border-[#F87171]/50 text-[#FEE2E2]'
                      }`}
                    >
                      {mensajeCancelCliente.tipo === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#34D399]" />
                      ) : (
                        <XCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#F87171]" />
                      )}
                      <div className="flex-1">
                        <p className="font-honor-bold">{mensajeCancelCliente.texto}</p>
                        {mensajeCancelCliente.tipo === 'success' && (
                          <div className="mt-2 pt-2 border-t border-white/20 flex items-center justify-end">
                            <span className="text-[11px] text-[#A7F3D0]">Comprobante de cancelación enviado a tu correo</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <form onSubmit={manejarCancelacionCliente} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-honor-bold text-white mb-1.5">
                          Código de Reservación *
                        </label>
                        <input
                          type="text"
                          value={cancelCodigo}
                          onChange={e => setCancelCodigo(e.target.value.toUpperCase())}
                          placeholder="Código recibido al reservar"
                          required
                          className="w-full px-4 py-3 rounded-xl magicos-input text-sm font-mono font-honor-bold tabular-nums"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-honor-bold text-white mb-1.5">
                          Correo electrónico institucional *
                        </label>
                        <input
                          type="email"
                          value={cancelCorreo}
                          onChange={e => setCancelCorreo(e.target.value)}
                          placeholder="Correo con el que se reservó"
                          required
                          className="w-full px-4 py-3 rounded-xl magicos-input text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-honor-bold text-white mb-1.5">
                        Motivo de cancelación (opcional)
                      </label>
                      <input
                        type="text"
                        value={cancelMotivo}
                        onChange={e => setCancelMotivo(e.target.value)}
                        placeholder="Escribe el motivo de la cancelación"
                        maxLength={200}
                        className="w-full px-4 py-3 rounded-xl magicos-input text-xs"
                      />
                    </div>

                    <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                      <button
                        type="submit"
                        disabled={enviandoCancelCliente}
                        className="w-full py-3.5 px-5 rounded-xl magicos-btn-primary disabled:opacity-50 font-honor-bold text-sm cursor-pointer"
                      >
                        {enviandoCancelCliente ? 'Cancelando reservación...' : 'Cancelar Reservación'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setVista('disponibilidad')}
                        className="w-full sm:w-auto px-6 py-3.5 rounded-xl magicos-btn-ghost text-xs font-honor-bold whitespace-nowrap cursor-pointer"
                      >
                        Volver
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </motion.div>
          )}

          {/* =====================================================
              VISTA 4: LOGIN ADMINISTRATIVO
          ===================================================== */}
          {!adminSesionActiva && vista === 'login' && (
            <motion.div
              key="vista-login"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-md mx-auto py-8"
            >
              <div className="magicos-liquid-glass rounded-3xl p-8 md:p-9">
                <div className="text-center pb-6 mb-6 border-b border-[#7DD3FC]/20">
                  <div className="w-12 h-12 rounded-2xl magicos-btn-primary text-white flex items-center justify-center mx-auto mb-4">
                    <Lock className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-honor-bold text-[#38BDF8]">Acceso Administrativo</span>
                  <h1 className="text-2xl font-honor-bold text-white mt-1">Bienvenido de nuevo</h1>
                  <p className="text-xs text-[#BAE6FD] mt-1.5 leading-relaxed">
                    Ingresa tus credenciales para gestionar las reservaciones y los espacios institucionales.
                  </p>
                </div>

                {loginError && (
                  <div className="p-3.5 rounded-2xl mb-5 bg-[#7F1D1D]/60 border border-[#F87171]/50 text-xs text-[#FEE2E2] font-honor-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{loginError}</span>
                  </div>
                )}

                <form onSubmit={manejarLoginAdmin} noValidate className="space-y-4">
                  <div>
                    <label htmlFor="email" className="block text-xs font-honor-bold text-white mb-1">
                      Correo institucional o usuario (ej. if0_43366024)
                    </label>
                    <input
                      id="email"
                      type="text"
                      value={loginEmail}
                      onChange={e => setLoginEmail(e.target.value)}
                      placeholder="eduardoenriquezramos8@gmail.com o if0_43366024"
                      className="w-full px-4 py-2.5 rounded-xl magicos-input text-sm"
                    />
                  </div>

                  <div>
                    <label htmlFor="password" className="block text-xs font-honor-bold text-white mb-1">
                      Contraseña
                    </label>
                    <input
                      id="password"
                      type="password"
                      value={loginPassword}
                      onChange={e => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full px-4 py-2.5 rounded-xl magicos-input text-sm"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={enviandoLogin}
                    className="w-full py-3 px-4 rounded-xl magicos-btn-primary font-honor-bold text-sm cursor-pointer"
                  >
                    {enviandoLogin ? 'Iniciando sesión...' : 'Iniciar sesión →'}
                  </button>
                </form>

                <div className="mt-6 pt-4 border-t border-[#7DD3FC]/20 text-center">
                  <button
                    type="button"
                    onClick={() => setVista('inicio')}
                    className="text-xs font-honor-bold text-[#38BDF8] hover:text-white cursor-pointer"
                  >
                    ← Volver a la página principal
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* =====================================================
              VISTA 5: MÓDULO ADMINISTRATIVO EXCLUSIVO EN SESIÓN
          ===================================================== */}
          {adminSesionActiva && vista === 'admin' && (
            <motion.div
              key="vista-admin"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-8"
            >
              <div className="magicos-liquid-glass rounded-3xl p-7 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                <div>
                  <span className="text-xs font-honor-bold text-[#38BDF8]">
                    Panel Exclusivo de Administrador · {adminUsuario || correoAdminConfigurado}
                  </span>
                  <h1 className="text-2xl md:text-3xl font-honor-bold text-white mt-1">
                    Administración de Salas y Reservaciones
                  </h1>
                  <p className="text-sm text-[#BAE6FD] mt-1">
                    Gestiona los espacios institucionales, cancela reservaciones notificando al cliente y personaliza el
                    correo administrativo.
                  </p>
                </div>

                <div className="flex items-center gap-1.5 p-1.5 bg-[#040914]/80 border border-[#7DD3FC]/30 rounded-2xl shrink-0 overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setAdminSubTab('salas')}
                    className={`px-4 py-2 rounded-xl text-xs font-honor-bold magicos-transition whitespace-nowrap shrink-0 cursor-pointer ${
                      adminSubTab === 'salas'
                        ? 'magicos-btn-primary'
                        : 'text-[#BAE6FD] hover:text-white'
                    }`}
                  >
                    Administrar Salas
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAdminSubTab('reservaciones');
                      cargarReservacionesAdmin(adminToken);
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-honor-bold magicos-transition whitespace-nowrap shrink-0 cursor-pointer ${
                      adminSubTab === 'reservaciones'
                        ? 'magicos-btn-primary'
                        : 'text-[#BAE6FD] hover:text-white'
                    }`}
                  >
                    Reservaciones ({todasReservacionesAdmin.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAdminSubTab('notificaciones');
                      cargarNotificacionesActivas(adminToken, '', false);
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-honor-bold magicos-transition whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
                      adminSubTab === 'notificaciones'
                        ? 'magicos-btn-primary'
                        : 'text-[#BAE6FD] hover:text-white'
                    }`}
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>Notificaciones ({notificaciones.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminSubTab('configuracion')}
                    className={`px-4 py-2 rounded-xl text-xs font-honor-bold magicos-transition whitespace-nowrap shrink-0 cursor-pointer ${
                      adminSubTab === 'configuracion'
                        ? 'magicos-btn-primary'
                        : 'text-[#BAE6FD] hover:text-white'
                    }`}
                  >
                    Correo del Administrador
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAdminSubTab('basedatos');
                      cargarDBStudio(adminToken);
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-honor-bold magicos-transition whitespace-nowrap shrink-0 cursor-pointer ${
                      adminSubTab === 'basedatos'
                        ? 'magicos-btn-primary'
                        : 'text-[#BAE6FD] hover:text-white'
                    }`}
                  >
                    Servidor MySQL (if0_43366024_ReservaEspacios)
                  </button>
                </div>
              </div>

              {/* SUB-TAB 1: ADMINISTRACIÓN DE SALAS */}
              {adminSubTab === 'salas' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  <aside className="lg:col-span-4 magicos-liquid-glass rounded-3xl p-6 md:p-7">
                    <div className="pb-4 mb-4 border-b border-[#7DD3FC]/20 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-honor-bold text-[#38BDF8]">
                          {idSalaEditando ? 'Edición de Espacio' : 'Registro de Espacio'}
                        </span>
                        <h3 className="text-lg font-honor-bold text-white mt-0.5">
                          {idSalaEditando ? 'Modificar sala' : 'Registrar nueva sala'}
                        </h3>
                      </div>
                      {idSalaEditando && (
                        <button
                          type="button"
                          onClick={prepararNuevaSala}
                          className="text-xs font-honor-bold text-[#38BDF8] underline cursor-pointer"
                        >
                          + Registrar Nueva Sala
                        </button>
                      )}
                    </div>

                    {alertaAdminSala && (
                      <div
                        className={`p-3.5 rounded-2xl mb-4 text-xs font-honor-bold border ${
                          alertaAdminSala.tipo === 'success'
                            ? 'bg-[#064E3B]/60 border-[#34D399]/50 text-[#D1FAE5]'
                            : 'bg-[#7F1D1D]/60 border-[#F87171]/50 text-[#FEE2E2]'
                        }`}
                      >
                        {alertaAdminSala.texto}
                      </div>
                    )}

                    <form onSubmit={guardarSalaAdmin} className="space-y-4">
                      <div>
                        <label className="block text-xs font-honor-bold text-white mb-1">Nombre de la sala *</label>
                        <input
                          type="text"
                          value={salaNombre}
                          onChange={e => setSalaNombre(e.target.value)}
                          placeholder="Nombre del espacio"
                          maxLength={100}
                          required
                          className="w-full px-3.5 py-2.5 rounded-xl magicos-input text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-honor-bold text-white mb-1">Edificio o ubicación *</label>
                        <input
                          type="text"
                          value={salaEdificio}
                          onChange={e => setSalaEdificio(e.target.value)}
                          placeholder="Edificio o ubicación"
                          maxLength={100}
                          required
                          className="w-full px-3.5 py-2.5 rounded-xl magicos-input text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-honor-bold text-white mb-1">Capacidad (personas) *</label>
                        <input
                          type="number"
                          value={salaCapacidad}
                          onChange={e => setSalaCapacidad(e.target.value)}
                          placeholder="Capacidad"
                          min={1}
                          max={500}
                          required
                          className="w-full px-3.5 py-2.5 rounded-xl magicos-input text-xs tabular-nums"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-honor-bold text-white mb-1">
                          Responsable / Encargado *
                        </label>
                        <input
                          type="text"
                          value={salaEncargado}
                          onChange={e => setSalaEncargado(e.target.value)}
                          placeholder="Nombre del encargado"
                          maxLength={120}
                          required
                          className="w-full px-3.5 py-2.5 rounded-xl magicos-input text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-honor-bold text-white mb-1">Estado del espacio *</label>
                        <select
                          value={salaActiva}
                          onChange={e => setSalaActiva(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl magicos-input text-xs"
                        >
                          <option value="1" className="bg-[#040914] text-white">
                            Activa (Habilitada para reservaciones)
                          </option>
                          <option value="0" className="bg-[#040914] text-white">
                            Inactiva (En mantenimiento / Deshabilitada)
                          </option>
                        </select>
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                        <button
                          type="submit"
                          disabled={guardandoSala}
                          className="flex-1 py-2.5 px-4 rounded-xl magicos-btn-primary font-honor-bold text-xs cursor-pointer"
                        >
                          {guardandoSala ? 'Guardando...' : idSalaEditando ? 'Guardar Cambios' : 'Guardar Sala'}
                        </button>
                        {idSalaEditando && (
                          <button
                            type="button"
                            onClick={prepararNuevaSala}
                            className="py-2.5 px-4 rounded-xl magicos-btn-ghost font-honor-bold text-xs cursor-pointer"
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    </form>
                  </aside>

                  <section className="lg:col-span-8 magicos-liquid-glass rounded-3xl p-6 md:p-7">
                    <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-5 border-b border-[#7DD3FC]/20">
                      <div>
                        <span className="text-xs font-honor-bold text-[#38BDF8]">Catálogo de Espacios</span>
                        <h3 className="text-lg font-honor-bold text-white mt-0.5">
                          Espacios registrados ({salasFiltradasAdmin.length} salas)
                        </h3>
                      </div>

                      <div className="relative min-w-[240px]">
                        <Search className="w-4 h-4 text-[#7DD3FC] absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="search"
                          value={buscarSalaTexto}
                          onChange={e => setBuscarSalaTexto(e.target.value)}
                          placeholder="Buscar por nombre, edificio o encargado..."
                          className="w-full pl-9 pr-3.5 py-2 rounded-xl magicos-input text-xs"
                        />
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-[#7DD3FC]/20 text-[11px] font-honor-bold text-[#7DD3FC]">
                            <th className="py-3 px-3">ID</th>
                            <th className="py-3 px-3">Espacio</th>
                            <th className="py-3 px-3">Edificio</th>
                            <th className="py-3 px-3 text-right">Capacidad</th>
                            <th className="py-3 px-3">Encargado</th>
                            <th className="py-3 px-3">Estado</th>
                            <th className="py-3 px-3 text-right">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#7DD3FC]/15 text-xs">
                          {salasFiltradasAdmin.map(sala => {
                            const activa = Number(sala.activa) === 1;
                            return (
                              <tr key={sala.id_sala} className="hover:bg-[#38BDF8]/10 magicos-transition">
                                <td className="py-3.5 px-3 font-mono font-honor-bold text-[#38BDF8] tabular-nums">
                                  {sala.id_sala}
                                </td>
                                <td className="py-3.5 px-3 font-honor-bold text-white">{sala.nombre}</td>
                                <td className="py-3.5 px-3 text-[#BAE6FD]">{sala.edificio}</td>
                                <td className="py-3.5 px-3 text-right text-[#BAE6FD] tabular-nums">
                                  {sala.capacidad} personas
                                </td>
                                <td className="py-3.5 px-3 text-[#BAE6FD]">{sala.encargado}</td>
                                <td className="py-3.5 px-3">
                                  <span className={`font-honor-bold ${activa ? 'text-[#34D399]' : 'text-[#F87171]'}`}>
                                    {activa ? 'Activa' : 'Inactiva'}
                                  </span>
                                </td>
                                <td className="py-3.5 px-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() => cargarSalaEnFormulario(sala)}
                                    className="px-3 py-1.5 rounded-lg magicos-btn-ghost font-honor-bold text-xs cursor-pointer"
                                  >
                                    Editar
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </div>
              )}

              {/* SUB-TAB 2: CANCELACIÓN DE RESERVACIONES POR EL ADMINISTRADOR */}
              {adminSubTab === 'reservaciones' && (
                <section className="magicos-liquid-glass rounded-3xl p-6 md:p-8 space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#7DD3FC]/20">
                    <div>
                      <span className="text-xs font-honor-bold text-[#38BDF8]">Gestión de Reservaciones</span>
                      <h2 className="text-xl font-honor-bold text-white mt-0.5">
                        Reservaciones registradas
                      </h2>
                      <p className="text-xs text-[#BAE6FD] mt-1">
                        Al cancelar una reservación desde aquí, se enviará un correo electrónico automático al cliente.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        type="search"
                        value={buscarReservaAdmin}
                        onChange={e => setBuscarReservaAdmin(e.target.value)}
                        placeholder="Buscar reservación..."
                        className="px-3.5 py-2 rounded-xl magicos-input text-xs min-w-[200px]"
                      />
                      <select
                        value={filtroEstadoAdmin}
                        onChange={e => setFiltroEstadoAdmin(e.target.value)}
                        className="px-3.5 py-2 rounded-xl magicos-input text-xs font-honor-bold"
                      >
                        <option value="todas" className="bg-[#040914] text-white">
                          Todas
                        </option>
                        <option value="ACTIVA" className="bg-[#040914] text-white">
                          Activas
                        </option>
                        <option value="cancelada" className="bg-[#040914] text-white">
                          Canceladas
                        </option>
                      </select>
                    </div>
                  </div>

                  {alertaAdminReservas && (
                    <div
                      className={`p-4 rounded-2xl text-xs font-honor-bold border ${
                        alertaAdminReservas.tipo === 'success'
                          ? 'bg-[#064E3B]/60 border-[#34D399]/50 text-[#D1FAE5]'
                          : 'bg-[#7F1D1D]/60 border-[#F87171]/50 text-[#FEE2E2]'
                      }`}
                    >
                      {alertaAdminReservas.texto}
                    </div>
                  )}

                  {reservaACancelarAdmin && (
                    <form
                      onSubmit={confirmarCancelacionAdmin}
                      className="p-6 rounded-2xl magicos-liquid-card border border-[#38BDF8]/50 space-y-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <span className="text-xs font-honor-bold text-[#38BDF8]">
                            Confirmar Cancelación de Reserva
                          </span>
                          <h3 className="text-base font-honor-bold text-white mt-0.5">
                            Reserva {reservaACancelarAdmin.codigo} — {reservaACancelarAdmin.nombre_sala}
                          </h3>
                          <p className="text-xs text-[#BAE6FD] mt-1">
                            Se enviará notificación por correo al cliente:{' '}
                            <strong className="font-mono text-white">{reservaACancelarAdmin.correo}</strong>
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setReservaACancelarAdmin(null)}
                          className="text-xs font-honor-bold text-[#7DD3FC] hover:text-white"
                        >
                          ✕
                        </button>
                      </div>

                      <div>
                        <label className="block text-xs font-honor-bold text-white mb-1">
                          Motivo de la cancelación *
                        </label>
                        <input
                          type="text"
                          value={motivoCancelAdmin}
                          onChange={e => setMotivoCancelAdmin(e.target.value)}
                          placeholder="Indica el motivo que recibirá el cliente en su correo"
                          required
                          className="w-full px-3.5 py-2.5 rounded-xl magicos-input text-xs"
                        />
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          type="submit"
                          disabled={procesandoCancelAdmin}
                          className="px-5 py-2.5 rounded-xl magicos-btn-primary text-xs font-honor-bold cursor-pointer"
                        >
                          {procesandoCancelAdmin ? 'Cancelando...' : 'Confirmar Cancelación y Enviar Correo'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setReservaACancelarAdmin(null)}
                          className="px-4 py-2.5 rounded-xl magicos-btn-ghost text-xs font-honor-bold cursor-pointer"
                        >
                          Cerrar
                        </button>
                      </div>
                    </form>
                  )}

                  {reservacionesFiltradasAdmin.length === 0 ? (
                    <p className="text-sm text-[#BAE6FD] py-8 text-center">
                      No hay reservaciones registradas.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-[#7DD3FC]/20 text-[11px] font-honor-bold text-[#7DD3FC]">
                            <th className="py-3 px-3">Código</th>
                            <th className="py-3 px-3">Espacio</th>
                            <th className="py-3 px-3">Fecha y Horario</th>
                            <th className="py-3 px-3">Responsable / Área</th>
                            <th className="py-3 px-3">Correo del Cliente</th>
                            <th className="py-3 px-3">Estado</th>
                            <th className="py-3 px-3 text-right">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#7DD3FC]/15 text-xs">
                          {reservacionesFiltradasAdmin.map(r => {
                            const esCancelada = r.estado.toLowerCase() === 'cancelada';
                            return (
                              <tr key={r.id_reservacion} className="hover:bg-[#38BDF8]/10 magicos-transition">
                                <td className="py-3.5 px-3 font-mono font-honor-bold text-[#38BDF8] tabular-nums">
                                  {r.codigo}
                                </td>
                                <td className="py-3.5 px-3 font-honor-bold text-white">{r.nombre_sala}</td>
                                <td className="py-3.5 px-3 font-mono text-[#BAE6FD] tabular-nums">
                                  {r.fecha} · {r.hora_inicio.slice(0, 5)}-{r.hora_fin.slice(0, 5)}
                                </td>
                                <td className="py-3.5 px-3">
                                  <div className="font-honor-bold text-white">{r.responsable}</div>
                                  <div className="text-[11px] text-[#7DD3FC]">{r.area_solicitante}</div>
                                </td>
                                <td className="py-3.5 px-3 font-mono text-[#BAE6FD]">{r.correo}</td>
                                <td className="py-3.5 px-3">
                                  {esCancelada ? (
                                    <span className="font-honor-bold text-[#F87171]">
                                      Cancelada ({r.cancelado_por || 'N/A'})
                                    </span>
                                  ) : (
                                    <span className="font-honor-bold text-[#34D399]">Activa</span>
                                  )}
                                </td>
                                <td className="py-3.5 px-3 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    {!esCancelada && (
                                      <button
                                        type="button"
                                        onClick={() => setReservaACancelarAdmin(r)}
                                        className="px-3 py-1.5 rounded-lg magicos-btn-ghost font-honor-bold text-xs whitespace-nowrap cursor-pointer hover:border-[#F59E0B] hover:text-[#FBBF24]"
                                        title="Cancelar reservación y avisar al cliente por correo"
                                      >
                                        Cancelar
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => eliminarReservacionAdmin(r.id_reservacion, r.codigo)}
                                      className="p-1.5 rounded-lg bg-black/25 hover:bg-[#EF4444] text-[#F87171] hover:text-white magicos-transition cursor-pointer"
                                      title="Borrar permanentemente de la base de datos MySQL"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )}

              {/* SUB-TAB 3: PERSONALIZAR CORREO Y CONTRASEÑA DEL ADMINISTRADOR EN LA BD */}
              {adminSubTab === 'configuracion' && (
                <div className="max-w-xl mx-auto">
                  <div className="magicos-liquid-glass rounded-3xl p-7 space-y-5">
                    <div>
                      <span className="text-xs font-honor-bold text-[#38BDF8]">Base de Datos · Configuración</span>
                      <h2 className="text-xl font-honor-bold text-white mt-1">
                        Personalizar Correo del Administrador
                      </h2>
                      <p className="text-xs text-[#BAE6FD] mt-1 leading-relaxed">
                        Personaliza el correo electrónico del administrador para que cualquier notificación de
                        cancelación de los clientes llegue directamente a la dirección configurada.
                      </p>
                    </div>

                    {alertaCorreoAdmin && (
                      <div
                        className={`p-3.5 rounded-2xl text-xs font-honor-bold border ${
                          alertaCorreoAdmin.tipo === 'success'
                            ? 'bg-[#064E3B]/60 border-[#34D399]/50 text-[#D1FAE5]'
                            : 'bg-[#7F1D1D]/60 border-[#F87171]/50 text-[#FEE2E2]'
                        }`}
                      >
                        {alertaCorreoAdmin.texto}
                      </div>
                    )}

                    <form onSubmit={guardarConfiguracionAdminBD} className="space-y-4">
                      <div>
                        <label className="block text-xs font-honor-bold text-white mb-1">
                          Correo del Administrador *
                        </label>
                        <input
                          type="email"
                          value={nuevoCorreoAdminInput}
                          onChange={e => setNuevoCorreoAdminInput(e.target.value)}
                          placeholder="Correo del administrador"
                          required
                          className="w-full px-4 py-2.5 rounded-xl magicos-input text-sm font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-honor-bold text-white mb-1">
                          Actualizar contraseña en la base de datos (opcional)
                        </label>
                        <input
                          type="password"
                          value={nuevaPasswordAdminInput}
                          onChange={e => setNuevaPasswordAdminInput(e.target.value)}
                          placeholder="Dejar en blanco para conservar la actual"
                          className="w-full px-4 py-2.5 rounded-xl magicos-input text-sm"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={guardandoCorreoAdmin}
                        className="w-full py-3 px-4 rounded-xl magicos-btn-primary font-honor-bold text-sm cursor-pointer"
                      >
                        {guardandoCorreoAdmin ? 'Guardando...' : 'Guardar Configuración'}
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* SUB-TAB 4: EXPLORADOR Y CONSOLA DE BASE DE DATOS MYSQL (ReservaEspacios) */}
              {adminSubTab === 'basedatos' && (
                <div className="space-y-6">
                  <div className="magicos-liquid-glass rounded-3xl p-6 md:p-7">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[#7DD3FC]/20">
                      <div>
                        <span className="text-xs font-honor-bold text-[#34D399] uppercase tracking-wider">
                          ● Servidor MySQL Activo · Base de Datos: {dbStudioDatos?.proyecto || 'if0_43366024_ReservaEspacios'}
                        </span>
                        <h2 className="text-xl md:text-2xl font-honor-bold text-white mt-1">
                          Explorador de Base de Datos ({dbStudioDatos?.motor || 'Servidor MySQL 8.0 · sql313.infinityfree.com'})
                        </h2>
                        <p className="text-xs text-[#BAE6FD] mt-1">
                          Visualiza las 5 tablas en vivo y ejecuta consultas o modificaciones SQL directamente en el servidor MySQL if0_43366024_ReservaEspacios (sql313.infinityfree.com).
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => cargarDBStudio(adminToken)}
                        disabled={cargandoDBStudio}
                        className="px-4 py-2.5 rounded-xl magicos-btn-ghost text-xs font-honor-bold flex items-center gap-2 self-start cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${cargandoDBStudio ? 'animate-spin' : ''}`} />
                        <span>Actualizar Tablas</span>
                      </button>
                    </div>

                    {/* Botones de selección de las 5 tablas */}
                    <div className="flex flex-wrap items-center gap-2 mt-5">
                      {(['salas', 'reservaciones', 'configuracion', 'correos_log', 'users'] as const).map(nombreTabla => {
                        const filasTabla = dbStudioDatos?.tablas?.[nombreTabla] || [];
                        const activa = tablaActivaDB === nombreTabla;
                        return (
                          <button
                            key={nombreTabla}
                            type="button"
                            onClick={() => setTablaActivaDB(nombreTabla)}
                            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold cursor-pointer magicos-transition ${
                              activa
                                ? 'magicos-btn-primary'
                                : 'bg-[#040914]/80 border border-[#7DD3FC]/25 text-[#BAE6FD] hover:text-white'
                            }`}
                          >
                            {nombreTabla} ({filasTabla.length})
                          </button>
                        );
                      })}
                    </div>

                    {/* Tabla de registros en vivo */}
                    <div className="mt-5 overflow-x-auto rounded-2xl border border-[#7DD3FC]/20 bg-[#030712]/80">
                      {(() => {
                        const filas = dbStudioDatos?.tablas?.[tablaActivaDB] || [];
                        if (cargandoDBStudio && !dbStudioDatos) {
                          return (
                            <div className="p-8 text-center text-xs text-[#BAE6FD]">
                              Cargando registros desde la base de datos...
                            </div>
                          );
                        }
                        if (filas.length === 0) {
                          return (
                            <div className="p-8 text-center text-xs text-[#BAE6FD]">
                              La tabla <span className="font-mono font-bold text-white">{tablaActivaDB}</span> no tiene registros en este momento.
                            </div>
                          );
                        }
                        const columnas = Object.keys(filas[0]);
                        return (
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="border-b border-[#7DD3FC]/20 bg-[#071126]">
                                {columnas.map(col => (
                                  <th key={col} className="py-3 px-4 font-mono font-bold text-[#38BDF8] whitespace-nowrap">
                                    {col}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#7DD3FC]/10">
                              {filas.map((fila, idx) => (
                                <tr key={idx} className="hover:bg-[#38BDF8]/5">
                                  {columnas.map(col => (
                                    <td key={col} className="py-2.5 px-4 font-mono text-[#E0F2FE] max-w-xs truncate">
                                      {fila[col] === null || fila[col] === undefined ? (
                                        <span className="text-[#7DD3FC]/40">NULL</span>
                                      ) : (
                                        String(fila[col])
                                      )}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Consola SQL Interactiva con Permisos Completos */}
                  <div className="magicos-liquid-glass rounded-3xl p-6 md:p-7 space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div>
                        <span className="text-xs font-honor-bold text-[#38BDF8]">Consola SQL Directa · ReservaEspacios</span>
                        <h3 className="text-lg font-honor-bold text-white mt-0.5">
                          Ejecutar Consultas o Modificaciones SQL (SELECT, INSERT, UPDATE, DELETE)
                        </h3>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { label: 'Ver Salas', sql: 'SELECT * FROM salas ORDER BY id_sala ASC;' },
                          { label: 'Ver Reservaciones', sql: 'SELECT * FROM reservaciones ORDER BY id_reservacion DESC;' },
                          { label: 'Ver Configuración', sql: 'SELECT * FROM configuracion;' },
                          { label: 'Ver Correos', sql: 'SELECT id_correo, destinatario, asunto, tipo, codigo_reserva, enviado_en FROM correos_log ORDER BY id_correo DESC;' }
                        ].map(item => (
                          <button
                            key={item.label}
                            type="button"
                            onClick={() => setConsultaSQLInput(item.sql)}
                            className="px-3 py-1.5 rounded-lg bg-[#040914]/90 border border-[#7DD3FC]/30 text-[11px] font-honor-bold text-[#BAE6FD] hover:text-white cursor-pointer"
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <form onSubmit={ejecutarSQLDirecto} className="space-y-3">
                      <textarea
                        rows={3}
                        value={consultaSQLInput}
                        onChange={e => setConsultaSQLInput(e.target.value)}
                        placeholder="Escribe tu consulta SQL aquí..."
                        className="w-full p-4 rounded-2xl magicos-input font-mono text-xs"
                      />
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={ejecutandoSQL}
                          className="px-5 py-2.5 rounded-xl magicos-btn-primary font-honor-bold text-xs cursor-pointer"
                        >
                          {ejecutandoSQL ? 'Ejecutando SQL...' : 'Ejecutar Sentencia SQL'}
                        </button>
                      </div>
                    </form>

                    {errorSQL && (
                      <div className="p-3.5 rounded-2xl bg-[#7F1D1D]/60 border border-[#F87171]/50 text-xs text-[#FEE2E2] font-mono">
                        {errorSQL}
                      </div>
                    )}

                    {resultadoSQL && (
                      <div className="space-y-2">
                        <p className="text-xs font-honor-bold text-[#34D399]">
                          Comando: {resultadoSQL.comando} · Filas afectadas/devueltas: {resultadoSQL.total_filas}
                        </p>
                        {resultadoSQL.filas.length > 0 && (
                          <div className="overflow-x-auto rounded-2xl border border-[#7DD3FC]/20 bg-[#030712]/80">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="border-b border-[#7DD3FC]/20 bg-[#071126]">
                                  {Object.keys(resultadoSQL.filas[0]).map(col => (
                                    <th key={col} className="py-2.5 px-4 font-mono font-bold text-[#38BDF8] whitespace-nowrap">
                                      {col}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#7DD3FC]/10">
                                {resultadoSQL.filas.map((fila, i) => (
                                  <tr key={i} className="hover:bg-[#38BDF8]/5">
                                    {Object.keys(resultadoSQL.filas[0]).map(col => (
                                      <td key={col} className="py-2 px-4 font-mono text-[#E0F2FE] max-w-xs truncate">
                                        {fila[col] === null || fila[col] === undefined ? 'NULL' : String(fila[col])}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SUB-TAB 5: BANDEJA DE NOTIFICACIONES Y CORREOS (EXCLUSIVO ADMINISTRADOR) */}
              {adminSubTab === 'notificaciones' && (
                <div className="space-y-6">
                  {/* Encabezado de la sección dentro del panel de admin */}
                  <div className="magicos-liquid-glass rounded-3xl p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <span className="text-xs font-honor-bold text-[#38BDF8] tracking-wider uppercase">
                        Panel Administrativo · Registro de Notificaciones
                      </span>
                      <h2 className="text-2xl font-honor-bold text-white mt-1">
                        Bandeja de Notificaciones y Comprobantes
                      </h2>
                      <p className="text-xs text-[#BAE6FD] mt-1 max-w-xl leading-relaxed">
                        Visualiza los comprobantes automáticos emitidos a los usuarios, avisos de cancelación y gestiona el historial de notificaciones.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 self-start shrink-0">
                      {notificaciones.length > 0 && (
                        <button
                          type="button"
                          onClick={vaciarTodasLasNotificaciones}
                          className="px-4 py-2 rounded-full liquid-nav-pill hover:border-[#F87171] text-xs font-honor-bold text-white flex items-center gap-2 whitespace-nowrap cursor-pointer magicos-transition"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-[#F87171]" />
                          <span>Vaciar bandeja</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => cargarNotificacionesActivas(adminToken, '', false)}
                        className="px-4 py-2 rounded-full liquid-nav-pill hover:border-[#38BDF8] text-xs font-honor-bold text-white flex items-center gap-2 whitespace-nowrap cursor-pointer magicos-transition"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-[#38BDF8]" />
                        <span>Actualizar</span>
                      </button>
                    </div>
                  </div>

                  {/* BARRA DE FILTRO Y BÚSQUEDA */}
                  <div className="liquid-dock-bar rounded-3xl p-3 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                    {/* Buscador instantáneo por correo o código */}
                    <div className="flex-1 liquid-dock-segment rounded-2xl px-4 py-2.5 flex items-center gap-3">
                      <Search className="w-4 h-4 text-[#38BDF8] shrink-0" />
                      <input
                        type="search"
                        value={buscarNotificacionTexto}
                        onChange={e => setBuscarNotificacionTexto(e.target.value)}
                        placeholder="Buscar por código (ej. RSV-...), correo electrónico o asunto..."
                        className="w-full bg-transparent text-xs font-honor-medium text-white placeholder-[#BAE6FD]/60 focus:outline-none"
                      />
                      {buscarNotificacionTexto && (
                        <button
                          type="button"
                          onClick={() => setBuscarNotificacionTexto('')}
                          className="text-xs text-[#7DD3FC] hover:text-white cursor-pointer"
                        >
                          Limpiar
                        </button>
                      )}
                    </div>

                    {/* Pestañas de filtro rápido */}
                    <div className="flex items-center gap-1.5 overflow-x-auto">
                      <button
                        type="button"
                        onClick={() => setFiltroTipoNotificacion('todas')}
                        className={`px-4 py-2.5 rounded-2xl text-xs font-honor-bold whitespace-nowrap shrink-0 cursor-pointer magicos-transition ${
                          filtroTipoNotificacion === 'todas'
                            ? 'magicos-btn-primary text-white'
                            : 'bg-white/5 hover:bg-white/12 text-[#BAE6FD] hover:text-white'
                        }`}
                      >
                        Todas ({notificaciones.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setFiltroTipoNotificacion('confirmaciones')}
                        className={`px-4 py-2.5 rounded-2xl text-xs font-honor-bold whitespace-nowrap shrink-0 cursor-pointer magicos-transition ${
                          filtroTipoNotificacion === 'confirmaciones'
                            ? 'magicos-btn-primary text-white'
                            : 'bg-white/5 hover:bg-white/12 text-[#BAE6FD] hover:text-white'
                        }`}
                      >
                        Confirmaciones
                      </button>
                      <button
                        type="button"
                        onClick={() => setFiltroTipoNotificacion('cancelaciones')}
                        className={`px-4 py-2.5 rounded-2xl text-xs font-honor-bold whitespace-nowrap shrink-0 cursor-pointer magicos-transition ${
                          filtroTipoNotificacion === 'cancelaciones'
                            ? 'magicos-btn-primary text-white'
                            : 'bg-white/5 hover:bg-white/12 text-[#BAE6FD] hover:text-white'
                        }`}
                      >
                        Cancelaciones
                      </button>
                    </div>
                  </div>

                  {/* PANEL DIVIDIDO: LISTA DE NOTIFICACIONES + VISTA PREVIA DEL COMPROBANTE */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    <div className="lg:col-span-5 magicos-liquid-glass rounded-3xl p-5 space-y-3 max-h-[580px] overflow-y-auto">
                      <div className="flex items-center justify-between px-2 pb-2 border-b border-[#7DD3FC]/20 text-xs text-[#BAE6FD]">
                        <span className="font-honor-bold text-white">
                          Mensajes registrados ({notificacionesFiltradas.length})
                        </span>
                        <span>Toca uno para abrir</span>
                      </div>

                      {notificacionesFiltradas.length === 0 ? (
                        <p className="text-xs text-[#BAE6FD] p-8 text-center">
                          No hay notificaciones que coincidan con la búsqueda.
                        </p>
                      ) : (
                        notificacionesFiltradas.map(n => {
                          const esCancelacion = n.tipo.includes('CANCELACION');
                          return (
                            <div
                              key={n.id_correo}
                              onClick={() => setNotificacionSeleccionada(n)}
                              className={`w-full text-left p-4 rounded-2xl border magicos-transition cursor-pointer flex items-start justify-between gap-3 ${
                                notificacionSeleccionada?.id_correo === n.id_correo
                                  ? 'magicos-slot-selected text-white'
                                  : 'magicos-liquid-card hover:border-[#38BDF8] text-white'
                              }`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums">
                                  <span
                                    className={`px-2 py-0.5 rounded-md font-honor-bold ${
                                      esCancelacion
                                        ? 'bg-[#EF4444]/25 text-[#FCA5A5]'
                                        : 'bg-[#38BDF8]/25 text-[#E0F2FE]'
                                    }`}
                                  >
                                    {n.codigo_reserva || 'AVISO'}
                                  </span>
                                  <span className="text-[#BAE6FD]">{n.enviado_en}</span>
                                </div>
                                <div className="font-honor-bold text-xs mt-2 line-clamp-1">{n.asunto}</div>
                                <div className="text-[11px] mt-1 text-[#BAE6FD] truncate font-mono">
                                  Correo: {n.destinatario}
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  eliminarNotificacion(n.id_correo);
                                }}
                                title="Borrar notificación"
                                className="p-2 rounded-xl bg-black/25 hover:bg-[#EF4444] text-white/80 hover:text-white magicos-transition shrink-0 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="lg:col-span-7 magicos-liquid-glass rounded-3xl p-7">
                      {notificacionSeleccionada ? (
                        <div className="space-y-4">
                          <div className="pb-4 border-b border-[#7DD3FC]/20 flex items-start justify-between gap-4">
                            <div className="space-y-1">
                              <span className="text-[11px] font-mono font-honor-bold text-[#38BDF8]">
                                {notificacionSeleccionada.codigo_reserva
                                  ? `REFERENCIA: ${notificacionSeleccionada.codigo_reserva}`
                                  : 'NOTIFICACIÓN DEL SISTEMA'}
                              </span>
                              <h2 className="text-lg font-honor-bold text-white">{notificacionSeleccionada.asunto}</h2>
                              <div className="text-xs text-[#BAE6FD] flex flex-wrap gap-4 pt-1 font-mono">
                                <span>
                                  <strong>Destinatario:</strong> {notificacionSeleccionada.destinatario}
                                </span>
                                <span>
                                  <strong>Fecha:</strong> {notificacionSeleccionada.enviado_en}
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => eliminarNotificacion(notificacionSeleccionada.id_correo)}
                              className="px-3.5 py-2 rounded-xl magicos-btn-ghost text-xs font-honor-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-[#F87171]" />
                              <span>Borrar</span>
                            </button>
                          </div>

                          <div
                            className="bg-white rounded-2xl p-4 text-[#0A1931]"
                            dangerouslySetInnerHTML={{ __html: notificacionSeleccionada.cuerpo_html }}
                          />
                        </div>
                      ) : (
                        <p className="text-sm text-[#BAE6FD] py-12 text-center">
                          Selecciona una notificación de la lista para visualizar su comprobante completo.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* PIE DE PÁGINA */}
      <footer className="mt-16 magicos-liquid-header text-white border-t border-[#7DD3FC]/20">
        {!adminSesionActiva ? (
          <div className="max-w-[1260px] mx-auto px-6 py-10 grid grid-cols-1 md:grid-cols-3 gap-8 text-xs">
            <div className="space-y-3">
              <img
                src={LOGO_INSTITUCIONAL}
                alt="Logo Institucional"
                referrerPolicy="no-referrer"
                className="h-11 w-11 object-contain"
              />
              <p className="text-[#BAE6FD] max-w-xs leading-relaxed">
                Sistema web para la consulta y reservación de espacios institucionales.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-honor-bold text-[#38BDF8]">Navegación</h4>
              <ul className="space-y-1.5 text-[#BAE6FD]">
                <li>
                  <button type="button" onClick={() => setVista('inicio')} className="hover:text-white cursor-pointer">
                    Inicio
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setVista('disponibilidad')}
                    className="hover:text-white cursor-pointer"
                  >
                    Disponibilidad
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setVista('cancelar-cliente')}
                    className="hover:text-white cursor-pointer"
                  >
                    Cancelar reservación
                  </button>
                </li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-honor-bold text-[#38BDF8]">Acceso</h4>
              <ul className="space-y-1.5 text-[#BAE6FD]">
                <li>
                  <button
                    type="button"
                    onClick={() => setVista('disponibilidad')}
                    className="hover:text-white cursor-pointer"
                  >
                    Disponibilidad
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setVista('login')}
                    className="hover:text-white text-[#7DD3FC]/75 cursor-pointer"
                  >
                    Iniciar sesión como administrador
                  </button>
                </li>
              </ul>
            </div>
          </div>
        ) : null}

        <div className="max-w-[1260px] mx-auto px-6 py-4 border-t border-[#7DD3FC]/15 flex flex-col sm:flex-row items-center justify-between text-[11px] text-[#7DD3FC]">
          <p>© 2026 Sistema de Reservaciones Institucionales.</p>
          <span>{adminSesionActiva ? 'Modo Administrador Activo' : 'Todos los derechos reservados.'}</span>
        </div>
      </footer>
    </div>
  );
}
