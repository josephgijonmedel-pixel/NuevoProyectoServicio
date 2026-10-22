// Archivo PHP que lee (GET) y guarda (POST) la programación en la base de datos
const API_PROGRAMACION = '../php/programacion.php';
const PAGINA_LOGIN = '../InicioSesion/inicioSesion.html';
const PAGINA_SEGUIMIENTO = '../Seguimiento/seguimiento.html';

// Listas de opciones (proyectos, líneas de acción, unidades de medida); llegan del servidor
let catalogos = { proyectos: [], lineas: [], unidades: [] };

let contadorFilas = 0;

// Esto se ejecuta apenas se abre la página
document.addEventListener('DOMContentLoaded', () => {
  const btnAgregar = document.getElementById('btnAgregarAccion');
  const btnGuardarProg = document.getElementById('btnGuardarProgramacion');
  const formProg = document.getElementById('formProgramacion');
  const modalConfirmar = document.getElementById('ventanaConfirmar');
  const btnConfirmarSi = document.getElementById('btnConfirmarSi');
  const btnConfirmarNo = document.getElementById('btnConfirmarNo');
  const btnCerrarVentana = document.getElementById('btnCerrarVentana');

  // Los botones se habilitan cuando terminen de cargar los datos
  btnAgregar.disabled = true;
  btnGuardarProg.disabled = true;
  cargarProgramacion();

  btnAgregar.addEventListener('click', () => agregarFilaAccion());

  btnGuardarProg.addEventListener('click', (e) => {
    e.preventDefault();
    if (validarFilas()) abrirModalConfirmacion();
  });

  formProg.addEventListener('submit', (e) => {
    e.preventDefault();
    if (validarFilas()) abrirModalConfirmacion();
  });

  if (btnConfirmarNo) btnConfirmarNo.addEventListener('click', cerrarModalConfirmacion);
  if (btnCerrarVentana) btnCerrarVentana.addEventListener('click', cerrarModalConfirmacion);

  if (btnConfirmarSi) {
    btnConfirmarSi.addEventListener('click', () => {
      cerrarModalConfirmacion();
      guardarProgramacion();
    });
  }

  // Cerrar al hacer clic en el fondo fuera del modal
  if (modalConfirmar) {
    modalConfirmar.addEventListener('click', (e) => {
      if (e.target === modalConfirmar) cerrarModalConfirmacion();
    });
  }

  // Cerrar modal con tecla Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cerrarModalConfirmacion();
  });
});

// Estas dos funciones solo muestran y ocultan la ventana de confirmación
function abrirModalConfirmacion() {
  const modal = document.getElementById('ventanaConfirmar');
  const titulo = document.getElementById('ventanaTitulo');
  const icono = document.getElementById('ventanaIcono');
  const texto = document.getElementById('ventanaTexto');

  if (titulo) titulo.innerText = 'Confirmación';
  if (icono) icono.innerText = '⚠️';
  if (texto) texto.innerText = '¿Confirmar programación?';

  if (modal) modal.style.display = 'flex';
}

function cerrarModalConfirmacion() {
  const modal = document.getElementById('ventanaConfirmar');
  if (modal) modal.style.display = 'none';
}

// ---------------------------------------------------------------------
// Comunicación con el servidor
// ---------------------------------------------------------------------

// Pide al servidor el plan del año, sus acciones y las listas de opciones
async function cargarProgramacion() {
  try {
    const resultado = await leerRespuesta(await fetch(API_PROGRAMACION));
    catalogos = resultado.catalogos;

    mostrarNombreUnidad(resultado.unidad.nombre);

    const acciones = resultado.acciones.length > 0 ? resultado.acciones : [null];
    acciones.forEach(accion => agregarFilaAccion(accion));

    mostrarEstadoPlan(resultado.plan);
  } catch (error) {
    mostrarMensaje(error.message, 'error');
  }
}

// Envía todas las acciones de la tabla al servidor
async function guardarProgramacion() {
  const btnGuardarProg = document.getElementById('btnGuardarProgramacion');
  btnGuardarProg.disabled = true;

  try {
    await leerRespuesta(await fetch(API_PROGRAMACION, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acciones: recolectarAcciones() })
    }));

    window.location.href = new URL(PAGINA_SEGUIMIENTO, window.location.href).href;
  } catch (error) {
    marcarErroresDelServidor(error.errores);
    mostrarMensaje(error.message, 'error', error.errores);
    btnGuardarProg.disabled = false;
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

// Junta lo que se escribió en la tabla: cada acción con sus 12 meses de programado
function recolectarAcciones() {
  return filasDeAcciones().map((trP) => {
    const id = trP.dataset.fila;
    return {
      id: trP.dataset.accionId || null,
      linea_id: trP.querySelector('select[name^="lineaAccion_"]').value,
      descripcion: trP.querySelector('textarea[name^="accionEstrategica_"]').value.trim(),
      con_recursos: trP.querySelector('select[name^="recursos_"]').value === '1',
      unidad_medida_id: trP.querySelector('select[name^="unidadMedida_"]').value,
      p: Array.from(document.querySelectorAll(`.input-p-${id}`)).map(input => parseInt(input.value, 10) || 0)
    };
  });
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

// Habilita los botones, o bloquea la tabla si el plan ya se envió a Planeación
function mostrarEstadoPlan(plan) {
  const btnAgregar = document.getElementById('btnAgregarAccion');
  const btnGuardarProg = document.getElementById('btnGuardarProgramacion');

  if (plan && !plan.editable) {
    document.querySelectorAll('#cuerpoProgramacion select, #cuerpoProgramacion textarea, #cuerpoProgramacion input')
      .forEach(campo => { campo.disabled = true; });
    document.querySelectorAll('#cuerpoProgramacion .boton-quitar').forEach(boton => { boton.style.display = 'none'; });
    btnAgregar.style.display = 'none';
    btnGuardarProg.style.display = 'none';
    mostrarMensaje(`El plan está en estado "${plan.estado}" y ya no se puede modificar.`, 'info');
    return;
  }

  if (plan && plan.estado === 'CON OBSERVACIONES' && plan.observaciones) {
    mostrarMensaje('Planeación dejó observaciones: ' + plan.observaciones, 'info');
  }

  btnAgregar.disabled = false;
  btnGuardarProg.disabled = false;
}

// Muestra un aviso arriba de la tabla. tipo: 'error' (rojo) o 'info' (azul)
function mostrarMensaje(texto, tipo, errores) {
  const cajaAvisos = document.getElementById('cajaAvisos');
  if (!cajaAvisos) return;

  let contenido = (tipo === 'error' ? '⚠️ ' : 'ℹ️ ') + texto;
  if (errores) {
    errores.forEach(e => { contenido += '\n• ' + e.mensaje; });
  }

  cajaAvisos.innerText = contenido;
  cajaAvisos.className = tipo === 'error' ? 'caja-aviso' : 'caja-aviso aviso-info';
  cajaAvisos.style.display = 'block';
  cajaAvisos.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function ocultarMensaje() {
  const cajaAvisos = document.getElementById('cajaAvisos');
  if (cajaAvisos) cajaAvisos.style.display = 'none';
}

// Revisa que cada acción tenga línea de acción, descripción y unidad de medida
function validarFilas() {
  const filas = filasDeAcciones();
  const faltantes = [];

  document.querySelectorAll('#cuerpoProgramacion .campo-error').forEach(el => el.classList.remove('campo-error'));

  if (filas.length === 0) {
    mostrarMensaje('Agrega al menos una acción estratégica.', 'error');
    return false;
  }

  filas.forEach((trP, i) => {
    const requeridos = [
      ['select[name^="lineaAccion_"]', 'línea de acción'],
      ['textarea[name^="accionEstrategica_"]', 'acción estratégica'],
      ['select[name^="unidadMedida_"]', 'unidad de medida']
    ];
    requeridos.forEach(([selector, nombre]) => {
      const campo = trP.querySelector(selector);
      if (!campo.value.trim()) {
        campo.classList.add('campo-error');
        faltantes.push({ mensaje: `Acción ${i + 1}: falta ${nombre}.` });
      }
    });
  });

  if (faltantes.length > 0) {
    mostrarMensaje('Completa los campos marcados en rojo.', 'error', faltantes);
    return false;
  }

  ocultarMensaje();
  return true;
}

// Marca en rojo los campos que el servidor rechazó (errores = [{fila, campo, mensaje}])
function marcarErroresDelServidor(errores) {
  if (!errores) return;
  const filas = filasDeAcciones();
  const selectores = {
    linea_id: 'select[name^="lineaAccion_"]',
    descripcion: 'textarea[name^="accionEstrategica_"]',
    unidad_medida_id: 'select[name^="unidadMedida_"]'
  };

  errores.forEach(({ fila, campo }) => {
    const trP = filas[fila - 1];
    if (!trP) return;
    if (campo === 'p') {
      document.querySelectorAll(`.input-p-${trP.dataset.fila}`).forEach(input => input.classList.add('campo-error'));
    } else if (selectores[campo]) {
      trP.querySelector(selectores[campo]).classList.add('campo-error');
    }
  });
}

function filasDeAcciones() {
  return Array.from(document.querySelectorAll('#cuerpoProgramacion tr.fila-programado'));
}

// ---------------------------------------------------------------------
// Construcción de la tabla
// ---------------------------------------------------------------------

// Evita que se escriban letras: solo deja pasar números
function soloEnteros(event) {
  const charCode = event.which ? event.which : event.keyCode;
  if (charCode < 48 || charCode > 57) {
    event.preventDefault();
    return false;
  }
  return true;
}

// Evita que se pegue (copiar/pegar) algo que no sea un número
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

function textoLinea(linea) {
  return linea.clave ? `${linea.clave}. ${linea.descripcion}` : '';
}

// Arma las opciones de un menú desplegable: lista de {id, ...}, cómo mostrar cada una y cuál va seleccionada
function crearOpciones(lista, obtenerTexto, idSeleccionado, textoVacio) {
  const vacia = `<option value="">${escaparHtml(textoVacio)}</option>`;
  return vacia + lista.map(item => {
    const seleccionado = Number(item.id) === Number(idSeleccionado) ? 'selected' : '';
    return `<option value="${item.id}" ${seleccionado}>${escaparHtml(obtenerTexto(item))}</option>`;
  }).join('');
}

// Opciones de líneas de acción: siempre las 22, agrupadas por proyecto
function opcionesLineas(lineaSeleccionada) {
  const grupos = catalogos.proyectos.map(proyecto => {
    const lineas = catalogos.lineas.filter(l => Number(l.proyecto_id) === Number(proyecto.id));
    if (lineas.length === 0) return '';
    const opciones = lineas.map(l => {
      const seleccionado = Number(l.id) === Number(lineaSeleccionada) ? 'selected' : '';
      return `<option value="${l.id}" ${seleccionado}>${escaparHtml(textoLinea(l))}</option>`;
    }).join('');
    return `<optgroup label="${escaparHtml(`${proyecto.clave}. ${proyecto.nombre}`)}">${opciones}</optgroup>`;
  }).join('');

  return '<option value="">Seleccione una línea de acción</option>' + grupos;
}

// Al elegir una línea de acción, el proyecto de la fila se ajusta al proyecto de esa línea
function cambiarLinea(id) {
  const lineaId = document.querySelector(`select[name="lineaAccion_${id}"]`).value;
  const linea = catalogos.lineas.find(l => Number(l.id) === Number(lineaId));
  if (linea) {
    document.querySelector(`select[name="proyecto_${id}"]`).value = linea.proyecto_id;
  }
}

// Crea una acción en la tabla: una fila de Programado y una de Realizado.
// data viene del servidor: {id, proyecto_id, linea_id, descripcion, con_recursos, unidad_medida_id, p[12], r[12]}
function agregarFilaAccion(data = null) {
  contadorFilas++;
  const id = contadorFilas;
  const tbody = document.getElementById('cuerpoProgramacion');

  if (!tbody) {
    console.error('El elemento <tbody> con id="cuerpoProgramacion" no existe en el HTML.');
    return;
  }

  const esPrimeraAccion = tbody.children.length === 0;

  const pVals = data ? data.p : Array(12).fill('');
  const rVals = data ? data.r : Array(12).fill(0);
  const conRecursos = data ? data.con_recursos === 1 : true;

  const trP = document.createElement('tr');
  trP.className = 'fila-programado';
  trP.id = `fila-${id}-p`;
  trP.dataset.fila = id;
  if (data && data.id) trP.dataset.accionId = data.id;

  trP.innerHTML = `
    <td rowspan="2">
      <select class="campo-tabla" name="proyecto_${id}">
        ${crearOpciones(catalogos.proyectos, p => `${p.clave}. ${p.nombre}`, data ? data.proyecto_id : null, 'Seleccione un proyecto')}
      </select>
    </td>
    <td rowspan="2">
      <select class="campo-tabla" name="lineaAccion_${id}" onchange="cambiarLinea(${id})">
        ${opcionesLineas(data ? data.linea_id : null)}
      </select>
    </td>
    <td rowspan="2">
      <textarea class="campo-tabla" name="accionEstrategica_${id}" maxlength="2000">${escaparHtml(data ? data.descripcion : '')}</textarea>
    </td>
    <td rowspan="2">
      <select class="campo-tabla" name="recursos_${id}">
        <option value="1" ${conRecursos ? 'selected' : ''}>CON RECURSOS ECONÓMICOS</option>
        <option value="0" ${conRecursos ? '' : 'selected'}>SIN RECURSOS ECONÓMICOS</option>
      </select>
    </td>
    <td rowspan="2">
      <select class="campo-tabla" name="unidadMedida_${id}">
        ${crearOpciones(catalogos.unidades, u => u.nombre, data ? data.unidad_medida_id : null, 'Seleccione')}
      </select>
    </td>
    <td style="text-align:center;"><span class="etiqueta-programado">Programado</span></td>

    <!-- Meses 1er Semestre -->
    ${pVals.slice(0, 6).map((val, idx) => `
      <td>
        <input type="number" min="0" step="1" class="campo-mes input-p-${id}" name="p_${id}_${idx}" value="${val !== '' && Number(val) !== 0 ? val : ''}" placeholder="0" onkeypress="return soloEnteros(event)" onpaste="return validarPegadoEnteros(event)" oninput="calcularTotales(${id})">
      </td>
    `).join('')}

    <!-- Abs 1er Semestre P (Seguimiento) -->
    <td class="celda-subtotal">
      <input type="number" class="campo-mes campo-bloqueado input-abs-p-${id}" id="subtotal-p-sem-${id}" name="abs_p_sem_${id}" value="0" readonly title="Se calcula automáticamente con la suma de los meses">
    </td>
    <!-- % 1er Semestre P (Seguimiento): calculado = Abs R * 100 / Abs P -->
    <td class="celda-subtotal">
      <input type="text" class="campo-mes campo-bloqueado" id="pct-p-sem-${id}" name="pct_p_sem_${id}" value="0%" readonly>
    </td>

    <!-- Meses 2do Semestre -->
    ${pVals.slice(6, 12).map((val, idx) => `
      <td>
        <input type="number" min="0" step="1" class="campo-mes input-p-${id}" name="p_${id}_${idx + 6}" value="${val !== '' && Number(val) !== 0 ? val : ''}" placeholder="0" onkeypress="return soloEnteros(event)" onpaste="return validarPegadoEnteros(event)" oninput="calcularTotales(${id})">
      </td>
    `).join('')}

    <!-- Abs 2do Semestre P (Seguimiento) -->
    <td class="celda-subtotal">
      <input type="number" class="campo-mes campo-bloqueado input-abs-p-sem2-${id}" id="subtotal-p-sem2-${id}" name="abs_p_sem2_${id}" value="0" readonly title="Se calcula automáticamente con la suma de los meses">
    </td>
    <td class="celda-subtotal">
      <input type="text" class="campo-mes campo-bloqueado" id="pct-p-sem2-${id}" name="pct_p_sem2_${id}" value="0%" readonly>
    </td>

    <!-- Total Anual P -->
    <td class="celda-total" id="total-p-${id}">0</td>
    <!-- % Total Anual P: calculado = Total R * 100 / Total P -->
    <td class="celda-total">
      <input type="text" class="campo-mes campo-bloqueado" id="pct-p-anual-${id}" name="pct_p_anual_${id}" value="0%" readonly>
    </td>

    <td rowspan="2">
      <button type="button" class="boton-quitar" onclick="eliminarFila(${id})">✕</button>
    </td>
  `;

  const trR = document.createElement('tr');
  trR.className = 'fila-realizado';
  trR.id = `fila-${id}-r`;

  trR.innerHTML = `
    <td style="text-align:center;"><span class="etiqueta-realizado">Realizado</span></td>

    <!-- Meses 1er Semestre R -->
    ${rVals.slice(0, 6).map((val, idx) => `
      <td>
        <input type="number" min="0" step="1" class="campo-mes campo-bloqueado input-r-${id}" name="r_${id}_${idx}" value="${val !== '' ? val : 0}" readonly title="Se modifica en la hoja de Seguimiento">
      </td>
    `).join('')}

    <!-- Abs 1er Semestre R (Seguimiento) -->
    <td class="celda-realizado">
      <input type="number" class="campo-mes campo-bloqueado input-abs-r-${id}" id="subtotal-r-sem-${id}" name="abs_r_sem_${id}" value="0" readonly title="Se calcula automáticamente con la suma de los meses">
    </td>
    <!-- % 1er Semestre R (Seguimiento): bloqueado -->
    <td class="celda-realizado">
      <input type="text" class="campo-mes campo-bloqueado" id="pct-r-sem-${id}" name="pct_r_sem_${id}" value="0%" readonly title="Bloqueado: se calcula automáticamente (R x 100 / P)">
    </td>

    <!-- Meses 2do Semestre R -->
    ${rVals.slice(6, 12).map((val, idx) => `
      <td>
        <input type="number" min="0" step="1" class="campo-mes campo-bloqueado input-r-${id}" name="r_${id}_${idx + 6}" value="${val !== '' ? val : 0}" readonly title="Se modifica en la hoja de Seguimiento">
      </td>
    `).join('')}

    <!-- Abs 2do Semestre R (Seguimiento) -->
    <td class="celda-realizado">
      <input type="number" class="campo-mes campo-bloqueado input-abs-r-sem2-${id}" id="subtotal-r-sem2-${id}" name="abs_r_sem2_${id}" value="0" readonly title="Se calcula automáticamente con la suma de los meses">
    </td>
    <td class="celda-realizado">
      <input type="text" class="campo-mes campo-bloqueado" id="pct-r-sem2-${id}" name="pct_r_sem2_${id}" value="0%" readonly title="Bloqueado: se calcula automáticamente (R x 100 / P)">
    </td>

    <!-- Total Anual R -->
    <td class="celda-realizado" id="total-r-${id}">0</td>
    <!-- % Total Anual R: bloqueado -->
    <td class="celda-realizado">
      <input type="text" class="campo-mes campo-bloqueado" id="pct-r-anual-${id}" name="pct_r_anual_${id}" value="0%" readonly title="Bloqueado: se calcula automáticamente (R x 100 / P)">
    </td>
  `;

  if (!esPrimeraAccion) {
    const trEspaciador = document.createElement('tr');
    trEspaciador.className = 'fila-separador';
    trEspaciador.innerHTML = `<td colspan="25"></td>`;
    tbody.appendChild(trEspaciador);
  }

  tbody.appendChild(trP);
  tbody.appendChild(trR);

  calcularTotales(id);
}

// Suma los meses y calcula los porcentajes cada vez que se escribe un número
function calcularTotales(id) {
  const pInputs = Array.from(document.querySelectorAll(`.input-p-${id}`));
  const rInputs = Array.from(document.querySelectorAll(`.input-r-${id}`));

  let subP1 = pInputs.slice(0, 6).reduce((sum, inp) => sum + (parseInt(inp.value, 10) || 0), 0);
  let subR1 = rInputs.slice(0, 6).reduce((sum, inp) => sum + (parseInt(inp.value, 10) || 0), 0);
  let subP2 = pInputs.slice(6, 12).reduce((sum, inp) => sum + (parseInt(inp.value, 10) || 0), 0);
  let subR2 = rInputs.slice(6, 12).reduce((sum, inp) => sum + (parseInt(inp.value, 10) || 0), 0);

  const inputAbsP = document.getElementById(`subtotal-p-sem-${id}`);
  const inputAbsR = document.getElementById(`subtotal-r-sem-${id}`);
  const inputPctPSem = document.getElementById(`pct-p-sem-${id}`);
  const inputPctRSem = document.getElementById(`pct-r-sem-${id}`);
  const inputAbsPSem2 = document.getElementById(`subtotal-p-sem2-${id}`);
  const inputAbsRSem2 = document.getElementById(`subtotal-r-sem2-${id}`);
  const inputPctPSem2 = document.getElementById(`pct-p-sem2-${id}`);
  const inputPctRSem2 = document.getElementById(`pct-r-sem2-${id}`);

  // El Abs es simplemente la suma de los 6 meses de ese semestre
  if (inputAbsP) inputAbsP.value = subP1;
  if (inputAbsR) inputAbsR.value = subR1;
  if (inputAbsPSem2) inputAbsPSem2.value = subP2;
  if (inputAbsRSem2) inputAbsRSem2.value = subR2;

  let valAbsP = subP1;
  let valAbsR = subR1;

  // Porcentajes del primer semestre: el de Programado siempre sale en 100%
  // (si ya se capturó algo), y el de Realizado es lo que de verdad se cumplió
  let pctPSem = valAbsP > 0 ? ((valAbsP / valAbsP) * 100).toFixed(1) : 0;
  let pctRSem = valAbsP > 0 ? ((valAbsR / valAbsP) * 100).toFixed(1) : 0;
  aplicarPorcentaje(inputPctPSem, pctPSem, 'celda-subtotal');
  aplicarPorcentaje(inputPctRSem, pctRSem, 'celda-realizado');

  // Lo mismo, pero para el segundo semestre
  let pctPSem2 = subP2 > 0 ? ((subP2 / subP2) * 100).toFixed(1) : 0;
  let pctRSem2 = subP2 > 0 ? ((subR2 / subP2) * 100).toFixed(1) : 0;
  aplicarPorcentaje(inputPctPSem2, pctPSem2, 'celda-subtotal');
  aplicarPorcentaje(inputPctRSem2, pctRSem2, 'celda-realizado');

  // Totales de todo el año (sumando los 12 meses)
  let totalP = pInputs.reduce((sum, inp) => sum + (parseInt(inp.value, 10) || 0), 0);
  let totalR = rInputs.reduce((sum, inp) => sum + (parseInt(inp.value, 10) || 0), 0);

  // Mismo cálculo de porcentaje, pero para el año completo
  let pctPAnual = totalP > 0 ? ((totalP / totalP) * 100).toFixed(1) : 0;
  let pctRAnual = totalP > 0 ? ((totalR / totalP) * 100).toFixed(1) : 0;

  const cellTotalP = document.getElementById(`total-p-${id}`);
  const cellTotalR = document.getElementById(`total-r-${id}`);
  if (cellTotalP) cellTotalP.innerText = totalP;
  if (cellTotalR) cellTotalR.innerText = totalR;

  const inputPctPAnual = document.getElementById(`pct-p-anual-${id}`);
  const inputPctRAnual = document.getElementById(`pct-r-anual-${id}`);
  aplicarPorcentaje(inputPctPAnual, pctPAnual, 'celda-total');
  aplicarPorcentaje(inputPctRAnual, pctRAnual, 'celda-realizado');
}

// Pone el porcentaje ya calculado en su casilla y le pone color
// (verde, amarillo o rojo) según qué tan bien va esa acción
function aplicarPorcentaje(input, pct, claseBase) {
  if (!input) return;
  input.value = `${pct}%`;
  const td = input.closest('td');
  if (!td) return;
  td.className = claseBase;
  if (pct >= 100) {
    td.classList.add('pct-bueno');
  } else if (pct >= 50) {
    td.classList.add('pct-regular');
  } else {
    td.classList.add('pct-bajo');
  }
}

// Borra una acción completa de la tabla (su fila de arriba, la de abajo y el espacio).
// El borrado en la base de datos ocurre al presionar "Guardar Programación".
function eliminarFila(id) {
  const filaP = document.getElementById(`fila-${id}-p`);
  const filaR = document.getElementById(`fila-${id}-r`);

  // Si la acción ya tiene avances capturados en los seguimientos, pedir confirmación
  const totalRealizado = parseInt(document.getElementById(`total-r-${id}`)?.innerText, 10) || 0;
  if (totalRealizado > 0 && !confirm('Esta acción ya tiene avances capturados en los seguimientos. Al guardar se borrarán también. ¿Quitarla?')) {
    return;
  }

  // Quitar también el espaciador asociado a esta acción, sin dejar dos seguidos
  const espaciadorAntes = filaP?.previousElementSibling;
  const espaciadorDespues = filaR?.nextElementSibling;
  if (espaciadorAntes && espaciadorAntes.classList.contains('fila-separador')) {
    espaciadorAntes.remove();
  } else if (espaciadorDespues && espaciadorDespues.classList.contains('fila-separador')) {
    espaciadorDespues.remove();
  }

  if (filaP) filaP.remove();
  if (filaR) filaR.remove();
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
