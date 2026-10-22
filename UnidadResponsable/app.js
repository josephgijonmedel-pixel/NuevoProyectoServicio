// Archivo PHP que lee (GET) y guarda (POST) los datos de la unidad en la base de datos
const API_UNIDAD = '../php/unidad.php';
const PAGINA_LOGIN = '../InicioSesion/inicioSesion.html';

document.addEventListener('DOMContentLoaded', () => {
  const btnAccion = document.getElementById('btnEditarUnidad');
  const cajaAvisos = document.getElementById('cajaAvisos');
  const cajaExito = document.getElementById('cajaExito');

  // Cada campo del formulario con el nombre que usa la base de datos
  const campos = {
    nombre: document.getElementById('urNombreUnidad'),
    tipo_unidad_id: document.getElementById('urTipo'),
    responsable_nombre: document.getElementById('urNombreResp'),
    cargo_id: document.getElementById('urCargo'),
    telefono: document.getElementById('urTel'),
    correo_institucional: document.getElementById('urCorreoInst'),
    correo_personal: document.getElementById('urCorreoPers')
  };
  const listaCampos = Object.values(campos);

  let modoEdicion = false;

  const modalConfirmar = document.getElementById('ventanaConfirmar');
  const btnConfirmarSi = document.getElementById('btnConfirmarSi');
  const btnConfirmarNo = document.getElementById('btnConfirmarNo');
  const btnCerrarVentana = document.getElementById('btnCerrarVentana');

  btnAccion.disabled = true; // se habilita cuando terminen de cargar los datos
  cargarDatos();

  btnAccion.addEventListener('click', () => {
    if (!modoEdicion) {
      // HABILITAR EDICIÓN
      modoEdicion = true;
      listaCampos.forEach(campo => campo.removeAttribute('disabled'));
      ocultarMensajes();

      btnAccion.innerText = ' Guardar Unidad';
      btnAccion.className = 'boton boton-guardar';

      campos.nombre.focus();
    } else {
      // VALIDAR Y ABRIR MODAL DE CONFIRMACIÓN
      if (validarCampos()) {
        abrirModalConfirmacion();
      }
    }
  });

  // Solo números en el celular
  campos.telefono.addEventListener('input', () => {
    campos.telefono.value = campos.telefono.value.replace(/\D/g, '').slice(0, 10);
  });

  // Evento al presionar 'Sí' en el modal de confirmación
  if (btnConfirmarSi) {
    btnConfirmarSi.addEventListener('click', () => {
      cerrarModalConfirmacion();
      guardarDatosUnidad();
    });
  }

  // Eventos para cerrar el modal
  if (btnConfirmarNo) {
    btnConfirmarNo.addEventListener('click', cerrarModalConfirmacion);
  }

  if (btnCerrarVentana) {
    btnCerrarVentana.addEventListener('click', cerrarModalConfirmacion);
  }

  if (modalConfirmar) {
    modalConfirmar.addEventListener('click', (e) => {
      if (e.target === modalConfirmar) {
        cerrarModalConfirmacion();
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      cerrarModalConfirmacion();
    }
  });

  // Pide al servidor los datos de la unidad y las opciones de las listas
  async function cargarDatos() {
    try {
      const respuesta = await fetch(API_UNIDAD);
      const resultado = await leerRespuesta(respuesta);

      llenarLista(campos.tipo_unidad_id, resultado.tipos);
      llenarLista(campos.cargo_id, resultado.cargos);
      mostrarDatos(resultado.unidad);
      btnAccion.disabled = false;
    } catch (error) {
      mostrarError(error.message);
    }
  }

  // Envía los datos editados al servidor
  async function guardarDatosUnidad() {
    const datos = {};
    for (const [nombre, campo] of Object.entries(campos)) {
      datos[nombre] = campo.value.trim();
    }

    btnAccion.disabled = true;
    try {
      const respuesta = await fetch(API_UNIDAD, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos)
      });
      const resultado = await leerRespuesta(respuesta);

      mostrarDatos(resultado.unidad);
      bloquearFormulario();
      cajaExito.innerText = '✔ ' + resultado.mensaje;
      cajaExito.style.display = 'block';
    } catch (error) {
      mostrarError(error.message, error.campos);
    } finally {
      btnAccion.disabled = false;
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
      error.campos = resultado.campos;
      throw error;
    }
    return resultado;
  }

  function llenarLista(select, opciones) {
    opciones.forEach(({ id, nombre }) => {
      const opcion = document.createElement('option');
      opcion.value = id;
      opcion.textContent = nombre;
      select.appendChild(opcion);
    });
  }

  function mostrarDatos(unidad) {
    for (const [nombre, campo] of Object.entries(campos)) {
      campo.value = unidad[nombre] ?? '';
    }

    const menuNombreUnidad = document.getElementById('menuNombreUnidad');
    if (menuNombreUnidad) menuNombreUnidad.textContent = unidad.nombre;
  }

  function bloquearFormulario() {
    modoEdicion = false;
    listaCampos.forEach(campo => {
      campo.setAttribute('disabled', 'disabled');
      campo.classList.remove('campo-error');
    });
    ocultarMensajes();

    btnAccion.innerText = ' Editar mi Unidad';
    btnAccion.className = 'boton boton-editar';
  }

  function mostrarError(mensaje, erroresPorCampo) {
    cajaExito.style.display = 'none';
    let texto = '⚠️ ' + mensaje;

    if (erroresPorCampo) {
      for (const [nombre, detalle] of Object.entries(erroresPorCampo)) {
        if (campos[nombre]) campos[nombre].classList.add('campo-error');
        texto += '\n• ' + detalle;
      }
    }

    cajaAvisos.innerText = texto;
    cajaAvisos.style.display = 'block';
  }

  function ocultarMensajes() {
    cajaAvisos.style.display = 'none';
    cajaExito.style.display = 'none';
  }

  function validarCampos() {
    let camposVacios = 0;

    listaCampos.forEach(campo => {
      if (!campo.value.trim()) {
        campo.classList.add('campo-error');
        camposVacios++;
      } else {
        campo.classList.remove('campo-error');
      }
    });

    if (camposVacios > 0) {
      mostrarError(`Por favor, completa todos los campos requeridos. (${camposVacios} campo(s) vacío(s))`);
      return false;
    }

    if (campos.telefono.value.length !== 10) {
      campos.telefono.classList.add('campo-error');
      mostrarError('El celular debe tener 10 dígitos.');
      return false;
    }

    ocultarMensajes();
    return true;
  }
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
