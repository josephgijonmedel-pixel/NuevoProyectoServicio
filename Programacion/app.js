document.addEventListener('DOMContentLoaded', () => {
  // 1. Cargar el dato de Unidad Responsable guardado en localStorage
  const datosLocales = localStorage.getItem('unidadResponsableData');
  if (datosLocales) {
    try {
      const dataUR = JSON.parse(datosLocales);
      const inputUR = document.getElementById('unidadResponsable');
      if (inputUR && dataUR.nombreUnidad) {
        inputUR.value = dataUR.nombreUnidad;
      }
    } catch (e) {
      console.error('Error al leer datos locales de UR:', e);
    }
  }

  // 2. Cargar las filas guardadas (si existen) o las filas iniciales por defecto
  cargarProgramacionGuardada().forEach(d => agregarFilaAccion(d));

  // 3. Evento del botón para agregar nuevas filas
  const btnAgregar = document.getElementById('btnAgregarAccion');
  if (btnAgregar) {
    btnAgregar.addEventListener('click', () => agregarFilaAccion());
    
  }

  // 4. Evento para guardar el formulario con confirmación
  const formProg = document.getElementById('formProgramacion');
  const modalConfirmar = document.getElementById('modalConfirmarGuardar');
  const btnConfirmarSi = document.getElementById('btnConfirmarSi');
  const btnConfirmarNo = document.getElementById('btnConfirmarNo');
  const btnCerrarConfirmX = document.getElementById('btnCerrarConfirmX');
  const btnGuardarProg = document.getElementById('btnGuardarProgramacion');

  if (btnGuardarProg) {
    btnGuardarProg.addEventListener('click', function(e) {
      e.preventDefault();
      abrirModalConfirmacion();
    });
  }

  if (formProg) {
    formProg.addEventListener('submit', function(e) {
      e.preventDefault();
      abrirModalConfirmacion();
    });
  }

  if (btnConfirmarNo) {
    btnConfirmarNo.addEventListener('click', cerrarModalConfirmacion);
  }

  if (btnCerrarConfirmX) {
    btnCerrarConfirmX.addEventListener('click', cerrarModalConfirmacion);
  }

  if (btnConfirmarSi) {
    btnConfirmarSi.addEventListener('click', () => {
      guardarProgramacion();
      cerrarModalConfirmacion();
      window.location.href = '/Segumiento/seguimiento.html';
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
  const modal = document.getElementById('modalConfirmarGuardar');
  const titulo = document.getElementById('modalConfirmTitulo');
  const icono = document.getElementById('modalConfirmIcon');
  const texto = document.getElementById('modalConfirmTexto');

  if (titulo) titulo.innerText = 'Confirmación';
  if (icono) icono.innerText = '⚠️';
  if (texto) texto.innerText = '¿Estás seguro que desea guardar?';

  if (modal) modal.style.display = 'flex';
}

function cerrarModalConfirmacion() {
  const modal = document.getElementById('modalConfirmarGuardar');
  if (modal) modal.style.display = 'none';
}

function cargarProgramacionGuardada() {
  const payloadGuardado = localStorage.getItem('programacionCompletaData');
  if (payloadGuardado) {
    try {
      const parsed = JSON.parse(payloadGuardado);
      if (Array.isArray(parsed.programacion) && parsed.programacion.length > 0) {
        return parsed.programacion;
      }
    } catch (e) {
      console.error('Error al leer programacionCompletaData:', e);
    }
  }
  return datosIniciales;
}

function guardarProgramacion() {
  const filas = Array.from(document.querySelectorAll('#bodyProgramacion tr.var-row-p'));

  const programacion = filas.map((trP) => {
    const idMatch = trP.id.match(/fila-(\d+)-p/);
    const id = idMatch ? idMatch[1] : null;

    if (!id) return null;

    const proyecto = trP.querySelector(`select[name^="proyecto_"]`)?.value || '';
    const lineaAccion = trP.querySelector(`select[name^="lineaAccion_"]`)?.value || '';
    const accionEstrategica = trP.querySelector(`textarea[name^="accionEstrategica_"]`)?.value || '';
    const recursos = trP.querySelector(`select[name^="recursos_"]`)?.value || '';
    const unidadMedida = trP.querySelector(`select[name^="unidadMedida_"]`)?.value || '';

    const p = Array.from(document.querySelectorAll(`.input-p-${id}`)).map((input) => {
      const valor = parseInt(input.value, 10);
      return Number.isNaN(valor) ? 0 : valor;
    });

    const r = Array.from(document.querySelectorAll(`.input-r-${id}`)).map((input) => {
      const valor = parseInt(input.value, 10);
      return Number.isNaN(valor) ? 0 : valor;
    });

    return {
      proyecto,
      lineaAccion,
      accionEstrategica,
      recursos,
      unidadMedida,
      p,
      r
    };
  }).filter(Boolean);

  const payload = {
    programacion,
    guardadoEn: new Date().toISOString()
  };

  localStorage.setItem('programacionCompletaData', JSON.stringify(payload));
  return payload;
}

// OPCIONES Y DATOS BASE
const proyectosOptions = [
  "1. Responsabilidad Social y Ambiental",
  "2. Impulsar la digitalización de la gestión administrativa de la CGZS",
  "3. Redimensionar la gestión Institucional",
  "4. Coadyuvar en la formación integral del estudiante, a través de la extensión y vinculación universitarias"
];

const lineasAccionOptions = [
  "1. Responsabilidad Social y Ambiental",
  "1.1.1. Sensibilización y Formación en Responsabilidad Social. Implementar programas de sensibilización y formación dirigidos a la comunidad UAGro sobre la importancia de la responsabilidad social y ambiental. Se realizarán actividades de capacitación, charlas y campañas de concientización.",
  "1.2.1. Desarrollo de Proyectos y Programas Socioambientales. Fomentar la creación y desarrollo de proyectos y programas de responsabilidad social y ambiental que aborden problemáticas relevantes para la sociedad. Se impulsará la participación de estudiantes, docentes y personal administrativo en la concepción e implementación de estas iniciativas.",
  "4. Coadyuvar en la formación integral del estudiante, a través de la extensión y vinculación universitarias",
  "4.1. Promover la oferta educativa del Nivel Superior de la UAGro en escuelas del NMS y otros subsistemas educativos.",
  "4.2. Difundir y acompañar a la comunidad educativa en procesos de vinculación y formación integral.",
  "4.3. Fortalecer la atención y orientación a estudiantes para mejorar su permanencia y desarrollo académico.",
  "4.4. Acompañar la coordinación de actividades de extensión y vinculación institucional.",
  "4.4.1. Dar seguimiento a la ejecución de acciones de extensión vinculadas con la formación integral del estudiante."
];

const unidadesMedidaOptions = [
  "Actualizaciones", "Bazares", "Catálogos", "Charlas", "Coloquios", "Concursos",
  "Convenios", "Digitalizaciones", "Docentes", "Encuestas", "Equipos de cómputo",
  "Estudiantes", "Evaluaciones", "Eventos Académicos", "Eventos Artísticos",
  "Expedientes", "Exposiciones", "Gestiones", "Oficios", "Procesos y Procedimientos",
  "Registros", "Reportes", "Reuniones", "Seguimiento", "Simulacros", "Talleres",
  "Utensilios", "Visitas", "Otros"
];

// Acciones tomadas de la hoja "PROGRAMACIÓN 2026" del documento
// FORMATO PARA PRUEBA SERVICIO SOCIAL (Sin celdas ocultas), columnas A-Z (hasta Total Anual)
const datosIniciales = [
  {
    proyecto: "4. Coadyuvar en la formación integral del estudiante, a través de la extensión y vinculación universitarias",
    lineaAccion: "4. Coadyuvar en la formación integral del estudiante, a través de la extensión y vinculación universitarias.",
    accionEstrategica: "Difundir, gestionar y acompañar en la promoción de la Oferta Eduactiva del Nivel Superior de la UAGro, en las escuelas del NMS y otros subsitemas educativos de la zona.",
    recursos: "CON RECURSOS ECONOMICOS",
    unidadMedida: "Visitas",
    p: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    r: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  }
];

let contadorFilas = 0;

// FUNCIONES AUXILIARES DE VALIDACIÓN
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

function crearOpcionesSelect(lista, valorSeleccionado) {
  return lista.map(item => `<option value="${item}" ${item === valorSeleccionado ? 'selected' : ''}>${item}</option>`).join('');
}

// CONSTRUCCIÓN DINÁMICA DE FILAS
function agregarFilaAccion(data = null) {
  contadorFilas++;
  const id = contadorFilas;
  const tbody = document.getElementById('bodyProgramacion');

  if (!tbody) {
    console.error('El elemento <tbody> con id="bodyProgramacion" no existe en el HTML.');
    return;
  }

  const esPrimeraAccion = tbody.children.length === 0;

  const pVals = data ? data.p : Array(12).fill("");
  const rVals = data ? data.r : Array(12).fill(0);

  const trP = document.createElement('tr');
  trP.className = 'var-row-p';
  trP.id = `fila-${id}-p`;

  trP.innerHTML = `
    <td rowspan="2">
      <select class="table-control" name="proyecto_${id}">
        ${crearOpcionesSelect(proyectosOptions, data ? data.proyecto : '')}
      </select>
    </td>
    <td rowspan="2">
      <select class="table-control" name="lineaAccion_${id}">
        <option value="">Seleccione una línea de acción</option>
        ${crearOpcionesSelect(lineasAccionOptions, data ? data.lineaAccion : '')}
      </select>
    </td>
    <td rowspan="2">
      <textarea class="table-control" name="accionEstrategica_${id}">${data ? data.accionEstrategica : ''}</textarea>
    </td>
    <td rowspan="2">
      <select class="table-control" name="recursos_${id}">
        <option value="CON RECURSOS ECONOMICOS" ${data && data.recursos === 'CON RECURSOS ECONOMICOS' ? 'selected' : ''}>CON RECURSOS ECONÓMICOS</option>
        <option value="SIN RECURSOS ECONOMICOS" ${data && data.recursos === 'SIN RECURSOS ECONOMICOS' ? 'selected' : ''}>SIN RECURSOS ECONÓMICOS</option>
      </select>
    </td>
    <td rowspan="2">
      <select class="table-control" name="unidadMedida_${id}">
        ${crearOpcionesSelect(unidadesMedidaOptions, data ? data.unidadMedida : '')}
      </select>
    </td>
    <td style="text-align:center;"><span class="badge-p">Programado</span></td>

    <!-- Meses 1er Semestre -->
    ${pVals.slice(0, 6).map((val, idx) => `
      <td>
        <input type="number" min="0" step="1" class="cal-input input-p-${id}" name="p_${id}_${idx}" value="${val !== '' && Number(val) !== 0 ? val : ''}" placeholder="0" onkeypress="return soloEnteros(event)" onpaste="return validarPegadoEnteros(event)" oninput="calcularTotales(${id})">
      </td>
    `).join('')}

    <!-- Abs 1er Semestre P (Seguimiento) -->
    <td class="cell-bg-subp">
      <input type="number" class="cal-input input-readonly input-abs-p-${id}" id="subtotal-p-sem-${id}" name="abs_p_sem_${id}" value="0" readonly title="Se calcula automáticamente con la suma de los meses">
    </td>
    <!-- % 1er Semestre P (Seguimiento): calculado = Abs R * 100 / Abs P -->
    <td class="cell-bg-subp">
      <input type="text" class="cal-input input-readonly" id="pct-p-sem-${id}" name="pct_p_sem_${id}" value="0%" readonly>
    </td>

    <!-- Meses 2do Semestre -->
    ${pVals.slice(6, 12).map((val, idx) => `
      <td>
        <input type="number" min="0" step="1" class="cal-input input-p-${id}" name="p_${id}_${idx + 6}" value="${val !== '' && Number(val) !== 0 ? val : ''}" placeholder="0" onkeypress="return soloEnteros(event)" onpaste="return validarPegadoEnteros(event)" oninput="calcularTotales(${id})">
      </td>
    `).join('')}

    <!-- Abs 2do Semestre P (Seguimiento) -->
    <td class="cell-bg-subp">
      <input type="number" class="cal-input input-readonly input-abs-p-sem2-${id}" id="subtotal-p-sem2-${id}" name="abs_p_sem2_${id}" value="0" readonly title="Se calcula automáticamente con la suma de los meses">
    </td>
    <td class="cell-bg-subp">
      <input type="text" class="cal-input input-readonly" id="pct-p-sem2-${id}" name="pct_p_sem2_${id}" value="0%" readonly>
    </td>

    <!-- Total Anual P -->
    <td class="cell-bg-totp" id="total-p-${id}">0</td>
    <!-- % Total Anual P: calculado = Total R * 100 / Total P -->
    <td class="cell-bg-totp">
      <input type="text" class="cal-input input-readonly" id="pct-p-anual-${id}" name="pct_p_anual_${id}" value="0%" readonly>
    </td>

    <td rowspan="2">
      <button type="button" class="btn-remove" onclick="eliminarFila(${id})">✕</button>
    </td>
  `;

  const trR = document.createElement('tr');
  trR.className = 'var-row-r';
  trR.id = `fila-${id}-r`;

  trR.innerHTML = `
    <td style="text-align:center;"><span class="badge-r">Realizado</span></td>

    <!-- Meses 1er Semestre R -->
    ${rVals.slice(0, 6).map((val, idx) => `
      <td>
        <input type="number" min="0" step="1" class="cal-input input-readonly input-r-${id}" name="r_${id}_${idx}" value="${val !== '' ? val : 0}" readonly title="Se modifica en la hoja de Seguimiento">
      </td>
    `).join('')}

    <!-- Abs 1er Semestre R (Seguimiento) -->
    <td class="cell-bg-r">
      <input type="number" class="cal-input input-readonly input-abs-r-${id}" id="subtotal-r-sem-${id}" name="abs_r_sem_${id}" value="0" readonly title="Se calcula automáticamente con la suma de los meses">
    </td>
    <!-- % 1er Semestre R (Seguimiento): bloqueado -->
    <td class="cell-bg-r">
      <input type="text" class="cal-input input-readonly" id="pct-r-sem-${id}" name="pct_r_sem_${id}" value="0%" readonly title="Bloqueado: se calcula automáticamente (R x 100 / P)">
    </td>

    <!-- Meses 2do Semestre R -->
    ${rVals.slice(6, 12).map((val, idx) => `
      <td>
        <input type="number" min="0" step="1" class="cal-input input-readonly input-r-${id}" name="r_${id}_${idx + 6}" value="${val !== '' ? val : 0}" readonly title="Se modifica en la hoja de Seguimiento">
      </td>
    `).join('')}

    <!-- Abs 2do Semestre R (Seguimiento) -->
    <td class="cell-bg-r">
      <input type="number" class="cal-input input-readonly input-abs-r-sem2-${id}" id="subtotal-r-sem2-${id}" name="abs_r_sem2_${id}" value="0" readonly title="Se calcula automáticamente con la suma de los meses">
    </td>
    <td class="cell-bg-r">
      <input type="text" class="cal-input input-readonly" id="pct-r-sem2-${id}" name="pct_r_sem2_${id}" value="0%" readonly title="Bloqueado: se calcula automáticamente (R x 100 / P)">
    </td>

    <!-- Total Anual R -->
    <td class="cell-bg-r" id="total-r-${id}">0</td>
    <!-- % Total Anual R: bloqueado -->
    <td class="cell-bg-r">
      <input type="text" class="cal-input input-readonly" id="pct-r-anual-${id}" name="pct_r_anual_${id}" value="0%" readonly title="Bloqueado: se calcula automáticamente (R x 100 / P)">
    </td>
  `;

  if (!esPrimeraAccion) {
    const trEspaciador = document.createElement('tr');
    trEspaciador.className = 'row-spacer';
    trEspaciador.innerHTML = `<td colspan="25"></td>`;
    tbody.appendChild(trEspaciador);
  }

  tbody.appendChild(trP);
  tbody.appendChild(trR);

  calcularTotales(id);
}

// CÁLCULOS EN TIEMPO REAL
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

  // Abs siempre refleja la suma de los seis meses del semestre.
  if (inputAbsP) inputAbsP.value = subP1;
  if (inputAbsR) inputAbsR.value = subR1;
  if (inputAbsPSem2) inputAbsPSem2.value = subP2;
  if (inputAbsRSem2) inputAbsRSem2.value = subR2;

  let valAbsP = subP1;
  let valAbsR = subR1;

  // Seguimiento Semestre 1
  // % de P = Abs P * 100 / Abs P (siempre 100 si hay datos capturados)
  let pctPSem = valAbsP > 0 ? ((valAbsP / valAbsP) * 100).toFixed(1) : 0;
  // % de R (bloqueado) = Abs R * 100 / Abs P (porcentaje real de cumplimiento)
  let pctRSem = valAbsP > 0 ? ((valAbsR / valAbsP) * 100).toFixed(1) : 0;
  aplicarPorcentaje(inputPctPSem, pctPSem, 'cell-bg-subp');
  aplicarPorcentaje(inputPctRSem, pctRSem, 'cell-bg-r');

  // Seguimiento Semestre 2
  let pctPSem2 = subP2 > 0 ? ((subP2 / subP2) * 100).toFixed(1) : 0;
  let pctRSem2 = subP2 > 0 ? ((subR2 / subP2) * 100).toFixed(1) : 0;
  aplicarPorcentaje(inputPctPSem2, pctPSem2, 'cell-bg-subp');
  aplicarPorcentaje(inputPctRSem2, pctRSem2, 'cell-bg-r');

  // Totales Anuales
  let totalP = pInputs.reduce((sum, inp) => sum + (parseInt(inp.value, 10) || 0), 0);
  let totalR = rInputs.reduce((sum, inp) => sum + (parseInt(inp.value, 10) || 0), 0);

  // % de P = Total P * 100 / Total P (siempre 100 si hay datos capturados)
  let pctPAnual = totalP > 0 ? ((totalP / totalP) * 100).toFixed(1) : 0;
  // % de R (bloqueado) = Total R * 100 / Total P (porcentaje real de cumplimiento)
  let pctRAnual = totalP > 0 ? ((totalR / totalP) * 100).toFixed(1) : 0;

  const cellTotalP = document.getElementById(`total-p-${id}`);
  const cellTotalR = document.getElementById(`total-r-${id}`);
  if (cellTotalP) cellTotalP.innerText = totalP;
  if (cellTotalR) cellTotalR.innerText = totalR;

  const inputPctPAnual = document.getElementById(`pct-p-anual-${id}`);
  const inputPctRAnual = document.getElementById(`pct-r-anual-${id}`);
  aplicarPorcentaje(inputPctPAnual, pctPAnual, 'cell-bg-totp');
  aplicarPorcentaje(inputPctRAnual, pctRAnual, 'cell-bg-r');
}

// Escribe el valor de % calculado (Abs R * 100 / Abs P) en un input bloqueado
// y aplica el color de semáforo (bueno/regular/malo) a la celda que lo contiene
function aplicarPorcentaje(input, pct, claseBase) {
  if (!input) return;
  input.value = `${pct}%`;
  const td = input.closest('td');
  if (!td) return;
  td.className = claseBase;
  if (pct >= 100) {
    td.classList.add('pct-good');
  } else if (pct >= 50) {
    td.classList.add('pct-warn');
  } else {
    td.classList.add('pct-bad');
  }
}

// ELIMINAR FILA
function eliminarFila(id) {
  const filaP = document.getElementById(`fila-${id}-p`);
  const filaR = document.getElementById(`fila-${id}-r`);

  // Quitar también el espaciador asociado a esta acción, sin dejar dos seguidos
  const espaciadorAntes = filaP?.previousElementSibling;
  const espaciadorDespues = filaR?.nextElementSibling;
  if (espaciadorAntes && espaciadorAntes.classList.contains('row-spacer')) {
    espaciadorAntes.remove();
  } else if (espaciadorDespues && espaciadorDespues.classList.contains('row-spacer')) {
    espaciadorDespues.remove();
  }

  if (filaP) filaP.remove();
  if (filaR) filaR.remove();
}
