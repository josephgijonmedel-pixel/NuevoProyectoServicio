
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
    fila.innerHTML = `
      <td class="celda-texto">${escaparHtml(area.nombre)}</td>
      <td>${escaparHtml(area.tipo || '—')}</td>
      <td class="celda-texto">${escaparHtml(area.responsable || '—')}</td>
      <td class="oculto">${etiquetaEstado(area.estado_plan, 'SIN PLAN')}</td>
      <td class="oculto">${etiquetaFinal(area.estado_plan, area.estado_final)}</td>
      <td>${etiquetaRevision(area.estado_plan)}</td>
      <td><a href="../Areas/detalleArea.html?id=${area.id}" class="boton-ver">Ver</a></td>
    `;
    tbody.appendChild(fila);
  });

  const listaVacia = document.getElementById('listaVacia');
  if (areas.length === 0) {
    listaVacia.textContent = 'Ninguna área ha guardado todavía su PTA de este año.';
    listaVacia.style.display = 'block';
  } else {
    listaVacia.style.display = 'none';
  }
}

// Tarjetas de arriba: cuántas áreas hay en cada estado
function pintarResumen(areas) {
  document.getElementById('totalAreas').textContent = areas.length;
  document.getElementById('totalSinEnviar').textContent = areas.filter(a => a.estado_plan !== 'ENVIADO').length;
  document.getElementById('totalProgramacion').textContent = areas.filter(a => a.estado_plan === 'ENVIADO').length;
  document.getElementById('totalFinal').textContent = areas.filter(a => a.estado_final === 'ENVIADO').length;
}

// Búsqueda y filtros de la lista (solo existen en areas.html)
document.addEventListener('DOMContentLoaded', () => {
  const buscar = document.getElementById('buscarArea');
  if (!buscar) return; // no estamos en areas.html

  // Los filtros son opcionales: se conecta solo el que exista en la página
  const controles = [buscar, document.getElementById('filtroTipo'), document.getElementById('filtroEstado')];
  controles.filter(Boolean).forEach(control => {
    control.addEventListener('input', filtrarAreas);
    control.addEventListener('change', filtrarAreas);
  });
});

// Columnas de la tabla: 0 área, 1 tipo, 2 responsable, 3 estado del plan
function filtrarAreas() {
  const texto = normalizar(document.getElementById('buscarArea').value);
  const tipo = document.getElementById('filtroTipo')?.value || '';
  const estado = document.getElementById('filtroEstado')?.value || '';
  const filas = Array.from(document.querySelectorAll('#cuerpoAreas tr'));

  let visibles = 0;
  filas.forEach(fila => {
    const celdas = fila.cells;
    const coincideTexto = !texto
      || normalizar(celdas[0].innerText).includes(texto)
      || normalizar(celdas[2].innerText).includes(texto);
    const coincideTipo = !tipo || celdas[1].innerText.trim() === tipo;
    const coincideEstado = !estado || celdas[3].innerText.trim() === estado;

    const mostrar = coincideTexto && coincideTipo && coincideEstado;
    fila.style.display = mostrar ? '' : 'none';
    if (mostrar) visibles++;
  });

  const listaVacia = document.getElementById('listaVacia');
  listaVacia.textContent = 'No hay áreas que coincidan con la búsqueda.';
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
    pintarTablaAnual(resultado.acciones);
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
  else if (plan.estado === 'APROBADO' && plan.fecha_revision) detalle = 'Aceptado el ' + plan.fecha_revision.slice(0, 10);
  document.getElementById('detalleRevision').textContent = detalle;

  // Solo se acepta o rechaza un PTA en revisión, y mientras el PTA del año no esté finalizado
  document.getElementById('botonesRevision').hidden = plan.estado !== 'ENVIADO' || finalizado;
  if (finalizado) detalle += (detalle ? '\n' : '') + 'El PTA de este año ya fue finalizado por Planeación.';
  document.getElementById('detalleRevision').textContent = detalle;
  barra.hidden = false;
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
  document.getElementById('btnConfirmarRevision').textContent = rechazar ? 'Rechazar PTA' : 'Aceptar PTA';
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
    pintarRevision(resultado.plan, areaEnRevision);
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
function pintarTablaAnual(acciones) {
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
      ${meses(accion.r, 0)}
      <td class="celda-realizado">${t.r1}</td>${celdaCumplimiento(t.r1, t.p1)}
      ${meses(accion.r, 6)}
      <td class="celda-realizado">${t.r2}</td>${celdaCumplimiento(t.r2, t.p2)}
      <td class="celda-realizado">${t.rAnual}</td>${celdaCumplimiento(t.rAnual, t.pAnual)}
    `;

    tbody.appendChild(filaP);
    tbody.appendChild(filaR);
  });
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
    error: ['⚠️ ', 'caja-aviso'],
    info: ['ℹ️ ', 'caja-aviso aviso-info'],
    exito: ['✔ ', 'caja-aviso aviso-exito']
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
