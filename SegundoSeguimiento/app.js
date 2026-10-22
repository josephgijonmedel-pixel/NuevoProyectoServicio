// Archivo PHP que lee (GET) y guarda (POST) el seguimiento. periodo=2 → julio a diciembre
const API_SEGUIMIENTO = '../php/seguimiento.php?periodo=2';
const PAGINA_LOGIN = '../InicioSesion/inicioSesion.html';
const PAGINA_PROGRAMACION = '../Programacion/programacion.html';

document.addEventListener('DOMContentLoaded', () => {
  cargarSeguimiento();

  // Evento para guardar el formulario con confirmación
  const formSeg2 = document.getElementById('formSeguimiento2');
  const modalConfirmar = document.getElementById('ventanaConfirmar');
  const btnConfirmarSi = document.getElementById('btnConfirmarSi');
  const btnConfirmarNo = document.getElementById('btnConfirmarNo');
  const btnCerrarVentana = document.getElementById('btnCerrarVentana');

  if (formSeg2) {
    formSeg2.addEventListener('submit', (e) => {
      e.preventDefault();
      abrirModalConfirmacion();
    });
  }

  if (btnConfirmarNo) {
    btnConfirmarNo.addEventListener('click', cerrarModalConfirmacion);
  }

  if (btnCerrarVentana) {
    btnCerrarVentana.addEventListener('click', cerrarModalConfirmacion);
  }

  if (btnConfirmarSi) {
    btnConfirmarSi.addEventListener('click', () => {
      cerrarModalConfirmacion();
      guardarSeguimiento();
    });
  }

  // Cerrar al hacer clic en el fondo fuera del modal
  if (modalConfirmar) {
    modalConfirmar.addEventListener('click', (e) => {
      if (e.target === modalConfirmar) {
        cerrarModalConfirmacion();
      }
    });
  }

  // Cerrar modal con tecla Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      cerrarModalConfirmacion();
    }
  });
});

// FUNCIONES DEL MODAL DE CONFIRMACIÓN
function abrirModalConfirmacion() {
  const modal = document.getElementById('ventanaConfirmar');
  const titulo = document.getElementById('ventanaTitulo');
  const icono = document.getElementById('ventanaIcono');
  const texto = document.getElementById('ventanaTexto');

  if (titulo) titulo.innerText = 'Confirmación';
  if (icono) icono.innerText = '⚠️';
  if (texto) texto.innerText = '¿Estás seguro que desea guardar?';

  if (modal) modal.style.display = 'flex';
}

function cerrarModalConfirmacion() {
  const modal = document.getElementById('ventanaConfirmar');
  if (modal) modal.style.display = 'none';
}

// ---------------------------------------------------------------------
// Comunicación con el servidor
// ---------------------------------------------------------------------

// Pide al servidor las acciones del plan con lo programado y lo realizado de julio a diciembre
async function cargarSeguimiento() {
  try {
    const resultado = await leerRespuesta(await fetch(API_SEGUIMIENTO));

    mostrarNombreUnidad(resultado.unidad.nombre);
    const encabezado = document.getElementById('encabezadoSemestre');
    if (encabezado) encabezado.innerText = `SEGUNDO SEMESTRE (${resultado.anio})`;

    if (!resultado.hayPlan || resultado.acciones.length === 0) {
      mostrarAvisoSinProgramacion();
      return;
    }

    pintarTabla(resultado.acciones);
    mostrarEstadoSeguimiento(resultado.seguimiento);
  } catch (error) {
    mostrarMensaje(error.message, 'error');
  }
}

// Envía lo realizado de cada acción al servidor. Es la última hoja: se queda en la página.
async function guardarSeguimiento() {
  const btnGuardar = document.getElementById('btnGuardarSeguimiento');
  btnGuardar.disabled = true;

  try {
    const resultado = await leerRespuesta(await fetch(API_SEGUIMIENTO, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acciones: recolectarRealizado() })
    }));

    pintarTabla(resultado.acciones);
    mostrarMensaje(resultado.mensaje, 'exito');
  } catch (error) {
    marcarErrores(error.errores);
    mostrarMensaje(error.message, 'error', error.errores);
  } finally {
    btnGuardar.disabled = false;
  }
}

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

  if (!respuesta.ok) {
    const error = new Error(resultado.error || 'Ocurrió un error.');
    error.errores = resultado.errores;
    throw error;
  }
  return resultado;
}

// Junta lo realizado de cada acción: [{id, r: [6 meses]}]
function recolectarRealizado() {
  return filasDeAcciones().map(trP => ({
    id: trP.dataset.accionId,
    r: Array.from(document.querySelectorAll(`.seg2-r-${trP.dataset.fila}`)).map(inp => parseInt(inp.value, 10) || 0)
  }));
}

// ---------------------------------------------------------------------
// Estado de la página
// ---------------------------------------------------------------------

function mostrarNombreUnidad(nombre) {
  const inputUR = document.getElementById('unidadResponsable');
  const menuNombreUnidad = document.getElementById('menuNombreUnidad');
  if (inputUR) inputUR.value = nombre;
  if (menuNombreUnidad) menuNombreUnidad.textContent = nombre;
}

function mostrarAvisoSinProgramacion() {
  const cajaAvisos = document.getElementById('cajaAvisos');
  cajaAvisos.innerHTML = `ℹ️ Todavía no hay acciones programadas. Primero captura y guarda tu <a href="${PAGINA_PROGRAMACION}">Programación</a>.`;
  cajaAvisos.className = 'caja-aviso aviso-info';
  cajaAvisos.style.display = 'block';
}

// Habilita el botón, o bloquea la tabla si el seguimiento ya se envió a Planeación
function mostrarEstadoSeguimiento(seguimiento) {
  const btnGuardar = document.getElementById('btnGuardarSeguimiento');

  if (!seguimiento.editable) {
    document.querySelectorAll('#cuerpoSeguimiento2 input').forEach(input => {
      input.readOnly = true;
      input.classList.add('campo-bloqueado');
    });
    btnGuardar.style.display = 'none';
    mostrarMensaje(`El seguimiento está en estado "${seguimiento.estado}" y ya no se puede modificar.`, 'info');
    return;
  }

  btnGuardar.disabled = false;
}

// Muestra un aviso arriba de la tabla. tipo: 'error' (rojo), 'info' (azul) o 'exito' (verde)
function mostrarMensaje(texto, tipo, errores) {
  const cajaAvisos = document.getElementById('cajaAvisos');
  if (!cajaAvisos) return;

  const estilos = {
    error: ['⚠️ ', 'caja-aviso'],
    info: ['ℹ️ ', 'caja-aviso aviso-info'],
    exito: ['✔ ', 'caja-aviso aviso-exito']
  };
  const [icono, clase] = estilos[tipo] || estilos.info;

  let contenido = icono + texto;
  if (errores) {
    errores.forEach(e => { contenido += '\n• ' + e.mensaje; });
  }

  cajaAvisos.innerText = contenido;
  cajaAvisos.className = clase;
  cajaAvisos.style.display = 'block';
  cajaAvisos.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Marca en rojo lo realizado de las acciones que el servidor rechazó (errores = [{fila, mensaje}])
function marcarErrores(errores) {
  document.querySelectorAll('#cuerpoSeguimiento2 .campo-error').forEach(el => el.classList.remove('campo-error'));
  if (!errores) return;
  const filas = filasDeAcciones();
  errores.forEach(({ fila }) => {
    const trP = filas[fila - 1];
    if (trP) {
      document.querySelectorAll(`.seg2-r-${trP.dataset.fila}`).forEach(input => input.classList.add('campo-error'));
    }
  });
}

function filasDeAcciones() {
  return Array.from(document.querySelectorAll('#cuerpoSeguimiento2 tr.fila-programado'));
}

// ---------------------------------------------------------------------
// Construcción de la tabla
// ---------------------------------------------------------------------

// FUNCIONES AUXILIARES DE VALIDACIÓN (solo números enteros)
function soloEnteros(event) {
  const charCode = event.which ? event.which : event.keyCode;
  if (charCode < 48 || charCode > 57) {
    event.preventDefault();
    return false;
  }
  return true;
}

function validarPegadoEnteros(event) {
  const clipboardData = event.clipboardData || window.clipboardData;
  const pastedData = clipboardData.getData('Text');
  if (!/^\d+$/.test(pastedData)) {
    event.preventDefault();
    return false;
  }
}

// Evita que un texto escrito por el usuario se interprete como HTML
function escaparHtml(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// acciones viene del servidor: [{id, proyecto, linea, descripcion, con_recursos, unidad_medida, p[6], r[6]}]
function pintarTabla(acciones) {
  const tbody = document.getElementById('cuerpoSeguimiento2');
  if (!tbody) return;
  tbody.innerHTML = '';

  acciones.forEach((item, index) => {
    const id = index + 1;
    const txtRecursos = item.con_recursos ? 'CON RECURSOS ECONÓMICOS' : 'SIN RECURSOS ECONÓMICOS';

    const trP = document.createElement('tr');
    trP.className = 'fila-programado';
    trP.id = `seg2-fila-${id}-p`;
    trP.dataset.fila = id;
    trP.dataset.accionId = item.id;

    trP.innerHTML = `
      <td rowspan="2" class="col-proyecto celda-texto">${escaparHtml(item.proyecto)}</td>
      <td rowspan="2" class="col-linea celda-texto">${escaparHtml(item.linea)}</td>
      <td rowspan="2" class="col-accion-est celda-texto">${escaparHtml(item.descripcion)}</td>
      <td rowspan="2" class="col-recursos celda-texto">${txtRecursos}</td>
      <td rowspan="2" class="col-unidad celda-texto">${escaparHtml(item.unidad_medida)}</td>
      <td class="col-var"><span class="etiqueta-programado">Programado</span></td>

      <!-- Meses 2do Semestre P (LECTURA Y PLACEHOLDER 0) -->
      ${item.p.map((val) => `
        <td>
          <input type="number" class="campo-mes campo-bloqueado seg2-p-${id}" value="${val !== 0 ? val : ''}" placeholder="0" readonly title="Definido en Programación">
        </td>
      `).join('')}

      <!-- Seguimiento: Abs y % de Programado -->
      <td class="celda-subtotal" id="seg2-absP-${id}">0</td>
      <td class="celda-subtotal" id="seg2-pctP-${id}">0%</td>
    `;

    const trR = document.createElement('tr');
    trR.className = 'fila-realizado';
    trR.id = `seg2-fila-${id}-r`;

    trR.innerHTML = `
      <td class="col-var"><span class="etiqueta-realizado">Realizado</span></td>

      <!-- Meses 2do Semestre R (EDITABLE CON PLACEHOLDER 0) -->
      ${item.r.map((val) => `
        <td>
          <input type="number" min="0" step="1" class="campo-mes seg2-r-${id}" value="${val !== 0 ? val : ''}" placeholder="0" onkeypress="return soloEnteros(event)" onpaste="return validarPegadoEnteros(event)" oninput="calcularTotalesSeguimiento2(${id})">
        </td>
      `).join('')}

      <!-- Seguimiento: Abs y % de Realizado -->
      <td class="celda-realizado" id="seg2-absR-${id}">0</td>
      <td id="seg2-pctR-${id}">0%</td>
    `;

    if (index > 0) {
      const trEspaciador = document.createElement('tr');
      trEspaciador.className = 'fila-separador';
      trEspaciador.innerHTML = `<td colspan="14"></td>`;
      tbody.appendChild(trEspaciador);
    }

    tbody.appendChild(trP);
    tbody.appendChild(trR);

    calcularTotalesSeguimiento2(id);
  });
}

function calcularTotalesSeguimiento2(id) {
  const pInputs = Array.from(document.querySelectorAll(`.seg2-p-${id}`));
  const rInputs = Array.from(document.querySelectorAll(`.seg2-r-${id}`));

  let subP = pInputs.reduce((sum, inp) => sum + (parseInt(inp.value, 10) || 0), 0);
  let subR = rInputs.reduce((sum, inp) => sum + (parseInt(inp.value, 10) || 0), 0);

  // % de Programado = Abs P * 100 / Abs P (siempre 100 si hay datos capturados)
  let pctP = subP > 0 ? ((subP / subP) * 100).toFixed(1) : 0;
  // % de Realizado = Abs R * 100 / Abs P (porcentaje real de cumplimiento)
  let pctR = subP > 0 ? ((subR / subP) * 100).toFixed(1) : 0;

  const cellAbsP = document.getElementById(`seg2-absP-${id}`);
  const cellPctP = document.getElementById(`seg2-pctP-${id}`);
  const cellAbsR = document.getElementById(`seg2-absR-${id}`);
  const cellPctR = document.getElementById(`seg2-pctR-${id}`);

  if (cellAbsP) cellAbsP.innerText = subP;
  if (cellAbsR) cellAbsR.innerText = subR;
  if (cellPctP) cellPctP.innerText = `${pctP}%`;

  if (cellPctR) {
    cellPctR.innerText = `${pctR}%`;
    cellPctR.className = '';

    if (pctR >= 80) {
      cellPctR.classList.add('pct-bueno');
    } else if (pctR >= 60) {
      cellPctR.classList.add('pct-regular');
    } else if (pctR > 40) {
      cellPctR.classList.add('pct-medio');
    } else {
      cellPctR.classList.add('pct-bajo');
    }
  }
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
