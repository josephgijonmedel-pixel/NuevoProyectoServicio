// Variable global para almacenar el estado de la Unidad Responsable
let unidadResponsableData = {
  nombreUnidad: "COORDINACIÓN DE ATENCIÓN A LOS ESTUDIANTES",
  tipo: "ACADÉMICA",
  nombreResp: "Irma Berenice Vega Ferrusca",
  cargo: "COORDINADOR",
  tel: "7449092310",
  correoInst: "oeducativa_zs@uagro.mx",
  correoPers: "13968@uagro.mx"
};

document.addEventListener('DOMContentLoaded', () => {
  const btnAccion = document.getElementById('btnAccionUR');
  const alertBox = document.getElementById('alertBox');
  
  const inputNombreUnidad = document.getElementById('urNombreUnidad');
  const inputTipo = document.getElementById('urTipo');
  const inputNombreResp = document.getElementById('urNombreResp');
  const inputCargo = document.getElementById('urCargo');
  const inputTel = document.getElementById('urTel');
  const inputCorreoInst = document.getElementById('urCorreoInst');
  const inputCorreoPers = document.getElementById('urCorreoPers');

  const campos = [
    inputNombreUnidad,
    inputTipo,
    inputNombreResp,
    inputCargo,
    inputTel,
    inputCorreoInst,
    inputCorreoPers
  ];

  let modoEdicion = false;

  const modalConfirmar = document.getElementById('modalConfirmarGuardar');
  const btnConfirmarSi = document.getElementById('btnConfirmarSi');
  const btnConfirmarNo = document.getElementById('btnConfirmarNo');
  const btnCerrarConfirmX = document.getElementById('btnCerrarConfirmX');

 
  cargarDatosGuardados();

  btnAccion.addEventListener('click', () => {
    if (!modoEdicion) {
      // HABILITAR EDICIÓN
      modoEdicion = true;
      campos.forEach(campo => campo.removeAttribute('disabled'));
      
      btnAccion.innerText = ' Guardar Unidad';
      btnAccion.className = 'btn btn-submit';
      
      campos[0].focus();
    } else {
      // VALIDAR Y ABRIR MODAL DE CONFIRMACIÓN
      if (validarCampos()) {
        abrirModalConfirmacion();
      }
    }
  });

  // Evento al presionar 'Sí' en el modal de confirmación
  if (btnConfirmarSi) {
    btnConfirmarSi.addEventListener('click', () => {
      guardarDatosUnidad();
      cerrarModalConfirmacion();
    });
  }

  // Eventos para cerrar el modal
  if (btnConfirmarNo) {
    btnConfirmarNo.addEventListener('click', cerrarModalConfirmacion);
  }

  if (btnCerrarConfirmX) {
    btnCerrarConfirmX.addEventListener('click', cerrarModalConfirmacion);
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

  function guardarDatosUnidad() {
    modoEdicion = false;
    
    // Actualizar la Variable Global
    unidadResponsableData = {
      nombreUnidad: inputNombreUnidad.value.trim(),
      tipo: inputTipo.value.trim(),
      nombreResp: inputNombreResp.value.trim(),
      cargo: inputCargo.value.trim(),
      tel: inputTel.value.trim(),
      correoInst: inputCorreoInst.value.trim(),
      correoPers: inputCorreoPers.value.trim()
    };

    // Guardar también en localStorage para persistencia al recargar
    localStorage.setItem('unidadResponsableData', JSON.stringify(unidadResponsableData));

    const sidebarUnidadNombre = document.getElementById('sidebarUnidadNombre');
    if (sidebarUnidadNombre && unidadResponsableData.nombreUnidad) {
      sidebarUnidadNombre.textContent = unidadResponsableData.nombreUnidad;
    }

    // Bloquear campos
    campos.forEach(campo => {
      campo.setAttribute('disabled', 'disabled');
      campo.classList.remove('input-error');
    });

    alertBox.style.display = 'none';

    // Restaurar estado del botón
    btnAccion.innerText = ' Editar mi Unidad';
    btnAccion.className = 'btn btn-edit';

    console.log('Variable unidadResponsableData actualizada:', unidadResponsableData);
  }

  function cargarDatosGuardados() {
    const datosLocales = localStorage.getItem('unidadResponsableData');
    if (datosLocales) {
      unidadResponsableData = JSON.parse(datosLocales);
    }

    // Poblar los campos con los valores de la variable
    inputNombreUnidad.value = unidadResponsableData.nombreUnidad;
    inputTipo.value = unidadResponsableData.tipo;
    inputNombreResp.value = unidadResponsableData.nombreResp;
    inputCargo.value = unidadResponsableData.cargo;
    inputTel.value = unidadResponsableData.tel;
    inputCorreoInst.value = unidadResponsableData.correoInst;
    inputCorreoPers.value = unidadResponsableData.correoPers;

    const sidebarUnidadNombre = document.getElementById('sidebarUnidadNombre');
    if (sidebarUnidadNombre && unidadResponsableData.nombreUnidad) {
      sidebarUnidadNombre.textContent = unidadResponsableData.nombreUnidad;
    }
  }

  function validarCampos() {
    let camposVacios = 0;

    campos.forEach(campo => {
      if (!campo.value.trim()) {
        campo.classList.add('input-error');
        camposVacios++;
      } else {
        campo.classList.remove('input-error');
      }
    });

    if (camposVacios > 0) {
      alertBox.innerText = `⚠️ Por favor, completa todos los campos requeridos. (${camposVacios} campo(s) vacío(s))`;
      alertBox.style.display = 'block';
      return false;
    }

    alertBox.style.display = 'none';
    return true;
  }
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