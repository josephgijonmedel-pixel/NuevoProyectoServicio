// Esto se ejecuta apenas se abre la página
document.addEventListener('DOMContentLoaded', () => {
  // 1. Cargar el dato de Unidad Responsable guardado en localStorage
  const datosLocales = localStorage.getItem('unidadResponsableData');
  if (datosLocales) {
    try {
      const dataUR = JSON.parse(datosLocales);
      const inputUR = document.getElementById('unidadResponsable');
      const sidebarUnidadNombre = document.getElementById('sidebarUnidadNombre');
      if (inputUR && dataUR.nombreUnidad) {
        inputUR.value = dataUR.nombreUnidad;
      }
      if (sidebarUnidadNombre && dataUR.nombreUnidad) {
        sidebarUnidadNombre.textContent = dataUR.nombreUnidad;
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
      window.location.href = '/Seguimiento/seguimiento.html';
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

// Estas dos funciones solo muestran y ocultan la ventana de confirmación
function abrirModalConfirmacion() {
  const modal = document.getElementById('modalConfirmarGuardar');
  const titulo = document.getElementById('modalConfirmTitulo');
  const icono = document.getElementById('modalConfirmIcon');
  const texto = document.getElementById('modalConfirmTexto');

  if (titulo) titulo.innerText = 'Confirmación';
  if (icono) icono.innerText = '⚠️';
  if (texto) texto.innerText = '¿Confirmar programación?';

  if (modal) modal.style.display = 'flex';
}

function cerrarModalConfirmacion() {
  const modal = document.getElementById('modalConfirmarGuardar');
  if (modal) modal.style.display = 'none';
}

// Busca lo que ya se había guardado antes; si no hay nada guardado, usa el dato de ejemplo
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

// Junta todo lo que se escribió en la tabla (cada acción con sus meses) y lo guarda
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

// Listas de opciones para los menús desplegables del formulario
const proyectosOptions = [
  "Responsabilidad Social y Ambiental",
  "Impulsar la digitalización de la gestión administrativa de la CGZS",
  "Redimensionar la gestión Institucional",
  "Coadyuvar en la formación integral del estudiante, a través de la extensión y vinculación universitarias"
];

const lineasAccionOptions = [
  "1. Responsabilidad Social y Ambiental",

  "1.1.1. Sensibilización y Formación en Responsabilidad Social. Implementar programas de sensibilización y formación dirigidos a la comunidad UAGro sobre la importancia de la responsabilidad social y ambiental. Se realizarán actividades de capacitación, charlas y campañas de concientización.",

  "1.2.1. Desarrollo de Proyectos y Programas Socioambientales. Fomentar la creación y desarrollo de proyectos y programas de responsabilidad social y ambiental que aborden problemáticas relevantes para la sociedad. Se impulsará la participación de estudiantes, docentes y personal administrativo en la concepción e implementación de estas iniciativas.",

  "1.3.1. Promoción de la Participación Activa. Estimular la participación activa de la comunidad UAGro en proyectos y programas de responsabilidad social y ambiental. Se crearán espacios y plataformas para que los miembros de la comunidad puedan involucrarse y contribuir con sus ideas y esfuerzos.",

  "1.4.1. Implementación de Prácticas Sustentables en la Gestión Universitaria. Promover la implementación de prácticas sustentables en la gestión universitaria en aspectos como la gestión de residuos, el uso eficiente de recursos y la movilidad sustentable, entre otros. Se establecerán políticas y acciones concretas para reducir el impacto ambiental de la universidad.",

  "1.5.1. Formación de Profesionales Comprometidos. Introducir la responsabilidad social y ambiental como un eje transversal en la formación de profesionales en la UAGro. Se incorporarán contenidos curriculares relacionados con estas temáticas y se promoverá la participación en actividades extracurriculares relacionadas con la responsabilidad social.",

  "1.6.1. Evaluación y Mejora Continua. Establecer mecanismos  de evaluación periódica para medir el avance y los resultados de los proyectos y programas de responsabilidad social y ambiental. Se utilizarán indicadores de desempeño para retroalimentar y mejorar continuamente las acciones implementadas.",

  "1.7.1. Alianzas Estratégicas. Establecer alianzas con organizaciones y entidades del sector público y privado que compartan los mismos valores y objetivos en materia de responsabilidad social y ambiental. Se buscarán sinergias para fortalecer la capacidad de la UAGro en este ámbito y ampliar el impacto de las acciones.",
  "2. Impulsar la digitalización de la gestión  administrativa  de la CGZS",
  "2.1.1. Fortalecimiento de la Infraestructura Tecnológica. Mejorar y actualizar la infraestructura tecnológica de la universidad, incluyendo redes de alta velocidad, sistemas de almacenamiento y seguridad informática, para garantizar una base sólida para la digitalización integral.",
  "2.2.1. Capacitación en Competencias Digitales. Brindar capacitación y formación en competencias digitales al personal administrativo, para que estén preparados para utilizar eficazmente las herramientas digitales en sus labores educativas y administrativas.",

  "2.3.1. Digitalización de Procesos Administrativos. Optimizar los procesos administrativos mediante la digitalización de trámites, gestión de recursos humanos y finanzas, entre otros, para mejorar la eficiencia y reducir tiempos y costos.",

  "2.4.1. Evaluación y Seguimiento de la Transformación Digital. Establecer un sistema de evaluación y seguimiento periódico para medir el avance y el impacto de la transformación digital, los procesos administrativos y la satisfacción de los usuarios.",

  "3. Redimensionar la gestión Institucional",

  "3.1.1. Optimización de Procesos Administrativos. Realizar una revisión exhaustiva de los procesos administrativos y de gestión en la CGZS para identificar áreas de mejora y oportunidades de optimización. Implementar cambios y actualizaciones para asegurar la eficiencia, eficacia y efectividad en el uso de los recursos.",

  "3.2.1. Establecimiento de Políticas Transparentes. Desarrollar y difundir políticas y procedimientos claros y transparentes para la toma de decisiones en la gestión de los medios necesarios para el funcionamiento óptimo de la Universidad. Esto incluirá la definición de criterios de asignación de recursos y el establecimiento de mecanismos de rendición de cuentas.",

  "3.3.1 Implementación de Sistemas de Control y Seguimiento. Establecer sistemas y herramientas de control y seguimiento para asegurar la transparencia en el uso de los recursos en la CGZS. Esto incluirá la implementación de tecnologías de información que permitan el monitoreo de los gastos y la gestión financiera.",

  "3.4.1.  Promoción de la Ética y la Integridad.  Fomentar una cultura de ética y responsabilidad en la gestión de los recursos de la universidad. Implementar programas de formación y capacitación en ética administrativa y promover cultura de la rendición de cuentas en todos los niveles de la institución.",

  "3.5.1. Capacitación en Administración Eficiente. Desarrollar programas de capacitación y formación en administración y gestión eficiente, eficaz y efectiva para el personal de la CGZS. Esto incluirá cursos y talleres sobre buenas prácticas en la administración de recursos, manejo de presupuestos, planificación estratégica, entre otros.",

  "3.6.1. Identidad Institucional. Fomentar la identidad institucional en todos los trabajadores de las coordinaciones y áreas de la CGZS, con la finalidad que todo el personal de la CGZS conozca y se identifique con la Visión, Misión y Principios Institucionales, así como con el Código de Ética.",

  "3.6.2. Promover el trabajo colaborativo, integral, sistemático y planeativo de toda la CGZS. A través de la participación para elaborar los Planes de Trabajo y Programas Operativos Anuales, se fomentará el trabajo colaborativo entre las diferentes áreas de una coordinación y entre coordinaciones.",

  "4. Coadyuvar en la formación integral del estudiante, a través de la extensión y vinculación universitarias",

  "4.1.1. Catálogo de Servicios Actualizado. Desarrollar y difundir a través del Catálogo en todas las Unidades Académicas de las regiones de Costa Chica, Costa Grande y Acapulco los servicios que ofrece la Coordinación de Extensión.",

  "4.2.1. Formación de extensionistas. Implementar programas de capacitación para la formación de extensionistas en cada Unidad Académica de la Zona Sur con la finalidad de difundir y promover el arte, la cultura, la poesía, la oratoria, así como el deporte, que contribuyan a la formación integral de los estudiantes.",

  "4.3.1. Expresiones diversas en eventos de importancia regional. Representar a la Universidad a través de estudiantes de EMS y Superior con participaciones artísticas, culturales, deportivas, científicas y tecnológicas, etc., en eventos de importancia regional.",

  "4.4.1. Conformar consejos de vinculación en las unidades académicas (Coordinadores de PE y de CA) con la CGZS y que estos promuevan: 1.- La revisión de las LGAC que desarrollan los CA, con la finalidad de incorporar líneas de investigación tendientes a la transmisión del conocimiento al Sector Productivo y de servicio, 2.- Revisión de Planes y programas de los PE que incorporen competencias y unidades de aprendizaje relacionadas con el sector productivo y de servicios, 3.- Revisión de la pertinencia del PE.",

];

const unidadesMedidaOptions = [
  "Actualizaciones", "Bazares", "Catálogos", "Charlas", "Coloquios", "Concursos",
  "Convenios", "Digitalizaciones", "Docentes", "Encuestas", "Equipos de cómputo",
  "Estudiantes", "Evaluaciones", "Eventos Académicos", "Eventos Artísticos",
  "Expedientes", "Exposiciones", "Gestiones", "Oficios", "Procesos y Procedimientos",
  "Registros", "Reportes", "Reuniones", "Seguimiento", "Simulacros", "Talleres",
  "Utensilios", "Visitas", "Otros"
];

// Acción de ejemplo que aparece solo si todavía no se ha guardado nada
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

// Arma las opciones de un menú desplegable a partir de una lista
function crearOpcionesSelect(lista, valorSeleccionado) {
  return lista.map(item => `<option value="${item}" ${item === valorSeleccionado ? 'selected' : ''}>${item}</option>`).join('');
}

// Crea una acción nueva en la tabla: una fila de Programado y una de Realizado
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
  aplicarPorcentaje(inputPctPSem, pctPSem, 'cell-bg-subp');
  aplicarPorcentaje(inputPctRSem, pctRSem, 'cell-bg-r');

  // Lo mismo, pero para el segundo semestre
  let pctPSem2 = subP2 > 0 ? ((subP2 / subP2) * 100).toFixed(1) : 0;
  let pctRSem2 = subP2 > 0 ? ((subR2 / subP2) * 100).toFixed(1) : 0;
  aplicarPorcentaje(inputPctPSem2, pctPSem2, 'cell-bg-subp');
  aplicarPorcentaje(inputPctRSem2, pctRSem2, 'cell-bg-r');

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
  aplicarPorcentaje(inputPctPAnual, pctPAnual, 'cell-bg-totp');
  aplicarPorcentaje(inputPctRAnual, pctRAnual, 'cell-bg-r');
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
    td.classList.add('pct-good');
  } else if (pct >= 50) {
    td.classList.add('pct-warn');
  } else {
    td.classList.add('pct-bad');
  }
}

// Borra una acción completa de la tabla (su fila de arriba, la de abajo y el espacio)
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

// Abre y cierra el menú lateral de navegación (botón de tres líneas)
document.addEventListener('DOMContentLoaded', () => {
  const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
  const sidebarOverlay = document.getElementById('sidebarOverlay');

  function cerrarSidebar() {
    document.body.classList.remove('sidebar-open');
    if (sidebarToggleBtn) sidebarToggleBtn.setAttribute('aria-expanded', 'false');
  }

  function abrirSidebar() {
    document.body.classList.add('sidebar-open');
    if (sidebarToggleBtn) sidebarToggleBtn.setAttribute('aria-expanded', 'true');
  }

  if (sidebarToggleBtn) {
    sidebarToggleBtn.addEventListener('click', () => {
      if (document.body.classList.contains('sidebar-open')) {
        cerrarSidebar();
      } else {
        abrirSidebar();
      }
    });
  }

  if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', cerrarSidebar);
  }

  // Si ya estás en esa página, el enlace activo no debe recargarla
  const sidebarActiveLink = document.querySelector('.sidebar-link.sidebar-link-active');
  if (sidebarActiveLink) {
    sidebarActiveLink.addEventListener('click', (e) => {
      e.preventDefault();
      cerrarSidebar();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cerrarSidebar();
  });
});
