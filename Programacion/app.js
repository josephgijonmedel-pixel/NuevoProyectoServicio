// Archivo PHP que lee (GET) y guarda (POST) la programación en la base de datos
const API_PROGRAMACION = '../php/programacion.php';
const PAGINA_LOGIN = '../InicioSesion/inicioSesion.html';

// Listas de opciones (proyectos, líneas de acción, unidades de medida); llegan del servidor
let catalogos = { proyectos: [], lineas: [], unidades: [] };

let contadorFilas = 0;


// Columnas de texto libre que van después del Total Anual.
// Cada nombre es igual a su columna en la tabla acciones_estrategicas.
const CAMPOS_COMPLEMENTARIOS = ['beneficiados', 'responsables', 'participantes', 'observaciones_generales'];

// Filas vacías con las que empieza la tabla al crear el PTA
const FILAS_INICIALES = 12;

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

  // Agregar otra fila: sin límite de proyectos estratégicos (mínimo 1, se revisa al guardar)
  btnAgregar.addEventListener('click', () => agregarFilaAccion());

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
  if (icono) icono.innerText = '';
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

    // Al crear el PTA (todavía sin acciones guardadas) se empieza con FILAS_INICIALES filas vacías.
    // Las filas que se queden vacías no se guardan ni se revisan (ver filasConDatos).
    const acciones = resultado.acciones.length > 0 ? resultado.acciones : Array(FILAS_INICIALES).fill(null);
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
  return filasConDatos().map((trP) => {
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

// ¿Ya se mostró el aviso "PTA aceptado" de este plan? Se recuerda en el navegador (localStorage).
// Si el navegador no deja guardarlo, el aviso simplemente vuelve a salir.
const CLAVE_AVISO_ACEPTADO = 'avisoPTAAceptadoVisto';
function avisoAceptadoYaVisto(planId) {
  try { return localStorage.getItem(`${CLAVE_AVISO_ACEPTADO}_${planId}`) === '1'; } catch (e) { return false; }
}
function marcarAvisoAceptadoVisto(planId) {
  try { localStorage.setItem(`${CLAVE_AVISO_ACEPTADO}_${planId}`, '1'); } catch (e) { /* sin almacenamiento: no pasa nada */ }
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
      // El aviso de "aceptado" sale solo la primera vez que el área ve su PTA aceptado
      if (!avisoAceptadoYaVisto(plan.id)) {
        mostrarMensaje('PTA aceptado. Ya puedes avanzar con los seguimientos.', 'exito');
        marcarAvisoAceptadoVisto(plan.id);
      }
    } else {
      mostrarMensaje('Tu PTA se envió a Planeación y está en revisión. ' +
        'Podrás capturar tus avances cuando lo acepte.', 'info');
    }
    return;
  }

  // Rechazado: se puede corregir y volver a enviar
  if (plan && plan.estado === 'CON OBSERVACIONES') {
    mostrarMensaje('PTA rechazado.\n' +
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
    error: ['', 'caja-aviso'],
    info: ['', 'caja-aviso aviso-info'],
    exito: ['', 'caja-aviso aviso-exito']
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
  const todas = filasDeAcciones();
  const filas = filasConDatos();   // las filas que siguen vacías no se revisan
  const faltantes = [];

  document.querySelectorAll('#cuerpoProgramacion .campo-error').forEach(el => el.classList.remove('campo-error'));

  if (filas.length === 0) {
    mostrarMensaje('Agrega al menos una acción estratégica.', 'error');
    return false;
  }

  filas.forEach((trP) => {
    const i = todas.indexOf(trP);   // número de la fila en la tabla (para el mensaje "Acción N")
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
  const filas = filasConDatos();   // el servidor numera solo las filas que se enviaron
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

// Filas en las que el área ya escribió o eligió algo (o que ya estaban guardadas).
// Las que siguen completamente vacías se ignoran al guardar: así sobran filas sin estorbar.
function filasConDatos() {
  return filasDeAcciones().filter(trP => {
    if (trP.dataset.accionId) return true;   // acción ya guardada: siempre cuenta
    const id = trP.dataset.fila;
    const textos = trP.querySelectorAll('textarea');
    const selects = ['proyecto_', 'lineaAccion_', 'unidadMedida_']
      .map(nombre => trP.querySelector(`select[name="${nombre}${id}"]`));
    const meses = document.querySelectorAll(`.input-p-${id}`);
    return [...textos].some(t => t.value.trim() !== '')
      || selects.some(sel => sel && sel.value !== '')
      || [...meses].some(m => m.value.trim() !== '' && Number(m.value) !== 0);
  });
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
  mostrarLineaCompleta(id);
}

// Escribe debajo del select el texto completo de la línea de acción elegida (el select lo corta)
function mostrarLineaCompleta(id) {
  const select = document.querySelector(`select[name="lineaAccion_${id}"]`);
  const div = document.getElementById(`lineaCompleta_${id}`);
  if(!select || !div)return;
  div.textContent = select.value ? select.options[select.selectedIndex].text : '';

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
    <!-- No.: número de la acción. Lo pone el CSS (contador), así se renumera solo al agregar o quitar filas -->
    <td rowspan="2" class="col-numero"></td>
    <td rowspan="2">
      <select class="campo-tabla" name="proyecto_${id}" onchange="cambiarProyecto(${id})">
        ${crearOpciones(catalogos.proyectos, p => `${p.clave}. ${p.nombre}`, data ? data.proyecto_id : null, 'Seleccione un proyecto')}
      </select>
    </td>
    <td rowspan="2">
      <select class="campo-tabla" name="lineaAccion_${id}" onchange="mostrarLineaCompleta(${id})">
        ${opcionesLineas(data ? data.proyecto_id : null, data ? data.linea_id : null)}
      </select>
      <!-- Texto completo de la linea de accion elegida -->
      <div class="texto-linea-completa" id="lineaCompleta_${id}"> </div>
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
    trEspaciador.innerHTML = `<td colspan="30"></td>`;
    tbody.appendChild(trEspaciador);
  }

  tbody.appendChild(trP);
  tbody.appendChild(trR);

  calcularTotales(id);
  //Mostrar completa la linea de accion
  mostrarLineaCompleta(id);
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

  // Cada cambio en una acción también cambia el total de toda el área
  calcularTotalesArea();
}

// Fila "TOTAL DE LA UNIDAD RESPONSABLE" (tfoot):
//   Abs           → suma de los Abs de TODAS las acciones
//   % Realizado   → suma de los % de Realizado de cada acción ÷ número de acciones (promedio)
//   % Programado  → 100% si hay algo programado
function calcularTotalesArea() {
  let p1 = 0, r1 = 0, p2 = 0, r2 = 0;

  document.querySelectorAll('#cuerpoProgramacion tr.fila-programado').forEach(trP => {
    const id = trP.dataset.fila;
    p1 += Number(document.getElementById(`subtotal-p-sem-${id}`)?.value) || 0;
    r1 += Number(document.getElementById(`subtotal-r-sem-${id}`)?.value) || 0;
    p2 += Number(document.getElementById(`subtotal-p-sem2-${id}`)?.value) || 0;
    r2 += Number(document.getElementById(`subtotal-r-sem2-${id}`)?.value) || 0;
  });

  const pt = p1 + p2, rt = r1 + r2;
  const pct = (r, p) => p > 0 ? (r * 100 / p).toFixed(1) : 0;

  document.getElementById('area-abs-p1').value = p1;
  document.getElementById('area-abs-r1').value = r1;
  document.getElementById('area-abs-p2').value = p2;
  document.getElementById('area-abs-r2').value = r2;
  document.getElementById('area-abs-pt').value = pt;
  document.getElementById('area-abs-rt').value = rt;

  aplicarPorcentaje(document.getElementById('area-pct-p1'), pct(p1, p1), 'celda-subtotal');
  aplicarPorcentaje(document.getElementById('area-pct-p2'), pct(p2, p2), 'celda-subtotal');
  aplicarPorcentaje(document.getElementById('area-pct-pt'), pct(pt, pt), 'celda-total');
  // % de Realizado: promedio de los % de cada acción. Solo cuentan las acciones con datos
  // (las filas vacías de sobra no bajan el promedio)
  const filas = filasConDatos();
  const promedioPct = (prefijo) => {
    if (filas.length === 0) return 0;
    const suma = filas.reduce((total, trP) =>
      total + (parseFloat(document.getElementById(`${prefijo}-${trP.dataset.fila}`)?.value) || 0), 0);   // parseFloat ignora el "%"
    return (suma / filas.length).toFixed(1);
  };
  colorearPorcentajeRealizado(document.getElementById('area-pct-r1'), promedioPct('pct-r-sem'));
  colorearPorcentajeRealizado(document.getElementById('area-pct-r2'), promedioPct('pct-r-sem2'));
  colorearPorcentajeRealizado(document.getElementById('area-pct-rt'), promedioPct('pct-r-anual'));
}

// Si llenan una fila vacía (eligen un proyecto, escriben la acción...), esa fila ya cuenta
// en el promedio: se recalcula el total del área
document.getElementById('cuerpoProgramacion')?.addEventListener('change', calcularTotalesArea);

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
async function eliminarFila(id) {
  const filaP = document.getElementById(`fila-${id}-p`);
  const filaR = document.getElementById(`fila-${id}-r`);

  // Si la acción ya tiene avances capturados en los seguimientos, pedir confirmación
  const totalRealizado = parseInt(document.getElementById(`total-r-${id}`)?.innerText, 10) || 0;
  if (totalRealizado > 0 && !await confirmar({
    titulo: 'Quitar acción',
    texto: 'Esta acción ya tiene avances capturados. Al guardar se borrarán también.\n\n¿Quitarla?',
    botonConfirmar: 'Quitar',
    peligro: true
  })) {
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

  // Descontar del total del área la acción que se quitó
  calcularTotalesArea();
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
    if (respuesta.ok && (await respuesta.json()).esPlaneacion) {
      opcion.hidden = false;
      // "Mis Planes de trabajo" (historial de PTA): también solo para Planeación
      const misPlanes = document.getElementById('menuMisPlanes');
      if (misPlanes) misPlanes.hidden = false;
    }
  } catch (e) { /* si falla, la opción simplemente queda oculta */ }
});

// Año del PTA en el encabezado (el <span id="anioEncabezado"> del <h2>)
function mostrarAnioEncabezado(anio) {
  const span = document.getElementById('anioEncabezado');
  if (span) span.textContent = anio;
}

// ---------------------------------------------------------------------
// Notas de ayuda de los encabezados (íconos "i", las mismas del formato de Excel del PTA).
// Se usa un solo globo flotante pegado al <body> para que la tabla (que tiene scroll) no lo corte.
// ---------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  const iconos = document.querySelectorAll('.tooltip-campo');
  if (!iconos.length) return;

  const globo = document.createElement('div');
  globo.className = 'globo-tooltip';
  globo.setAttribute('role', 'tooltip');
  globo.hidden = true;
  document.body.appendChild(globo);

  const mostrar = (icono) => {
    globo.textContent = icono.dataset.tooltip;
    globo.hidden = false;
    // Debajo del ícono, alineado a su derecha; si no cabe, se acomoda dentro de la pantalla
    const r = icono.getBoundingClientRect();
    const ancho = globo.offsetWidth;
    const alto = globo.offsetHeight;
    let izquierda = Math.min(r.right - ancho, window.innerWidth - ancho - 8);
    izquierda = Math.max(8, izquierda);
    let arriba = r.bottom + 6;
    if (arriba + alto > window.innerHeight - 8) arriba = r.top - alto - 6;
    globo.style.left = izquierda + 'px';
    globo.style.top = arriba + 'px';
  };
  const ocultar = () => { globo.hidden = true; };

  iconos.forEach(icono => {
    icono.addEventListener('mouseenter', () => mostrar(icono));
    icono.addEventListener('mouseleave', ocultar);
    icono.addEventListener('focus', () => mostrar(icono));
    icono.addEventListener('blur', ocultar);
  });
  // Al desplazar la página o la tabla, el globo se esconde para que no quede flotando en otro lugar
  window.addEventListener('scroll', ocultar, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') ocultar(); });
});

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

// Pestañas de "Mi plan de trabajo": la pestaña de la pantalla en la que ya estás no recarga la página
document.addEventListener('DOMContentLoaded', () => {
  const activa = document.querySelector('#pestanasPlan .pestana-activa');
  if (activa) activa.addEventListener('click', (e) => e.preventDefault());
});
