// Archivo PHP que lee (GET) y guarda (POST) la programación en la base de datos
const API_PROGRAMACION = '../php/programacion.php';
const PAGINA_LOGIN = '../InicioSesion/inicioSesion.html';

// Listas de opciones (proyectos, líneas de acción, unidades de medida); llegan del servidor
let catalogos = { proyectos: [], lineas: [], unidades: [] };

let contadorFilas = 0;


// Columnas de texto libre que van después del Total Anual.
// Cada nombre es igual a su columna en la tabla acciones_estrategicas.
const CAMPOS_COMPLEMENTARIOS = ['beneficiados', 'responsables', 'participantes', 'observaciones_generales'];

// Máximo de proyectos estratégicos (filas) que puede tener el PTA de un área.
// El servidor revisa el mismo límite en php/programacion.php.
const MAX_PROYECTOS = 4;

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

  // Agregar otra fila solo si todavía no llega al máximo de proyectos estratégicos
  btnAgregar.addEventListener('click', () => {
    const filas = document.querySelectorAll('#cuerpoProgramacion .fila-programado').length;
    if (filas >= MAX_PROYECTOS) {
      mostrarMensaje(`Solo puedes tener un máximo de ${MAX_PROYECTOS} proyectos estratégicos en tu PTA.`, 'error');
      return;
    }
    agregarFilaAccion();
  });

  btnGuardarProg.addEventListener('click', (e) => {
    e.preventDefault();
    if (validarFilas()) abrirModalConfirmacion(mensajeConfirmacion());
  });

  formProg.addEventListener('submit', (e) => {
    e.preventDefault();
    if (validarFilas()) abrirModalConfirmacion(mensajeConfirmacion());
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
function abrirModalConfirmacion(mensaje) {
  const modal = document.getElementById('ventanaConfirmar');
  const titulo = document.getElementById('ventanaTitulo');
  const icono = document.getElementById('ventanaIcono');
  const texto = document.getElementById('ventanaTexto');

  if (titulo) titulo.innerText = 'Confirmación';
  if (icono) icono.innerText = ' ';
  if (texto) texto.innerText = mensaje;

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
    mostrarAnioEncabezado(resultado.anio);

    const acciones = resultado.acciones.length > 0 ? resultado.acciones : [null];
    acciones.forEach(accion => agregarFilaAccion(accion));

    mostrarEstadoPlan(resultado.plan);

    // Planeación finalizó el PTA del año: todo queda de solo lectura
    if (resultado.finalizado) {
      mostrarPTAFinalizado(resultado.anio);
      return;
    }

    // Planeación inició un PTA nuevo y esta área todavía no guarda su Programación de ese año.
    // Sale solo una vez por inicio de sesión, y deja de salir en cuanto el área guarda su Programación.
    if (!resultado.plan && !ventanaNuevoPTAYaVista(resultado.anio)) {
      mostrarVentanaNuevoPTA(resultado.anio);
      marcarVentanaNuevoPTAVista(resultado.anio);
    }
  } catch (error) {
    mostrarMensaje(error.message, 'error');
  }
}

// Vuelve a pedir lo realizado al servidor y actualiza solo la fila "Realizado" de cada acción
// (lo programado no se toca, por si hay cambios sin guardar).
async function actualizarRealizado() {
  if (!document.querySelector('#cuerpoProgramacion tr.fila-programado')) return; // la tabla aún no carga
  try {
    const resultado = await leerRespuesta(await fetch(API_PROGRAMACION));
    const realizadoPorAccion = new Map(resultado.acciones.map(a => [String(a.id), a.r]));

    filasDeAcciones().forEach(trP => {
      const r = realizadoPorAccion.get(trP.dataset.accionId);
      if (!r) return; // acción nueva que todavía no se guarda
      const fila = trP.dataset.fila;
      document.querySelectorAll(`.input-r-${fila}`).forEach((input, mes) => { input.value = r[mes] || 0; });
      calcularTotales(fila);
    });
  } catch (error) { /* si falla, se queda lo que ya se mostraba */ }
}

// Cuándo se actualiza lo realizado:
//  al regresar a esta pestaña o a esta página con el botón "Atrás"
document.addEventListener('DOMContentLoaded', () => {
  try {
    new BroadcastChannel('pta-realizado').addEventListener('message', actualizarRealizado);
  } catch (e) { /* navegador sin BroadcastChannel */ }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') actualizarRealizado();
  });
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) actualizarRealizado(); // la página salió de la memoria del navegador
  });
});

// Memoria de "ya se mostró la ventana del nuevo PTA" (sessionStorage: dura mientras la pestaña
// esté abierta; la página de inicio de sesión la borra para que vuelva a salir al siguiente ingreso).
const CLAVE_VENTANA_NUEVO_PTA = 'ventanaNuevoPTAVista';

function ventanaNuevoPTAYaVista(anio) {
  try {
    return sessionStorage.getItem(CLAVE_VENTANA_NUEVO_PTA) === String(anio);
  } catch (e) {
    return false; // si el navegador no deja usar sessionStorage, se muestra
  }
}

function marcarVentanaNuevoPTAVista(anio) {
  try { sessionStorage.setItem(CLAVE_VENTANA_NUEVO_PTA, String(anio)); } catch (e) { /* sin memoria */ }
}

// Ventana flotante "Iniciaste un nuevo PTA". Se cierra con Entendido, ✕, Esc o clic fuera.
function mostrarVentanaNuevoPTA(anio) {
  const ventana = document.getElementById('ventanaNuevoPTA');
  if (!ventana) return;

  document.getElementById('textoNuevoPTA').innerText =
    `Iniciaste un nuevo PTA ${anio}.

Captura tus acciones y guarda tu Programación.`;
  ventana.style.display = 'flex';

  const cerrar = () => {
    ventana.style.display = 'none';
    document.removeEventListener('keydown', cerrarConEsc);
  };
  const cerrarConEsc = (e) => { if (e.key === 'Escape') cerrar(); };

  document.getElementById('btnEntendidoNuevoPTA').onclick = cerrar;
  document.getElementById('btnCerrarNuevoPTA').onclick = cerrar;
  ventana.onclick = (e) => { if (e.target === ventana) cerrar(); };
  document.addEventListener('keydown', cerrarConEsc);
  document.getElementById('btnEntendidoNuevoPTA').focus();
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

    // Se recarga Inicio: el PTA aparece "En revisión" y bloqueado
    window.location.reload();
  } catch (error) {
    marcarErroresDelServidor(error.errores);
    mostrarMensaje(error.message, 'error', error.errores);
    btnGuardarProg.disabled = false;
  }
}

// Texto de la ventana de confirmación según lo que se va a guardar
function mensajeConfirmacion() {
  return '¿Enviar tu PTA a Planeación para su revisión? Mientras lo revisa no podrás modificarlo.';
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
      p: Array.from(document.querySelectorAll(`.input-p-${id}`)).map(input => parseInt(input.value, 10) || 0),
      // beneficiados, responsables, participantes, observaciones_generales
      ...Object.fromEntries(CAMPOS_COMPLEMENTARIOS.map(campo =>
        [campo, trP.querySelector(`textarea[name="${campo}_${id}"]`).value.trim()]))
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

// Habilita los botones, o bloquea la tabla si el PTA final ya se envió a Planeación
function mostrarEstadoPlan(plan) {
  const btnAgregar = document.getElementById('btnAgregarAccion');
  const btnGuardarProg = document.getElementById('btnGuardarProgramacion');

  // En revisión o aceptado: todo bloqueado (lo realizado siempre es de solo lectura aquí)
  if (plan && !plan.editable) {
    bloquearProgramacion();
    btnAgregar.style.display = 'none';
    btnGuardarProg.style.display = 'none';
    if (plan.estado === 'APROBADO') {
      mostrarMensaje('PTA aceptado. Ya puedes avanzar con los seguimientos.', 'exito');
    } else {
      mostrarMensaje('Tu PTA se envió a Planeación y está en revisión. ' +
        'Podrás capturar tus avances cuando lo acepte.', 'info');
    }
    return;
  }

  // Rechazado: se puede corregir y volver a enviar
  if (plan && plan.estado === 'CON OBSERVACIONES') {
    mostrarMensaje('PTA rechazado. Corrígelo y vuelve a guardarlo para enviarlo a revisión.\n' +
      'Motivo: ' + (plan.observaciones || 'sin motivo indicado'), 'error');
  }

  btnAgregar.disabled = false;
  btnGuardarProg.disabled = false;
}

// PTA finalizado por Planeación: se bloquea todo y se avisa
function mostrarPTAFinalizado(anio) {
  bloquearProgramacion();
  document.getElementById('btnAgregarAccion').style.display = 'none';
  document.getElementById('btnGuardarProgramacion').style.display = 'none';
  mostrarMensaje(`Planeación finalizó el PTA ${anio}. Ya no se puede modificar.`, 'info');
}

// Deja toda la Programación de solo lectura: datos de cada acción, meses programados
// y Beneficiados, Responsable(s), Participantes y Observaciones Generales.
function bloquearProgramacion() {
  const selector = [
    '#cuerpoProgramacion select',
    '#cuerpoProgramacion textarea',
    '#cuerpoProgramacion .fila-programado input.campo-mes:not(.campo-bloqueado)'
  ].join(', ');
  document.querySelectorAll(selector).forEach(campo => {
    campo.disabled = true;
    campo.classList.add('campo-bloqueado');
    campo.title = 'La Programación ya se guardó; esto ya no se puede modificar';
  });
  document.querySelectorAll('#cuerpoProgramacion .boton-quitar').forEach(boton => { boton.style.display = 'none'; });
}

// Muestra un aviso arriba de la tabla. tipo: 'error' (rojo) o 'info' (azul)
function mostrarMensaje(texto, tipo, errores) {
  const cajaAvisos = document.getElementById('cajaAvisos');
  if (!cajaAvisos) return;

  const estilos = {
    error: [' ', 'caja-aviso'],
    info: [' ', 'caja-aviso aviso-info'],
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
      ['select[name^="unidadMedida_"]', 'unidad de medida'],
      // Obligatorios también: Beneficiados, Responsable(s), Participantes y Observaciones Generales
      ['textarea[name^="beneficiados_"]', 'Beneficiados'],
      ['textarea[name^="responsables_"]', 'Responsable(s)'],
      ['textarea[name^="participantes_"]', 'Participantes'],
      ['textarea[name^="observaciones_generales_"]', 'Observaciones Generales']
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
    unidad_medida_id: 'select[name^="unidadMedida_"]',
    ...Object.fromEntries(CAMPOS_COMPLEMENTARIOS.map(campo => [campo, `textarea[name^="${campo}_"]`]))
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

// Opciones de líneas de acción: solo las del proyecto elegido
function opcionesLineas(proyectoId, lineaSeleccionada) {
  if (!proyectoId) {
    return '<option value="">Seleccione primero un proyecto</option>';
  }
  const lineas = catalogos.lineas.filter(l => Number(l.proyecto_id) === Number(proyectoId));
  return crearOpciones(lineas, textoLinea, lineaSeleccionada, 'Seleccione una línea de acción');
}

// Al cambiar el proyecto de una fila, su lista de líneas de acción se actualiza
function cambiarProyecto(id) {
  const proyectoId = document.querySelector(`select[name="proyecto_${id}"]`).value;
  const selectLinea = document.querySelector(`select[name="lineaAccion_${id}"]`);
  selectLinea.innerHTML = opcionesLineas(proyectoId, null);
  selectLinea.classList.remove('campo-error');
}

// Crea una acción en la tabla: una fila de Programado y una de Realizado.
// data viene del servidor: {id, proyecto_id, linea_id, descripcion, con_recursos, unidad_medida_id,
//                           beneficiados, responsables, participantes, observaciones_generales, p[12], r[12]}
function agregarFilaAccion(data = null) {
  contadorFilas++;
  const id = contadorFilas;
  const tbody = document.getElementById('cuerpoProgramacion');

  if (!tbody) {
    console.error('El elemento <tbody> con id="cuerpoProgramacion" no existe en el HTML.');
    return;
  }

  const esPrimeraAccion = tbody.children.length === 0;

  // Valores de los 12 meses (ENE a DIC) con los que se llenan los inputs de los meses:
  // pVals = Programado (lo escribe el área) y rVals = Realizado (viene de los seguimientos)
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
      <select class="campo-tabla" name="proyecto_${id}" onchange="cambiarProyecto(${id})">
        ${crearOpciones(catalogos.proyectos, p => `${p.clave}. ${p.nombre}`, data ? data.proyecto_id : null, 'Seleccione un proyecto')}
      </select>
    </td>
    <td rowspan="2">
      <select class="campo-tabla" name="lineaAccion_${id}">
        ${opcionesLineas(data ? data.proyecto_id : null, data ? data.linea_id : null)}
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

    <!-- Inputs de los meses ENE a JUN (Programado): se crea un input por mes; solo acepta enteros y recalcula los totales -->
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

    <!-- Inputs de los meses JUL a DIC (Programado): se crea un input por mes; idx + 6 para que JUL sea el mes 7 -->
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

    <!-- Datos complementarios de la acción (texto libre); ocupan las dos filas, como las primeras columnas -->
    ${CAMPOS_COMPLEMENTARIOS.map(campo => `
      <td rowspan="2" class="celda-complementaria">
        <textarea class="campo-tabla campo-complementario" name="${campo}_${id}" maxlength="2000">${escaparHtml(data ? data[campo] : '')}</textarea>
      </td>
    `).join('')}

    <td rowspan="2">
      <button type="button" class="boton-quitar" onclick="eliminarFila(${id})">✕</button>
    </td>
  `;

  const trR = document.createElement('tr');
  trR.className = 'fila-realizado';
  trR.id = `fila-${id}-r`;

  trR.innerHTML = `
    <td style="text-align:center;"><span class="etiqueta-realizado">Realizado</span></td>

    <!-- Inputs de los meses ENE a JUN (Realizado): bloqueados, se llenan desde el Primer seguimiento -->
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

    <!-- Inputs de los meses JUL a DIC (Realizado): bloqueados, se llenan desde el Segundo seguimiento -->
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
    trEspaciador.innerHTML = `<td colspan="29"></td>`;
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
  colorearPorcentajeRealizado(inputPctRSem, pctRSem);

  // Lo mismo, pero para el segundo semestre
  let pctPSem2 = subP2 > 0 ? ((subP2 / subP2) * 100).toFixed(1) : 0;
  let pctRSem2 = subP2 > 0 ? ((subR2 / subP2) * 100).toFixed(1) : 0;
  aplicarPorcentaje(inputPctPSem2, pctPSem2, 'celda-subtotal');
  colorearPorcentajeRealizado(inputPctRSem2, pctRSem2);

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
  colorearPorcentajeRealizado(inputPctRAnual, pctRAnual);
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
  } else if (pct >= 40) {
    td.classList.add('pct-regular');
  } else {
    td.classList.add('pct-bajo');
  }
}

// % de Realizado: pinta el cuadro del número con la misma clasificación de colores
// que los seguimientos (verde, amarillo, naranja o rojo)
function colorearPorcentajeRealizado(input, pct) {
  if (!input) return;
  input.value = `${pct}%`;
  input.classList.remove('pct-bueno', 'pct-regular', 'pct-medio', 'pct-bajo');
  input.classList.add(clasePorcentaje(Number(pct)));
  const td = input.closest('td');
  if (td) td.className = 'celda-realizado';
}

// Clasificación de colores (igual que en Seguimiento y Segundo seguimiento)
function clasePorcentaje(pct) {
  if (pct >= 80) return 'pct-bueno';
  if (pct >= 60) return 'pct-regular';
  if (pct > 30) return 'pct-medio';
  return 'pct-bajo';
}

// Borra una acción completa de la tabla (su fila de arriba, la de abajo y el espacio).
// El borrado en la base de datos ocurre al presionar "Guardar Programación".
function eliminarFila(id) {
  const filaP = document.getElementById(`fila-${id}-p`);
  const filaR = document.getElementById(`fila-${id}-r`);

  // Si la acción ya tiene avances capturados en los seguimientos, pedir confirmación
  const totalRealizado = parseInt(document.getElementById(`total-r-${id}`)?.innerText, 10) || 0;
  if (totalRealizado > 0 && !confirm('Esta acción ya tiene avances capturados. Al guardar se borrarán también. ¿Quitarla?')) {
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

// Muestra la opción "Ver áreas" del menú solo a la cuenta de Planeación
document.addEventListener('DOMContentLoaded', async () => {
  const opcion = document.getElementById('menuVerAreas');
  if (!opcion) return;
  try {
    const respuesta = await fetch('../php/usuario.php');
    if (respuesta.ok && (await respuesta.json()).esPlaneacion) opcion.hidden = false;
  } catch (e) { /* si falla, la opción simplemente queda oculta */ }
});

// Año del PTA en el encabezado (el <span id="anioEncabezado"> del <h2>)
function mostrarAnioEncabezado(anio) {
  const span = document.getElementById('anioEncabezado');
  if (span) span.textContent = anio;
}
