
// Direcciones que usa esta página. Se guardan en constantes para escribirlas una sola vez
// y, si un archivo cambia de lugar, solo se corrige aquí.
const API_AREAS = '../php/areas.php';                       // Servidor: lista de áreas, detalle de un área y aceptar/rechazar PTA
const API_USUARIO = '../php/usuario.php';                   // Servidor: datos del usuario con sesión (su nombre, su unidad y si es Planeación)
const PAGINA_LOGIN = '../InicioSesion/inicioSesion.html';   // Página a la que se manda al usuario si no ha iniciado sesión

// Texto y color de cada estado. null = todavía no existe
const ESTADOS = {
  'BORRADOR': 'estado-borrador',
  'ENVIADO': 'estado-enviado'
};

document.addEventListener('DOMContentLoaded', () => {
  mostrarNombreUnidadPropia();
  if (document.getElementById('cuerpoAreas')) cargarLista();
  if (document.getElementById('cuerpoDetalle')) cargarDetalle();
});

// Convierte la respuesta del servidor en datos, o lanza un error con su mensaje
async function leerRespuesta(respuesta) {
  if (respuesta.status === 401) {
    window.location.href = PAGINA_LOGIN;
    throw new Error('Tu sesión expiró. Inicia sesión de nuevo.');
  }

  let resultado;
  try {
    resultado = await respuesta.json();
  } catch {
    throw new Error('El servidor no respondió correctamente. Intenta de nuevo.');
  }

  if (!respuesta.ok) throw new Error(resultado.error || 'Ocurrió un error.');
  return resultado;
}

// Nombre de la unidad de Planeación en el menú lateral
async function mostrarNombreUnidadPropia() {
  try {
    const usuario = await leerRespuesta(await fetch(API_USUARIO));
    const menuNombre = document.getElementById('menuNombreUnidad');
    if (menuNombre) menuNombre.textContent = usuario.unidad || '';
    // Si no es Planeación, quitar la opción del menú (la página mostrará el aviso)
    const opcion = document.getElementById('menuVerAreas');
    if (opcion && !usuario.esPlaneacion) opcion.hidden = true;
    const misPlanes = document.getElementById('menuMisPlanes');
    if (misPlanes && !usuario.esPlaneacion) misPlanes.hidden = true;
  } catch (e) { /* el aviso de error lo muestra la carga principal */ }
}

// ---------------------------------------------------------------------
// Lista de áreas (areas.html)
// ---------------------------------------------------------------------

async function cargarLista() {
  try {
    const resultado = await leerRespuesta(await fetch(API_AREAS));
    document.getElementById('anioPlanes').textContent = resultado.anio;
    mostrarAnioEncabezado(resultado.anio);
    pintarLista(resultado.areas);
    pintarResumen(resultado.areas);
    filtrarAreas(); // aplica la tarjeta seleccionada (al inicio, "Áreas con PTA")
  } catch (error) {
    mostrarMensaje(error.message, 'error');
  }
}

// areas = [{id, nombre, tipo, responsable, estado_plan, estado_final}]
function pintarLista(areas) {
  const tbody = document.getElementById('cuerpoAreas');
  tbody.innerHTML = '';

  areas.forEach(area => {
    const fila = document.createElement('tr');
    // Datos para las tarjetas del resumen (filtro por tarjeta en filtrarAreas)
    fila.dataset.pta = area.tiene_pta ? '1' : '0';
    fila.dataset.avance = area.avance_mes ? '1' : '0';
    fila.innerHTML = `
      <td class="celda-texto">${escaparHtml(area.nombre)}</td>
      <td>${escaparHtml(area.tipo || '—')}</td>
      <td class="celda-texto">${escaparHtml(area.responsable || '—')}</td>
      <td class="oculto">${etiquetaEstado(area.estado_plan, 'SIN PLAN')}</td>
      <td class="oculto">${etiquetaFinal(area.estado_plan, area.estado_final)}</td>
      <!-- Si ya guardó algo se ve su estado (En revisión, Rechazado...); si no, "Sin PTA" -->
      <td>${area.con_plan ? etiquetaRevision(area.estado_plan) : '<span class="estado estado-sin-plan">Sin PTA</span>'}</td>
      <td><a href="../Areas/detalleArea.html?id=${area.id}" class="boton-ver">Ver</a></td>
    `;
    tbody.appendChild(fila);
  });
}

// Tarjetas de arriba: cuántas áreas hay en cada estado.
// "areas" trae todas las áreas activas; las de Programación/PTA solo cuentan las que tienen PTA.
function pintarResumen(areas) {
  const conPta = areas.filter(a => a.tiene_pta);     // PTA aceptado por Planeación
  const conPlan = areas.filter(a => a.con_plan);    // guardaron algo (para las tarjetas ocultas de Programación)
  document.getElementById('totalUnidades').textContent = areas.length;
  document.getElementById('totalAvances').textContent = areas.filter(a => a.avance_mes).length;
  document.getElementById('totalAreas').textContent = conPta.length;
  document.getElementById('totalSinPta').textContent = areas.length - conPta.length;
  document.getElementById('totalSinEnviar').textContent = conPlan.filter(a => a.estado_plan !== 'ENVIADO').length;
  document.getElementById('totalProgramacion').textContent = conPlan.filter(a => a.estado_plan === 'ENVIADO').length;
  document.getElementById('totalFinal').textContent = conPlan.filter(a => a.estado_final === 'ENVIADO').length;
}

// Tarjeta seleccionada del resumen: 'todas', 'avance', 'pta' o 'sinpta' (al abrir la página, "Áreas con PTA")
let filtroTarjeta = 'pta';

// Mensaje cuando la tabla queda vacía, según la tarjeta seleccionada
const SIN_AREAS_POR_TARJETA = {
  todas: 'No hay áreas registradas.',
  avance: 'Ninguna área ha enviado todavía el avance de este mes.',
  pta: 'Ninguna área ha guardado todavía su PTA de este año.',
  sinpta: 'Todas las áreas ya guardaron su PTA de este año.',
};

// Búsqueda, filtros y tarjetas clicables de la lista (solo existen en areas.html)
document.addEventListener('DOMContentLoaded', () => {
  const buscar = document.getElementById('buscarArea');
  if (!buscar) return; // no estamos en areas.html

  // Los filtros son opcionales: se conecta solo el que exista en la página
  const controles = [buscar, document.getElementById('filtroEstado')];
  controles.filter(Boolean).forEach(control => {
    control.addEventListener('input', filtrarAreas);
    control.addEventListener('change', filtrarAreas);
  });

  // Clic en una tarjeta del resumen → la tabla muestra solo esas áreas
  document.querySelectorAll('.resumen-card[data-filtro]').forEach(tarjeta => {
    tarjeta.addEventListener('click', () => {
      filtroTarjeta = tarjeta.dataset.filtro;
      document.querySelectorAll('.resumen-card[data-filtro]').forEach(t =>
        t.setAttribute('aria-pressed', t === tarjeta ? 'true' : 'false'));
      filtrarAreas();
    });
  });
});

// Columnas de la tabla: 0 área, 1 tipo, 2 responsable, 3 estado del plan
function filtrarAreas() {
  const texto = normalizar(document.getElementById('buscarArea').value);
  const estado = document.getElementById('filtroEstado')?.value || '';
  const filas = Array.from(document.querySelectorAll('#cuerpoAreas tr'));

  let visibles = 0;
  let deLaTarjeta = 0; // áreas de la tarjeta seleccionada, sin contar la búsqueda
  filas.forEach(fila => {
    const celdas = fila.cells;
    const coincideTarjeta = filtroTarjeta === 'todas'
      || (filtroTarjeta === 'pta' && fila.dataset.pta === '1')
      || (filtroTarjeta === 'sinpta' && fila.dataset.pta === '0')
      || (filtroTarjeta === 'avance' && fila.dataset.avance === '1');
    const coincideTexto = !texto
      || normalizar(celdas[0].innerText).includes(texto)
      || normalizar(celdas[2].innerText).includes(texto);
    const coincideEstado = !estado || celdas[3].innerText.trim() === estado;

    if (coincideTarjeta) deLaTarjeta++;
    const mostrar = coincideTarjeta && coincideTexto && coincideEstado;
    fila.style.display = mostrar ? '' : 'none';
    if (mostrar) visibles++;
  });

  const listaVacia = document.getElementById('listaVacia');
  listaVacia.textContent = deLaTarjeta === 0
    ? SIN_AREAS_POR_TARJETA[filtroTarjeta]
    : 'No hay áreas que coincidan con la búsqueda.';
  listaVacia.style.display = visibles === 0 ? 'block' : 'none';
}

// ---------------------------------------------------------------------
// Finalizar PTA: Planeación cierra el PTA del año activo (areas.html).
// Después ya nadie puede modificar la Programación, los seguimientos ni la revisión.
// ---------------------------------------------------------------------

const API_PERIODO = '../php/periodo.php';
let anioActual = null;
let aniosExistentes = [];   // años que ya tienen PTA: no se pueden volver a crear
let todosLosMeses = false;  // ¿Planeación habilitó todos los meses de los seguimientos?
let evidenciasTodas = 0;    // semestre (1 o 2) con las evidencias mostradas a todas las áreas; 0 = ninguno

// Dónde quedan los datos de las áreas al finalizar. Por ahora se quedan en la base de datos;
// cuando exista la sección para consultarlos (historial / página del administrador), cambiar este texto.
const DESTINO_DATOS_PTA = 'la base de datos';

document.addEventListener('DOMContentLoaded', () => {
  const btnFinalizar = document.getElementById('btnFinalizarPTA');
  if (!btnFinalizar) return; // no estamos en areas.html

  const ventana = document.getElementById('ventanaConfirmar');
  const cerrar = () => { ventana.style.display = 'none'; };

  // "Finalizar PTA": primero pide confirmar
  btnFinalizar.addEventListener('click', () => {
    document.getElementById('ventanaTexto').innerText =
      `¿Seguro de finalizar el PTA ${anioActual}?\n\n` +
      `Los datos de las áreas se guardarán en ${DESTINO_DATOS_PTA}. ` +
      `Después de finalizarlo, ninguna área podrá modificar su PTA ni sus seguimientos.`;
    ventana.style.display = 'flex';
  });

  document.getElementById('btnConfirmarNo').addEventListener('click', cerrar);
  document.getElementById('btnCerrarVentana').addEventListener('click', cerrar);
  ventana.addEventListener('click', (e) => { if (e.target === ventana) cerrar(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && ventana.style.display === 'flex') cerrar();
  });
  document.getElementById('btnConfirmarSi').addEventListener('click', () => {
    cerrar();
    finalizarPTA();
  });

  // "Nuevo PTA" (solo aparece con el PTA finalizado): ventana que pide el año
  const ventanaNuevo = document.getElementById('ventanaNuevoPTA');
  const inputAnio = document.getElementById('anioNuevo');
  const cerrarNuevo = () => { ventanaNuevo.style.display = 'none'; };

  document.getElementById('btnNuevoPTA').addEventListener('click', abrirVentanaNuevoPTA);
  document.getElementById('btnTodosLosMeses').addEventListener('click', cambiarTodosLosMeses);

  // "Opciones de área": abre / cierra los botones que afectan a todas las áreas (empieza cerrado)
  document.getElementById('btnOpcionesArea').addEventListener('click', () => {
    mostrarOpcionesArea(document.getElementById('opcionesArea').hidden);
  });

  // "Mostrar evidencias 1er / 2do semestre" (todas las áreas). Si ese semestre ya se muestra, el botón lo oculta.
  document.querySelectorAll('[data-evidencias-todas]').forEach(boton => {
    boton.addEventListener('click', async () => {
      const periodo = Number(boton.dataset.evidenciasTodas);
      const nombre = periodo === 1 ? '1er' : '2do';
      if (evidenciasTodas === periodo) {
        if (await confirmar({
          titulo: `Ocultar evidencias del ${nombre} semestre`,
          texto: `¿Ocultar las evidencias del ${nombre} semestre a todas las áreas?\n\nYa no las verán hasta que las vuelvas a mostrar.`,
          botonConfirmar: 'Ocultar',
          peligro: true
        })) {
          cambiarEvidenciasTodas(0);
        }
        return;
      }
      const aviso = evidenciasTodas ? `\n\nLas del ${periodo === 1 ? '2do' : '1er'} semestre se ocultarán (solo un semestre a la vez).` : '';
      if (await confirmar({
        titulo: `Mostrar evidencias del ${nombre} semestre`,
        texto: `¿Mostrar las evidencias del ${nombre} semestre a todas las áreas con PTA aceptado?${aviso}`,
        botonConfirmar: 'Mostrar'
      })) {
        cambiarEvidenciasTodas(periodo);
      }
    });
  });
  document.getElementById('btnCancelarNuevoPTA').addEventListener('click', cerrarNuevo);
  document.getElementById('btnCerrarNuevoPTA').addEventListener('click', cerrarNuevo);
  ventanaNuevo.addEventListener('click', (e) => { if (e.target === ventanaNuevo) cerrarNuevo(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && ventanaNuevo.style.display === 'flex') cerrarNuevo();
  });
  document.getElementById('btnCrearNuevoPTA').addEventListener('click', crearNuevoPTA);

  // Solo números: borra cualquier otro carácter (escrito o pegado) y deja máximo 4 dígitos
  inputAnio.addEventListener('input', () => {
    const limpio = inputAnio.value.replace(/\D/g, '').slice(0, 4);
    if (inputAnio.value !== limpio) inputAnio.value = limpio;
    marcarErrorAnio('');
  });
  inputAnio.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); crearNuevoPTA(); }
  });

  cargarPeriodo();
});

// Habilita todos los meses de los seguimientos, o regresa a capturar solo el mes en curso
async function cambiarTodosLosMeses() {
  const boton = document.getElementById('btnTodosLosMeses');
  boton.disabled = true;
  try {
    const datos = await leerRespuesta(await fetch(API_PERIODO + '?accion=meses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ todos: !todosLosMeses })
    }));
    pintarPeriodo(datos);
    mostrarMensaje(datos.mensaje, 'exito');
  } catch (error) {
    mostrarMensaje(error.message, 'error');
  } finally {
    boton.disabled = false;
  }
}

// Abre (true) o cierra (false) el bloque de "Opciones de área"
function mostrarOpcionesArea(abrir) {
  document.getElementById('opcionesArea').hidden = !abrir;
  const boton = document.getElementById('btnOpcionesArea');
  boton.setAttribute('aria-expanded', abrir ? 'true' : 'false');
}

// Muestra las evidencias del semestre elegido a todas las áreas con PTA aceptado (o las oculta con 0)
async function cambiarEvidenciasTodas(periodo) {
  const botones = document.querySelectorAll('[data-evidencias-todas]');
  botones.forEach(b => { b.disabled = true; });
  try {
    const datos = await leerRespuesta(await fetch(API_PERIODO + '?accion=evidencias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ periodo })
    }));
    pintarPeriodo(datos);
    mostrarMensaje(datos.mensaje, 'exito');
  } catch (error) {
    mostrarMensaje(error.message, 'error');
  } finally {
    botones.forEach(b => { b.disabled = false; });
  }
}

// Abre la ventana del nuevo PTA con el año siguiente como sugerencia
function abrirVentanaNuevoPTA() {
  const inputAnio = document.getElementById('anioNuevo');
  inputAnio.value = Math.max(anioActual, ...aniosExistentes) + 1;   // el siguiente año que todavía no existe
  marcarErrorAnio('');
  document.getElementById('ventanaNuevoPTA').style.display = 'flex';
  inputAnio.focus();
  inputAnio.select();
}

// Muestra (o quita, con texto vacío) el error debajo del campo del año
function marcarErrorAnio(texto) {
  document.getElementById('anioNuevo').classList.toggle('campo-error', texto !== '');
  document.getElementById('errorAnioNuevo').textContent = texto;
}

// Revisa el año escrito y crea el nuevo PTA en el servidor
async function crearNuevoPTA() {
  const anio = Number(document.getElementById('anioNuevo').value);
  if (!Number.isInteger(anio) || anio < 2020 || anio > 2100) {
    marcarErrorAnio('Escribe un año válido (entre 2020 y 2100).');
    return;
  }
  if (aniosExistentes.includes(anio)) {
    marcarErrorAnio(`Ya existe un PTA ${anio}. Escribe otro año.`);
    return;
  }

  const btnCrear = document.getElementById('btnCrearNuevoPTA');
  btnCrear.disabled = true;
  try {
    const datos = await leerRespuesta(await fetch(API_PERIODO + '?accion=crear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anio })
    }));
    document.getElementById('ventanaNuevoPTA').style.display = 'none';
    pintarPeriodo(datos);
    await cargarLista();          // la lista ahora muestra las áreas del nuevo año
    mostrarMensaje(datos.mensaje, 'exito');
  } catch (error) {
    marcarErrorAnio(error.message);
  } finally {
    btnCrear.disabled = false;
  }
}

// Pide el año activo y lo muestra en la barra
async function cargarPeriodo() {
  try {
    pintarPeriodo(await leerRespuesta(await fetch(API_PERIODO)));
  } catch (error) { /* si falla, la barra queda oculta; el aviso lo muestra la carga de la lista */ }
}

// Año del PTA en el encabezado, después de "SEGUIMIENTO DE PLANES DE TRABAJO ANUAL"
function mostrarAnioEncabezado(anio) {
  const span = document.getElementById('anioEncabezado');
  if (span) span.textContent = anio;
}

// datos = {anio, finalizado, fecha_finalizacion, anios: [años que ya existen]}
function pintarPeriodo(datos) {
  anioActual = datos.anio;
  aniosExistentes = datos.anios || [];

  // Botón temporal de los meses: el texto dice lo que hará al presionarlo
  todosLosMeses = !!datos.todos_los_meses;
  document.getElementById('btnTodosLosMeses').textContent = todosLosMeses
    ? 'Solo el mes en curso'
    : 'Habilitar todos los meses';
  document.getElementById('btnTodosLosMeses').hidden = !!datos.finalizado;
  document.getElementById('periodoMeses').textContent = todosLosMeses
    ? 'Seguimientos: todos los meses habilitados'
    : '';
  document.getElementById('periodoActivo').textContent = datos.anio;
  mostrarAnioEncabezado(datos.anio);

  // Botones de evidencias por semestre (todas las áreas): el del semestre que ya se muestra sirve para ocultarlo
  evidenciasTodas = Number(datos.evidencias_todas) || 0;
  document.querySelectorAll('[data-evidencias-todas]').forEach(boton => {
    const periodo = Number(boton.dataset.evidenciasTodas);
    const nombre = periodo === 1 ? '1er' : '2do';
    boton.textContent = (evidenciasTodas === periodo ? 'Ocultar' : 'Mostrar') + ` evidencias ${nombre} semestre`;
    boton.title = evidenciasTodas === periodo
      ? `Todas las áreas ven las evidencias del ${nombre} semestre`
      : `Mostrar Evidencias, Causas y Acuerdos del ${nombre} semestre a todas las áreas`;
  });

  // Con el PTA finalizado ya no hay opciones que mostrar: se esconde "Opciones de área"
  document.getElementById('contenedorOpcionesArea').hidden = !!datos.finalizado;
  if (datos.finalizado) mostrarOpcionesArea(false);

  // Ya finalizado: se avisa y en lugar de "Finalizar PTA" aparece "Nuevo PTA" (mismo lugar)
  const btnFinalizar = document.getElementById('btnFinalizarPTA');
  const btnNuevo = document.getElementById('btnNuevoPTA');
  const estado = document.getElementById('periodoEstado');
  estado.textContent = datos.finalizado
    ? 'Finalizado' + (datos.fecha_finalizacion ? ' el ' + datos.fecha_finalizacion.slice(0, 10) : '')
    : '';
  btnFinalizar.hidden = datos.finalizado;
  btnFinalizar.disabled = false;
  btnNuevo.hidden = !datos.finalizado;
  document.getElementById('barraPeriodo').hidden = false;
}

async function finalizarPTA() {
  const btnFinalizar = document.getElementById('btnFinalizarPTA');
  btnFinalizar.disabled = true;
  try {
    const datos = await leerRespuesta(await fetch(API_PERIODO + '?accion=finalizar', { method: 'POST' }));
    pintarPeriodo(datos);
    mostrarMensaje(datos.mensaje, 'exito');
  } catch (error) {
    mostrarMensaje(error.message, 'error');
    btnFinalizar.disabled = false;
  }
}

// ---------------------------------------------------------------------
// Detalle de un área (detalleArea.html?id=5)
// ---------------------------------------------------------------------

async function cargarDetalle() {
  const id = parseInt(new URLSearchParams(window.location.search).get('id'), 10);
  if (!id) {
    document.getElementById('tituloArea').textContent = 'Área no indicada';
    mostrarMensaje('No se indicó qué área consultar. Regresa a "Ver áreas" y elige una.', 'error');
    return;
  }

  try {
    const resultado = await leerRespuesta(await fetch(`${API_AREAS}?id=${id}`));
    pintarFicha(resultado.unidad);
    mostrarAnioEncabezado(resultado.anio);
    pintarRevision(resultado.plan, id, resultado.finalizado);

    if (!resultado.plan) {
      mostrarMensaje('Esta área todavía no ha capturado su Plan de Trabajo de este año.', 'info');
    }
    mostrarDetalle(resultado);
  } catch (error) {
    document.getElementById('tituloArea').textContent = 'Área no disponible';
    mostrarMensaje(error.message, 'error');
  }
}

// ---------------------------------------------------------------------
// Revisión del PTA en el detalle: Aceptar / Rechazar con motivo
// ---------------------------------------------------------------------

// Texto y color de cada estado de revisión (columna planes_trabajo.estado)
const ESTADOS_REVISION = {
  'ENVIADO': ['En revisión', 'estado-enviado'],
  'APROBADO': ['Aceptado', 'estado-aprobado'],
  'CON OBSERVACIONES': ['Rechazado', 'estado-observaciones']
};

function etiquetaRevision(estado) {
  const [texto, clase] = ESTADOS_REVISION[estado] || ['Sin enviar', 'estado-sin-plan'];
  return `<span class="estado ${clase}">${texto}</span>`;
}

let areaEnRevision = null;   // id de la unidad del detalle abierto
let decisionPendiente = null; // 'aceptar' o 'rechazar'

// Muestra el estado del PTA y, si está en revisión, los botones Aceptar / Rechazar
function pintarRevision(plan, unidadId, finalizado) {
  areaEnRevision = unidadId;
  const barra = document.getElementById('barraRevision');
  if (!barra) return;
  if (!plan) { barra.hidden = true; return; }

  document.getElementById('estadoRevision').innerHTML = etiquetaRevision(plan.estado);

  let detalle = '';
  if (plan.estado === 'CON OBSERVACIONES') detalle = 'Motivo: ' + (plan.observaciones || '—');
  else if (plan.estado === 'ENVIADO') {
    detalle = plan.fecha_envio ? 'Enviado el ' + plan.fecha_envio.slice(0, 10) : '';
    // Si viene de un rechazo, recordar qué se le pidió corregir
    if (plan.observaciones) detalle += '\nCorregido después del rechazo. Motivo anterior: ' + plan.observaciones;
  }

  // La fecha de aceptación ya no va aquí: se ve en los datos del área (botón "…")
  const aceptado = plan.estado === 'APROBADO' && plan.fecha_revision;
  document.getElementById('fichaDatoAceptado').hidden = !aceptado;
  document.getElementById('fichaAceptado').textContent = aceptado ? plan.fecha_revision.slice(0, 10) : '';
  document.getElementById('detalleRevision').textContent = detalle;

  // Solo se acepta o rechaza un PTA en revisión, y mientras el PTA del año no esté finalizado
  document.getElementById('botonesRevision').hidden = plan.estado !== 'ENVIADO' || finalizado;
  if (finalizado) detalle += (detalle ? '\n' : '') + 'El PTA de este año ya fue finalizado por Planeación.';
  // Avances: Planeación solo ve lo que el área subió con "Subir avance"
  // Solo se avisa cuando el área ya subió algún avance: "Avance de noviembre enviado"
  const NOMBRES_MES_AVANCE = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  if (plan.estado === 'APROBADO' && plan.ultimo_mes_subido) {
    detalle += (detalle ? '\n' : '') + `Avance de ${NOMBRES_MES_AVANCE[plan.ultimo_mes_subido - 1]} enviado`;
  }
  document.getElementById('detalleRevision').textContent = detalle;

  // El área ya subió el avance del mes (y quedó bloqueado): Planeación puede habilitarlo otra vez
  const NOMBRES_MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const meses = plan.meses_para_habilitar || [];
  // Botón para habilitar (o quitar) Evidencias, Causas y Acuerdos: solo con el PTA aceptado y sin finalizar
  const btnCierre = document.getElementById('btnHabilitarCierre');
  btnCierre.hidden = plan.estado !== 'APROBADO' || finalizado;
  // cierre_habilitado: 0 = ninguno, 1 = Primer seguimiento, 2 = Segundo seguimiento
  const SEMESTRES = { 1: 'primer semestre', 2: 'segundo semestre' };
  btnCierre.textContent = plan.cierre_habilitado
    ? `Ocultar evidencias (${SEMESTRES[plan.cierre_habilitado]})`
    : 'Mostrar evidencias';
  btnCierre.dataset.habilitado = String(plan.cierre_habilitado || 0);
  // Semestres cuyas evidencias ya se muestran (por fecha o "Habilitar todos los meses"): en la ventana quedan bloqueados
  btnCierre.dataset.visible1 = plan.cierre?.[1]?.visible ? '1' : '0';
  btnCierre.dataset.visible2 = plan.cierre?.[2]?.visible ? '1' : '0';

  // ¿Hay observaciones escritas que el área todavía no ve? (el botón va debajo de la tabla)
  marcarObservacionesPendientes(!!plan.observaciones_pendientes?.[vistaDetalle]);

  const btnPermitir = document.getElementById('btnPermitirAvance');
  // También aparece cuando el área ya subió sus evidencias (Evidencias, Causas y Acuerdos)
  const evidenciasBloqueadas = (plan.cierres_bloqueados || []).length > 0;
  btnPermitir.hidden = meses.length === 0 && !evidenciasBloqueadas;
  btnPermitir.textContent = meses.length === 0
    ? 'Permitir modificar evidencias'
    : meses.length === 1
      ? `Permitir modificar avance de ${NOMBRES_MES[meses[0] - 1]}`
      : 'Permitir modificar avances';

  // El botón "…" solo aparece si hay alguna opción que mostrar (Permitir modificar / Mostrar evidencias)
  const hayOpciones = !document.getElementById('btnPermitirAvance').hidden || !document.getElementById('btnHabilitarCierre').hidden;
  document.getElementById('btnMasRevision').hidden = !hayOpciones;
  if (!hayOpciones) mostrarOpcionesRevision(false);
  barra.hidden = false;
}

// Planeación deja que el área vuelva a modificar el avance que ya subió
async function permitirModificarAvance() {
  const boton = document.getElementById('btnPermitirAvance');
  if (!await confirmar({
    titulo: boton.textContent,
    texto: `¿${boton.textContent}?\n\nEl área podrá corregirlo y tendrá que volver a subirlo.`,
    botonConfirmar: 'Permitir'
  })) return;
  boton.disabled = true;
  try {
    const resultado = await leerRespuesta(await fetch(API_AREAS + '?accion=permitir_avance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: areaEnRevision })
    }));
    pintarRevision(resultado.plan, areaEnRevision, resultado.finalizado);
    mostrarMensaje(resultado.mensaje, 'exito');
  } catch (error) {
    mostrarMensaje(error.message, 'error');
  } finally {
    boton.disabled = false;
  }
}

// Botón "Mostrar evidencias": si no hay ninguno habilitado, pregunta el semestre (ventana);
// si ya hay uno, lo oculta.
function clicBotonCierre() {
  const boton = document.getElementById('btnHabilitarCierre');
  if (boton.dataset.habilitado === '0') {
    // Si las evidencias de un semestre ya se muestran (ej. el primero, porque ya pasó junio),
    // su botón queda bloqueado y en gris
    document.querySelectorAll('#ventanaCierre [data-periodo]').forEach(b => {
      const yaVisible = boton.dataset['visible' + b.dataset.periodo] === '1';
      b.disabled = yaVisible;
      b.title = yaVisible ? 'Las evidencias de este semestre ya se muestran' : '';
    });
    document.getElementById('ventanaCierre').style.display = 'flex';
    return;
  }
  confirmar({
    titulo: 'Ocultar evidencias',
    texto: '¿Ocultar las evidencias?\n\nEl área ya no las verá hasta que las vuelvas a mostrar.',
    botonConfirmar: 'Ocultar',
    peligro: true
  }).then(si => { if (si) cambiarCierreHabilitado(0); });
}

function cerrarVentanaCierre() {
  document.getElementById('ventanaCierre').style.display = 'none';
}

// Planeación muestra Evidencias, Causas y Acuerdos de UN seguimiento (periodo 1 o 2), o los oculta (0)
async function cambiarCierreHabilitado(periodo) {
  cerrarVentanaCierre();
  const boton = document.getElementById('btnHabilitarCierre');
  boton.disabled = true;
  try {
    const resultado = await leerRespuesta(await fetch(API_AREAS + '?accion=cierre', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: areaEnRevision, periodo })
    }));
    pintarRevision(resultado.plan, areaEnRevision, resultado.finalizado);
    mostrarDetalle(resultado);   // vuelve a pintar las tablas (muestra u oculta las columnas)
    mostrarMensaje(resultado.mensaje, 'exito');
  } catch (error) {
    mostrarMensaje(error.message, 'error');
  } finally {
    boton.disabled = false;
  }
}

// Abre la ventana para confirmar. Al rechazar también pide el motivo.
function abrirVentanaRevision(decision) {
  decisionPendiente = decision;
  const motivo = document.getElementById('motivoRechazo');
  const rechazar = decision === 'rechazar';

  document.getElementById('tituloRevision').textContent = rechazar ? 'Rechazar PTA' : 'Aceptar PTA';
  document.getElementById('textoRevision').innerText = rechazar
    ? 'Escribe el motivo del rechazo. El área lo verá en su Inicio para corregir su PTA.'
    : '¿Aceptar este PTA? El área ya no podrá modificarlo y podrá capturar sus avances en los seguimientos.';
  motivo.hidden = !rechazar;
  motivo.value = '';
  motivo.classList.remove('campo-error');
  document.getElementById('btnConfirmarRevision').textContent = rechazar ? 'Confirmar' : 'Aceptar PTA';
  document.getElementById('btnConfirmarRevision').className = 'boton ' + (rechazar ? 'boton-rechazar' : 'boton-confirmar');

  document.getElementById('ventanaRevision').style.display = 'flex';
  if (rechazar) motivo.focus();
}

function cerrarVentanaRevision() {
  document.getElementById('ventanaRevision').style.display = 'none';
}

async function enviarRevision() {
  const motivo = document.getElementById('motivoRechazo');
  if (decisionPendiente === 'rechazar' && !motivo.value.trim()) {
    motivo.classList.add('campo-error');
    motivo.focus();
    return;
  }

  const boton = document.getElementById('btnConfirmarRevision');
  boton.disabled = true;
  try {
    const resultado = await leerRespuesta(await fetch(API_AREAS + '?accion=revisar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: areaEnRevision, decision: decisionPendiente, motivo: motivo.value.trim() })
    }));
    cerrarVentanaRevision();
    pintarRevision(resultado.plan, areaEnRevision, resultado.finalizado);
    mostrarDetalle(resultado);   // al aceptarlo aparecen las pestañas de los seguimientos
    mostrarMensaje(resultado.mensaje, 'exito');
  } catch (error) {
    cerrarVentanaRevision();
    mostrarMensaje(error.message, 'error');
  } finally {
    boton.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const ventana = document.getElementById('ventanaRevision');
  if (!ventana) return; // no estamos en detalleArea.html

  document.getElementById('btnAceptarPTA').addEventListener('click', () => abrirVentanaRevision('aceptar'));
  document.getElementById('btnRechazarPTA').addEventListener('click', () => abrirVentanaRevision('rechazar'));
  document.getElementById('btnPermitirAvance').addEventListener('click', permitirModificarAvance);
  document.getElementById('btnHabilitarCierre').addEventListener('click', clicBotonCierre);
  document.querySelectorAll('#pestanasDetalle .pestana').forEach(b =>
    b.addEventListener('click', () => mostrarVista(b.dataset.vista)));
  // Ventana del semestre: cada botón trae su periodo en data-periodo
  const ventanaCierre = document.getElementById('ventanaCierre');
  ventanaCierre.querySelectorAll('[data-periodo]').forEach(b =>
    b.addEventListener('click', () => cambiarCierreHabilitado(Number(b.dataset.periodo))));
  document.getElementById('btnCerrarCierre').addEventListener('click', cerrarVentanaCierre);
  ventanaCierre.addEventListener('click', (e) => { if (e.target === ventanaCierre) cerrarVentanaCierre(); });
  document.getElementById('btnConfirmarRevision').addEventListener('click', enviarRevision);
  document.getElementById('btnCancelarRevision').addEventListener('click', cerrarVentanaRevision);
  document.getElementById('btnCerrarRevision').addEventListener('click', cerrarVentanaRevision);
  ventana.addEventListener('click', (e) => { if (e.target === ventana) cerrarVentanaRevision(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarVentanaRevision(); });
});

function pintarFicha(unidad) {
  document.getElementById('tituloArea').textContent = unidad.nombre;
  document.title = unidad.nombre + ' - Plan de Trabajo Anual';
  const datos = {
    fichaNombre: unidad.nombre,
    fichaTipo: unidad.tipo,
    fichaResponsable: unidad.responsable,
    fichaCargo: unidad.cargo,
    fichaTelefono: unidad.telefono,
    fichaCorreoInst: unidad.correo_institucional,
    fichaCorreoPers: unidad.correo_personal
  };
  for (const [id, valor] of Object.entries(datos)) {
    document.getElementById(id).textContent = valor || '—';
  }
}

// acciones = [{proyecto, linea, descripcion, con_recursos, unidad_medida,
//              beneficiados, responsables, participantes, observaciones_generales, p[12], r[12]}]
function pintarTablaAnual(acciones, plan) {
  const tbody = document.getElementById('cuerpoDetalle');
  tbody.innerHTML = '';

  if (acciones.length === 0) {
    tbody.innerHTML = '<tr><td colspan="28" class="lista-vacia">Sin acciones programadas.</td></tr>';
    return;
  }

  acciones.forEach((accion, indice) => {
    if (indice > 0) {
      const separador = document.createElement('tr');
      separador.className = 'fila-separador';
      separador.innerHTML = '<td colspan="28"></td>';
      tbody.appendChild(separador);
    }

    const t = calcularTotales(accion.p, accion.r);
    const meses = (valores, desde) => valores.slice(desde, desde + 6).map(v => `<td>${v || ''}</td>`).join('');
    // Realizado: los meses que ya terminaron (o ya subidos) sin nada enviado se muestran como 0
    const mesesR = desde => accion.r.slice(desde, desde + 6)
      .map((v, i) => `<td>${textoRealizado(v, desde + i + 1, plan)}</td>`).join('');
    const recursos = accion.con_recursos ? 'CON RECURSOS ECONÓMICOS' : 'SIN RECURSOS ECONÓMICOS';
    // Beneficiados, Responsable(s), Participantes y Observaciones Generales (abarcan las 2 filas)
    const complementarios = ['beneficiados', 'responsables', 'participantes', 'observaciones_generales']
      .map(campo => `<td rowspan="2" class="celda-texto celda-complementaria">${escaparHtml(accion[campo] || '')}</td>`)
      .join('');

    const filaP = document.createElement('tr');
    filaP.className = 'fila-programado';
    filaP.innerHTML = `
      <td rowspan="2" class="col-proyecto celda-texto">${escaparHtml(accion.proyecto)}</td>
      <!-- La línea de acción es un texto largo: va en una caja con desplazamiento para que la fila no se estire -->
      <td rowspan="2" class="col-linea celda-texto"><div class="texto-desplazable">${escaparHtml(accion.linea)}</div></td>
      <td rowspan="2" class="col-accion-est celda-texto">${escaparHtml(accion.descripcion)}</td>
      <td rowspan="2" class="col-recursos celda-texto">${recursos}</td>
      <td rowspan="2" class="col-unidad celda-texto">${escaparHtml(accion.unidad_medida)}</td>
      <td class="col-var"><span class="etiqueta-programado">Programado</span></td>
      ${meses(accion.p, 0)}
      <td class="celda-subtotal">${t.p1}</td>${celdaCumplimiento(t.p1, t.p1)}
      ${meses(accion.p, 6)}
      <td class="celda-subtotal">${t.p2}</td>${celdaCumplimiento(t.p2, t.p2)}
      <td class="celda-total">${t.pAnual}</td>${celdaCumplimiento(t.pAnual, t.pAnual)}
      ${complementarios}
    `;

    const filaR = document.createElement('tr');
    filaR.className = 'fila-realizado';
    filaR.innerHTML = `
      <td class="col-var"><span class="etiqueta-realizado">Realizado</span></td>
      ${mesesR(0)}
      <td class="celda-realizado">${t.r1}</td>${celdaCumplimiento(t.r1, t.p1)}
      ${mesesR(6)}
      <td class="celda-realizado">${t.r2}</td>${celdaCumplimiento(t.r2, t.p2)}
      <td class="celda-realizado">${t.rAnual}</td>${celdaCumplimiento(t.rAnual, t.pAnual)}
    `;

    tbody.appendChild(filaP);
    tbody.appendChild(filaR);
  });

}

// ---------------------------------------------------------------------
// Pestañas del detalle: Primer seguimiento, Segundo seguimiento y Programación completa
// ---------------------------------------------------------------------

let detalleActual = null;   // la última respuesta del servidor (para cambiar de pestaña sin volver a pedirla)
let vistaDetalle = null;    // '1', '2' o 'anual'

// Pinta el detalle; la primera vez abre la pestaña del semestre en el que va el área
function mostrarDetalle(resultado) {
  detalleActual = resultado;

  // Mientras el PTA no esté aceptado (en revisión o rechazado), Planeación solo ve el PTA:
  // sin pestañas de seguimiento, solo la programación completa
  const soloPTA = !resultado.plan || resultado.plan.estado !== 'APROBADO';
  document.getElementById('pestanasDetalle').hidden = soloPTA;
  if (soloPTA) {
    vistaDetalle = null;   // al aceptarlo, abre en el semestre en curso
    pintarTablaAnual(resultado.acciones, resultado.plan);
    document.getElementById('vistaAnual').hidden = false;
    document.getElementById('vistaSeguimiento').hidden = true;
    return;
  }

  const actual = String(resultado.semestre_actual || 1);
  if (!vistaDetalle) vistaDetalle = actual;   // abre en la pestaña del semestre en curso
  pintarTablaAnual(resultado.acciones, resultado.plan);
  mostrarVista(vistaDetalle);
}

function mostrarVista(vista) {
  vistaDetalle = vista;
  document.querySelectorAll('#pestanasDetalle .pestana').forEach(b => {
    b.classList.toggle('pestana-activa', b.dataset.vista === vista);
  });
  const anual = vista === 'anual';
  document.getElementById('vistaAnual').hidden = !anual;
  document.getElementById('vistaSeguimiento').hidden = anual;
  if (!anual && detalleActual) {
    pintarTablaSeguimiento(detalleActual.acciones, detalleActual.plan, Number(vista));
  }
}

// Tabla de UN seguimiento, como la ve el área: sus 6 meses, Abs / % y, al terminar el semestre,
// Evidencias, Causas, Acuerdos y Observaciones de Planeación
function pintarTablaSeguimiento(acciones, plan, periodo) {
  const tabla = document.getElementById('tablaSeguimiento');
  const desde = periodo === 1 ? 0 : 6;
  const meses = periodo === 1
    ? ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN']
    : ['JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  const conCierre = !!plan?.cierre?.[periodo]?.visible;
  const totalColumnas = 6 + 6 + 2 + (conCierre ? 4 : 0);

  let html = `<thead>
    <tr>
      <th rowspan="2" class="th-texto col-proyecto">Proyecto Estratégico</th>
      <th rowspan="2" class="th-texto col-linea">Línea de Acción</th>
      <th rowspan="2" class="th-texto col-accion-est">Acción Estratégica</th>
      <th rowspan="2" class="th-texto col-recursos">Recursos</th>
      <th rowspan="2" class="th-texto col-unidad">Unidad de Medida</th>
      <th rowspan="2" class="th-texto col-var">Variables</th>
      <th colspan="6" class="th-calendario ${periodo === 2 ? 'th-semestre2' : ''}">${periodo === 1 ? 'Primer Semestre (Ene - Jun)' : 'Segundo Semestre (Jul - Dic)'}</th>
      <th colspan="2" class="th-calendario th-seguimiento">Seguimiento</th>
      ${conCierre ? `
      <!-- Encabezados completos, iguales a los que ve el área en su seguimiento (ocupan las 2 filas del encabezado) -->
      <th rowspan="2" class="th-texto col-cierre">Evidencias de los resultados obtenidos: Fuente de información, donde se encuentran alojados los archivos (minutas, listas de asistencia, fotos, etc.)</th>
      <th rowspan="2" class="th-texto col-cierre">Observaciones: Causas por las que no se logró el cumplimiento del 100% de la meta programada. En caso de lograr el 100% (no escribir nada)</th>
      <th rowspan="2" class="th-texto col-cierre">Acuerdos y compromisos para atender las metas que no se lograron o se lograron parcialmente</th>
      <th rowspan="2" class="th-texto col-cierre">Observaciones por parte de la Coordinación de Planeación</th>` : ''}
    </tr>
    <tr>
      ${meses.map(m => `<th class="th-calendario th-mes">${m}</th>`).join('')}
      <th class="th-calendario th-semestre">Abs</th>
      <th class="th-calendario th-semestre">%</th>
    </tr>
  </thead><tbody>`;

  if (acciones.length === 0) {
    html += `<tr><td colspan="${totalColumnas}" class="lista-vacia">Sin acciones programadas.</td></tr>`;
  }
  acciones.forEach((accion, indice) => {
    if (indice > 0) html += `<tr class="fila-separador"><td colspan="${totalColumnas}"></td></tr>`;
    const p = accion.p.slice(desde, desde + 6);
    const r = accion.r.slice(desde, desde + 6);
    const sumaP = p.reduce((a, b) => a + b, 0);
    const sumaR = r.reduce((a, b) => a + b, 0);
    const celdas = valores => valores.map(v => `<td>${v || ''}</td>`).join('');
    const recursos = accion.con_recursos ? 'CON RECURSOS ECONÓMICOS' : 'SIN RECURSOS ECONÓMICOS';
    html += `<tr class="fila-programado">
      <td rowspan="2" class="col-proyecto celda-texto">${escaparHtml(accion.proyecto)}</td>
      <td rowspan="2" class="col-linea celda-texto"><div class="texto-desplazable">${escaparHtml(accion.linea)}</div></td>
      <td rowspan="2" class="col-accion-est celda-texto">${escaparHtml(accion.descripcion)}</td>
      <td rowspan="2" class="col-recursos celda-texto">${recursos}</td>
      <td rowspan="2" class="col-unidad celda-texto">${escaparHtml(accion.unidad_medida)}</td>
      <td class="col-var"><span class="etiqueta-programado">Programado</span></td>
      ${celdas(p)}
      <td class="celda-subtotal">${sumaP}</td>${celdaCumplimiento(sumaP, sumaP)}
      ${celdasCierre(accion, plan, periodo)}
    </tr>
    <tr class="fila-realizado">
      <td class="col-var"><span class="etiqueta-realizado">Realizado</span></td>
      ${r.map((v, i) => `<td>${textoRealizado(v, desde + i + 1, plan)}</td>`).join('')}
      <td class="celda-realizado">${sumaR}</td>${celdaCumplimiento(sumaR, sumaP)}
    </tr>`;
  });
  html += '</tbody>';

  // Botón "Enviar observaciones" debajo de la columna de Observaciones (si Planeación puede escribir)
  if (plan?.cierre?.[periodo]?.editable && acciones.length > 0) {
    html += `<tfoot class="pie-observaciones"><tr>
      <td colspan="${6 + 6 + 2 + 3}"></td>
      <td><button type="button" class="boton boton-meses" id="btnEnviarObservaciones">Enviar observaciones</button></td>
    </tr></tfoot>`;
  }
  tabla.innerHTML = html;

  const boton = document.getElementById('btnEnviarObservaciones');
  if (boton) {
    boton.addEventListener('click', enviarObservaciones);
    marcarObservacionesPendientes(!!plan?.observaciones_pendientes?.[periodo]);   // del seguimiento que se ve
  }
}

// Texto de un mes de Realizado (mes = 1 a 12). Si el área no envió nada en un mes que ya terminó
// (o que ya subió), se toma como 0; los meses que todavía no terminan se quedan vacíos.
function textoRealizado(valor, mes, plan) {
  if (valor) return valor;
  return (plan?.meses_realizado_cerrados || []).includes(mes) ? 0 : '';
}

// Sumas por semestre y del año
function calcularTotales(p, r) {
  const suma = (lista, desde, hasta) => lista.slice(desde, hasta).reduce((a, b) => a + b, 0);
  return {
    p1: suma(p, 0, 6), p2: suma(p, 6, 12), pAnual: suma(p, 0, 12),
    r1: suma(r, 0, 6), r2: suma(r, 6, 12), rAnual: suma(r, 0, 12)
  };
}

// "66.7%" (o "0%" si no hay nada programado)
function porcentaje(valor, base) {
  return base > 0 ? `${((valor / base) * 100).toFixed(1)}%` : '0%';
}

// Celda de % (programado o realizado) con el mismo color que en los seguimientos
function celdaCumplimiento(realizado, programado) {
  const pct = programado > 0 ? (realizado / programado) * 100 : 0;
  let clase = 'pct-bajo';
  if (pct >= 80) clase = 'pct-bueno';
  else if (pct >= 60) clase = 'pct-regular';
  else if (pct > 40) clase = 'pct-medio';
  return `<td class="${clase}">${porcentaje(realizado, programado)}</td>`;
}

// Botón "…" de la ficha de la unidad: muestra u oculta los datos
document.addEventListener('DOMContentLoaded', () => {
  // Botón "…" de la barra del estado del PTA: muestra u oculta "Permitir modificar avance" y "Mostrar evidencias"
  const btnMasRevision = document.getElementById('btnMasRevision');
  if (btnMasRevision) {
    btnMasRevision.addEventListener('click', () => {
      mostrarOpcionesRevision(document.getElementById('revisionMas').hidden);
    });
  }

  const btnMasDatos = document.getElementById('btnMasDatos');
  const fichaDetalles = document.getElementById('fichaDetalles');
  if (!btnMasDatos || !fichaDetalles) return;

  btnMasDatos.addEventListener('click', () => {
    const abrir = fichaDetalles.hidden;
    fichaDetalles.hidden = !abrir;
    btnMasDatos.setAttribute('aria-expanded', String(abrir));
    btnMasDatos.title = abrir ? 'Ocultar datos' : 'Mostrar más datos';
  });
});

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------

// Etiqueta del PTA final: "—" si no hay plan, "EN PROCESO" mientras no se envía
function etiquetaFinal(estadoPlan, estadoFinal, id) {
  if (!estadoPlan) return etiquetaEstado(null, '—', id);
  if (estadoFinal !== 'ENVIADO') {
    const atributoId = id ? ` id="${id}"` : '';
    return `<span class="estado estado-borrador"${atributoId}>EN PROCESO</span>`;
  }
  return etiquetaEstado(estadoFinal, '—', id);
}

// Etiqueta de color para un estado; si es null muestra el texto de "todavía no existe"
function etiquetaEstado(estado, textoVacio, id) {
  const clase = estado ? (ESTADOS[estado] || 'estado-borrador') : 'estado-sin-plan';
  const atributoId = id ? ` id="${id}"` : '';
  return `<span class="estado ${clase}"${atributoId}>${escaparHtml(estado || textoVacio)}</span>`;
}

// Muestra un aviso arriba del contenido. tipo: 'error' (rojo), 'info' (azul) o 'exito' (verde)
function mostrarMensaje(texto, tipo) {
  const caja = document.getElementById('cajaAvisos');
  if (!caja) return;
  const estilos = {
    error: ['', 'caja-aviso'],
    info: ['', 'caja-aviso aviso-info'],
    exito: ['', 'caja-aviso aviso-exito']
  };
  const [icono, clase] = estilos[tipo] || estilos.info;
  caja.innerText = icono + texto;
  caja.className = clase;
  caja.style.display = 'block';
  caja.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Evita que un texto escrito por el usuario se interprete como HTML
function escaparHtml(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Texto seguro para la página en el que los enlaces (http://, https:// o www.) se pueden abrir con un clic.
// Se abren en otra pestaña para no perder la página en la que se está.
const PATRON_ENLACE = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;
function textoConEnlaces(texto) {
  return String(texto ?? '').split(PATRON_ENLACE).map((parte, i) => {
    if (i % 2 === 0) return escaparHtml(parte);            // texto normal
    const limpio = parte.replace(/[.,;:)\]]+$/, '');        // sin el punto o paréntesis final de la oración
    const resto = parte.slice(limpio.length);
    const destino = /^https?:\/\//i.test(limpio) ? limpio : 'https://' + limpio;
    return `<a href="${escaparHtml(destino)}" target="_blank" rel="noopener noreferrer" class="enlace-evidencia">${escaparHtml(limpio)}</a>${escaparHtml(resto)}`;
  }).join('');
}

// Minúsculas y sin acentos, para que "atencion" encuentre "ATENCIÓN"
function normalizar(texto) {
  return String(texto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

// Abre y cierra el menú lateral de navegación (botón de tres líneas)
document.addEventListener('DOMContentLoaded', () => {
  const botonMenu = document.getElementById('botonMenu');
  const menuFondo = document.getElementById('menuFondo');

  function cerrarMenu() {
    document.body.classList.remove('menu-abierto');
    if (botonMenu) botonMenu.setAttribute('aria-expanded', 'false');
  }

  function abrirMenu() {
    document.body.classList.add('menu-abierto');
    if (botonMenu) botonMenu.setAttribute('aria-expanded', 'true');
  }

  if (botonMenu) {
    botonMenu.addEventListener('click', () => {
      if (document.body.classList.contains('menu-abierto')) {
        cerrarMenu();
      } else {
        abrirMenu();
      }
    });
  }

  if (menuFondo) {
    menuFondo.addEventListener('click', cerrarMenu);
  }

  // Si ya estás en esa página, el enlace activo no debe recargarla
  const enlaceActivo = document.querySelector('.menu-enlace.menu-enlace-activo');
  if (enlaceActivo) {
    enlaceActivo.addEventListener('click', (e) => {
      e.preventDefault();
      cerrarMenu();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cerrarMenu();
  });
});

// ---------------------------------------------------------------------
// Cierre de los seguimientos en el detalle (Planeación)
// ---------------------------------------------------------------------

// Las 4 celdas de cierre de una acción en un seguimiento (abarcan las 2 filas).
// Evidencias, Causas y Acuerdos los escribe el área; las Observaciones las escribe Planeación aquí.
function celdasCierre(accion, plan, periodo) {
  const estado = plan?.cierre?.[periodo];
  if (!estado?.visible) return '';   // al área todavía no se le muestran: aquí tampoco
  const datos = accion.cierre?.[periodo];
  if (!estado.subido || !datos) {
    return `<td rowspan="2" colspan="4" class="celda-texto col-cierre cierre-${periodo} cierre-sin-subir">El área todavía no sube este seguimiento.</td>`;
  }
  // Los enlaces que escribió el área (Drive, OneDrive, etc.) se pueden abrir con un clic
  const texto = valor => `<td rowspan="2" class="celda-texto celda-complementaria col-cierre cierre-${periodo}">${textoConEnlaces(valor)}</td>`;
  const observacion = estado.editable
    ? `<textarea class="campo-observacion" data-periodo="${periodo}" data-accion="${accion.id}" maxlength="2000"
         placeholder="Escribe tus observaciones">${escaparHtml(datos.observaciones_planeacion || '')}</textarea>`
    : textoConEnlaces(datos.observaciones_planeacion);
  return texto(datos.evidencias) + texto(datos.causas) + texto(datos.acuerdos) +
    `<td rowspan="2" class="celda-texto celda-complementaria col-cierre cierre-${periodo}">${observacion}</td>`;
}

// Guarda la observación de Planeación como BORRADOR al salir del cuadro de texto (si cambió).
// El área no la ve hasta que Planeación presiona "Enviar observaciones".
let guardandoObservacion = Promise.resolve();
document.addEventListener('change', (e) => {
  const campo = e.target;
  if (!campo.matches('textarea.campo-observacion')) return;
  guardandoObservacion = guardarObservacion(campo);
});

async function guardarObservacion(campo) {
  campo.classList.remove('observacion-guardada', 'campo-error');
  try {
    await leerRespuesta(await fetch(API_AREAS + '?accion=observacion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: areaEnRevision,
        periodo: Number(campo.dataset.periodo),
        accion_id: Number(campo.dataset.accion),
        texto: campo.value
      })
    }));
    campo.classList.add('observacion-guardada');   // borde verde: borrador guardado
    marcarObservacionesPendientes(true);            // hay algo nuevo que enviar
  } catch (error) {
    campo.classList.add('campo-error');
    mostrarMensaje(error.message, 'error');
  }
}

// Botón "Enviar observaciones": activo si hay algo nuevo que enviar; si no, gris y bloqueado
let observacionesPendientes = false;
function marcarObservacionesPendientes(pendientes) {
  observacionesPendientes = pendientes;
  const boton = document.getElementById('btnEnviarObservaciones');
  if (!boton) return;
  boton.disabled = !pendientes;
  boton.textContent = pendientes ? 'Enviar observaciones' : 'Observaciones enviadas';
}

// Envía al área las observaciones escritas (primero termina de guardar la última que se escribió)
async function enviarObservaciones() {
  const boton = document.getElementById('btnEnviarObservaciones');
  boton.disabled = true;
  await guardandoObservacion;
  if (!await confirmar({
    titulo: 'Enviar observaciones',
    texto: '¿Enviar tus observaciones al área?\n\nEl área las verá en su seguimiento. Solo se envían una vez: después ya no se podrán modificar.',
    botonConfirmar: 'Enviar',
    peligro: true
  })) {
    boton.disabled = false;
    return;
  }
  try {
    const resultado = await leerRespuesta(await fetch(API_AREAS + '?accion=enviar_observaciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: areaEnRevision, periodo: Number(vistaDetalle) })   // el seguimiento que se está viendo
    }));
    pintarRevision(resultado.plan, areaEnRevision, resultado.finalizado);
    mostrarDetalle(resultado);
    mostrarMensaje(resultado.mensaje, 'exito');
  } catch (error) {
    mostrarMensaje(error.message, 'error');
    boton.disabled = false;
  }
}

// Abre (true) o cierra (false) las opciones de Planeación que esconde el botón "…" de la barra del estado
function mostrarOpcionesRevision(abrir) {
  const opciones = document.getElementById('revisionMas');
  const boton = document.getElementById('btnMasRevision');
  if (!opciones || !boton) return;
  opciones.hidden = !abrir;
  boton.setAttribute('aria-expanded', String(abrir));
  boton.title = abrir ? 'Ocultar opciones' : 'Mostrar más opciones';
}

// ---------------------------------------------------------------------
// Ventana de confirmación del proyecto (en lugar del confirm() del navegador, que dice "localhost dice…").
// Uso:  if (await confirmar({ titulo, texto, botonConfirmar, peligro })) { ... }
//   titulo         → encabezado de la ventana
//   texto          → mensaje (los \n hacen salto de línea)
//   botonConfirmar → texto del botón de confirmar (por defecto "Aceptar")
//   peligro        → true: el botón de confirmar va en rojo (acciones delicadas)
// Regresa una promesa: true si se confirma; false con Cancelar, la ✕, Esc o un clic afuera.
// La ventana se crea sola la primera vez y usa los mismos estilos que las demás ventanas de la página.
// ---------------------------------------------------------------------
function confirmar({ titulo = 'Confirmar', texto = '', botonConfirmar = 'Aceptar', peligro = false } = {}) {
  let ventana = document.getElementById('ventanaConfirmarGeneral');
  if (!ventana) {
    ventana = document.createElement('div');
    ventana.className = 'ventana-fondo';
    ventana.id = 'ventanaConfirmarGeneral';
    ventana.innerHTML = `
      <div class="ventana-contenido ventana-confirmar-contenido" role="dialog" aria-modal="true" aria-labelledby="tituloConfirmarGeneral">
        <div class="ventana-encabezado ventana-confirmar-encabezado">
          <h3 id="tituloConfirmarGeneral"></h3>
          <button type="button" class="boton-cerrar-ventana" data-respuesta="no" aria-label="Cerrar">✕</button>
        </div>
        <div class="ventana-cuerpo ventana-confirmar-cuerpo">
          <p class="ventana-texto" id="textoConfirmarGeneral"></p>
        </div>
        <div class="ventana-pie ventana-confirmar-pie">
          <button type="button" class="boton boton-cancelar" data-respuesta="no">Cancelar</button>
          <button type="button" class="boton boton-confirmar" id="btnConfirmarGeneral" data-respuesta="si"></button>
        </div>
      </div>`;
    document.body.appendChild(ventana);
  }

  document.getElementById('tituloConfirmarGeneral').textContent = titulo;
  document.getElementById('textoConfirmarGeneral').innerText = texto;
  const botonSi = document.getElementById('btnConfirmarGeneral');
  botonSi.textContent = botonConfirmar;
  botonSi.className = 'boton ' + (peligro ? 'boton-peligro' : 'boton-confirmar');
  ventana.style.display = 'flex';
  botonSi.focus();

  return new Promise(resolver => {
    const terminar = (respuesta) => {
      ventana.style.display = 'none';
      ventana.removeEventListener('click', alHacerClic);
      document.removeEventListener('keydown', alPresionarTecla, true);
      resolver(respuesta);
    };
    // Botones con data-respuesta, o clic en el fondo oscuro (afuera de la ventana) = cancelar
    const alHacerClic = (e) => {
      if (e.target === ventana) return terminar(false);
      const boton = e.target.closest('[data-respuesta]');
      if (boton) terminar(boton.dataset.respuesta === 'si');
    };
    const alPresionarTecla = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); terminar(false); }
    };
    ventana.addEventListener('click', alHacerClic);
    document.addEventListener('keydown', alPresionarTecla, true);
  });
}
