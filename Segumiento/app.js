document.addEventListener('DOMContentLoaded', () => {
  // 1. Cargar el nombre de la Unidad Responsable guardada
  cargarUnidadResponsable();

  // 2. Cargar las filas guardadas desde Programación
  cargarProgramacionParaSeguimiento();

  // 3. Listener para guardar el seguimiento
  const formSeg = document.getElementById('formSeguimiento');
  if (formSeg) {
    formSeg.addEventListener('submit', guardarSeguimiento);
  }
});

function cargarUnidadResponsable() {
  const datosLocales = localStorage.getItem('unidadResponsableData');
  if (datosLocales) {
    try {
      const dataUR = JSON.parse(datosLocales);
      const inputUR = document.getElementById('unidadResponsable');
      if (inputUR && dataUR.nombreUnidad) {
        inputUR.value = dataUR.nombreUnidad;
      }
    } catch (e) {
      console.error('Error al parsear unidadResponsableData:', e);
    }
  }
}

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

function cargarProgramacionParaSeguimiento() {
  const tbody = document.getElementById('bodySeguimiento');
  if (!tbody) return;

  let programacionData = null;
  const payloadGuardado = localStorage.getItem('programacionCompletaData');

  if (payloadGuardado) {
    try {
      const parsed = JSON.parse(payloadGuardado);
      programacionData = parsed.programacion;
    } catch (e) {
      console.error('Error al leer programacionCompletaData:', e);
    }
  }

  // Datos de respaldo si aún no se ha guardado nada en Programación
  if (!programacionData || programacionData.length === 0) {
    programacionData = [
      {
        proyecto: "4. Coadyuvar en la formación integral del estudiante, a través de la extensión y vinculación universitarias",
        lineaAccion: "4. Coadyuvar en la formación integral del estudiante, a través de la extensión y vinculación universitarias.",
        accionEstrategica: "Difundir, gestionar y acompañar en la promoción de la Oferta Educativa del Nivel Superior de la UAGro en la Región Acapulco - Coyuca de Benítez.",
        recursos: "CON RECURSOS ECONOMICOS",
        unidadMedida: "Visitas",
        p: [0, 0, 0, 0, 0, 0],
        r: [0, 0, 0, 0, 0, 0]
      }
    ];
  }

  tbody.innerHTML = '';

  programacionData.forEach((item, index) => {
    const id = index + 1;
    const mesNombres = ['ene', 'feb', 'mar', 'abr', 'may', 'jun'];

    // Textos informativos planos
    const txtProyecto = item.proyecto || '';
    const txtLinea = item.lineaAccion || item.linea || '';
    const txtAccion = item.accionEstrategica || item.accion || '';
    const txtRecursos = item.recursos || '';
    const txtUnidad = item.unidadMedida || '';

    // Valores de P (Lectura) y R (Edición)
    const pVals = Array.isArray(item.p) 
      ? item.p.slice(0, 6) 
      : mesNombres.map(m => item.programado?.meses?.[m] ?? 0);

    const rVals = Array.isArray(item.r) 
      ? item.r.slice(0, 6) 
      : mesNombres.map(m => item.realizado?.meses?.[m] ?? 0);

    const trP = document.createElement('tr');
    trP.className = 'var-row-p';
    trP.id = `seg-fila-${id}-p`;

    trP.innerHTML = `
      <td rowspan="2" class="col-proyecto cell-text">${txtProyecto}</td>
      <td rowspan="2" class="col-linea cell-text">${txtLinea}</td>
      <td rowspan="2" class="col-accion-est cell-text">${txtAccion}</td>
      <td rowspan="2" class="col-recursos cell-text">${txtRecursos}</td>
      <td rowspan="2" class="col-unidad cell-text">${txtUnidad}</td>
      <td class="col-var"><span class="badge-p">Programado</span></td>

      <!-- Meses 1er Semestre P (LECTURA Y PLACEHOLDER 0) -->
      ${pVals.map((val) => `
        <td>
          <input type="number" class="cal-input input-readonly seg-p-${id}" value="${val !== 0 && val !== '' ? val : ''}" placeholder="0" readonly title="Definido en Programación">
        </td>
      `).join('')}

      <!-- Seguimiento: Abs y % de Programado -->
      <td class="cell-bg-subp" id="seg-absP-${id}">0</td>
      <td class="cell-bg-subp" id="seg-pctP-${id}">0%</td>
    `;

    const trR = document.createElement('tr');
    trR.className = 'var-row-r';
    trR.id = `seg-fila-${id}-r`;

    trR.innerHTML = `
      <td class="col-var"><span class="badge-r">Realizado</span></td>

      <!-- Meses 1er Semestre R (EDITABLE CON PLACEHOLDER 0) -->
      ${rVals.map((val) => `
        <td>
          <input type="number" min="0" step="1" class="cal-input seg-r-${id}" value="${val !== 0 && val !== '' ? val : ''}" placeholder="0" onkeypress="return soloEnteros(event)" onpaste="return validarPegadoEnteros(event)" oninput="calcularTotalesSeguimiento(${id})">
        </td>
      `).join('')}

      <!-- Seguimiento: Abs y % de Realizado -->
      <td class="cell-bg-r" id="seg-absR-${id}">0</td>
      <td id="seg-pctR-${id}">0%</td>
    `;

    if (index > 0) {
      const trEspaciador = document.createElement('tr');
      trEspaciador.className = 'row-spacer';
      trEspaciador.innerHTML = `<td colspan="14"></td>`;
      tbody.appendChild(trEspaciador);
    }

    tbody.appendChild(trP);
    tbody.appendChild(trR);

    calcularTotalesSeguimiento(id);
  });
}

function calcularTotalesSeguimiento(id) {
  const pInputs = Array.from(document.querySelectorAll(`.seg-p-${id}`));
  const rInputs = Array.from(document.querySelectorAll(`.seg-r-${id}`));

  let subP = pInputs.reduce((sum, inp) => sum + (parseInt(inp.value, 10) || 0), 0);
  let subR = rInputs.reduce((sum, inp) => sum + (parseInt(inp.value, 10) || 0), 0);

  // % de Programado = Abs P * 100 / Abs P (siempre 100 si hay datos capturados)
  let pctP = subP > 0 ? ((subP / subP) * 100).toFixed(1) : 0;
  // % de Realizado = Abs R * 100 / Abs P (porcentaje real de cumplimiento)
  let pctR = subP > 0 ? ((subR / subP) * 100).toFixed(1) : 0;

  const cellAbsP = document.getElementById(`seg-absP-${id}`);
  const cellPctP = document.getElementById(`seg-pctP-${id}`);
  const cellAbsR = document.getElementById(`seg-absR-${id}`);
  const cellPctR = document.getElementById(`seg-pctR-${id}`);

  if (cellAbsP) cellAbsP.innerText = subP;
  if (cellAbsR) cellAbsR.innerText = subR;
  if (cellPctP) cellPctP.innerText = `${pctP}%`;

  if (cellPctR) {
    cellPctR.innerText = `${pctR}%`;
    cellPctR.className = '';

    if (pctR >= 80) {
      cellPctR.classList.add('pct-good');
    } else if (pctR >= 60) {
      cellPctR.classList.add('pct-warn');
    } else if (pctR > 40) {
      cellPctR.classList.add('pct-mid');
    } else {
      cellPctR.classList.add('pct-bad');
    }
  }
}

function guardarSeguimiento(e) {
  e.preventDefault();

  const filasP = document.querySelectorAll('#bodySeguimiento tr.var-row-p');
  const seguimientoResultados = [];

  filasP.forEach((trP, index) => {
    const id = index + 1;
    const rInputs = Array.from(document.querySelectorAll(`.seg-r-${id}`));
    const valoresR = rInputs.map(inp => parseInt(inp.value, 10) || 0);

    seguimientoResultados.push({
      accionIndex: index,
      realizadoSemestre1: valoresR,
      totalRealizado: parseInt(document.getElementById(`seg-absR-${id}`)?.innerText || 0),
      porcentajeEficacia: document.getElementById(`seg-pctR-${id}`)?.innerText || '0%'
    });
  });

  localStorage.setItem('seguimientoEneJunData', JSON.stringify(seguimientoResultados));
  alert('¡El 1er Seguimiento (Ene-Jun) ha sido guardado exitosamente!');
}