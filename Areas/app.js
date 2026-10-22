// "Ver áreas" de Planeación: lo usan la lista de áreas (areas.html) y el detalle de un área (detalleArea.html).
// Todo es de solo lectura: Planeación consulta los planes de las demás áreas, pero no los modifica ni los revisa.
const API_AREAS = '../php/areas.php';
const API_USUARIO = '../php/usuario.php';
const PAGINA_LOGIN = '../InicioSesion/inicioSesion.html';

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

// ---------------------------------------------------------------------
// Comunicación con el servidor
// ---------------------------------------------------------------------

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
      <td>${etiquetaEstado(area.estado_plan, 'SIN PLAN')}</td>
      <td>${etiquetaFinal(area.estado_plan, area.estado_final)}</td>
      <td><a href="../Areas/detalleArea.html?id=${area.id}" class="boton-ver">Ver</a></td>
    `;
    tbody.appendChild(fila);
  });

  const listaVacia = document.getElementById('listaVacia');
  if (areas.length === 0) {
    listaVacia.textContent = 'Todavía no hay otras áreas registradas.';
    listaVacia.style.display = 'block';
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
  const filtroTipo = document.getElementById('filtroTipo');
  const filtroEstado = document.getElementById('filtroEstado');
  if (!buscar || !filtroTipo || !filtroEstado) return;

  [buscar, filtroTipo, filtroEstado].forEach(control => {
    control.addEventListener('input', filtrarAreas);
    control.addEventListener('change', filtrarAreas);
  });
});

// Columnas de la tabla: 0 área, 1 tipo, 2 responsable, 3 estado del plan
function filtrarAreas() {
  const texto = normalizar(document.getElementById('buscarArea').value);
  const tipo = document.getElementById('filtroTipo').value;
  const estado = document.getElementById('filtroEstado').value;
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

    if (!resultado.plan) {
      mostrarMensaje('Esta área todavía no ha capturado su Plan de Trabajo de este año.', 'info');
    }
    pintarTablaAnual(resultado.acciones);
  } catch (error) {
    document.getElementById('tituloArea').textContent = 'Área no disponible';
    mostrarMensaje(error.message, 'error');
  }
}

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

// acciones = [{proyecto, linea, descripcion, con_recursos, unidad_medida, p[12], r[12]}]
function pintarTablaAnual(acciones) {
  const tbody = document.getElementById('cuerpoDetalle');
  tbody.innerHTML = '';

  if (acciones.length === 0) {
    tbody.innerHTML = '<tr><td colspan="24" class="lista-vacia">Sin acciones programadas.</td></tr>';
    return;
  }

  acciones.forEach((accion, indice) => {
    if (indice > 0) {
      const separador = document.createElement('tr');
      separador.className = 'fila-separador';
      separador.innerHTML = '<td colspan="24"></td>';
      tbody.appendChild(separador);
    }

    const t = calcularTotales(accion.p, accion.r);
    const meses = (valores, desde) => valores.slice(desde, desde + 6).map(v => `<td>${v || ''}</td>`).join('');
    const recursos = accion.con_recursos ? 'CON RECURSOS ECONÓMICOS' : 'SIN RECURSOS ECONÓMICOS';

    const filaP = document.createElement('tr');
    filaP.className = 'fila-programado';
    filaP.innerHTML = `
      <td rowspan="2" class="col-proyecto celda-texto">${escaparHtml(accion.proyecto)}</td>
      <td rowspan="2" class="col-linea celda-texto">${escaparHtml(accion.linea)}</td>
      <td rowspan="2" class="col-accion-est celda-texto">${escaparHtml(accion.descripcion)}</td>
      <td rowspan="2" class="col-recursos celda-texto">${recursos}</td>
      <td rowspan="2" class="col-unidad celda-texto">${escaparHtml(accion.unidad_medida)}</td>
      <td class="col-var"><span class="etiqueta-programado">Programado</span></td>
      ${meses(accion.p, 0)}
      <td class="celda-subtotal">${t.p1}</td>${celdaCumplimiento(t.p1, t.p1)}
      ${meses(accion.p, 6)}
      <td class="celda-subtotal">${t.p2}</td>${celdaCumplimiento(t.p2, t.p2)}
      <td class="celda-total">${t.pAnual}</td>${celdaCumplimiento(t.pAnual, t.pAnual)}
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
