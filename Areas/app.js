// "Ver áreas": lo usan la lista de áreas (areas.html) y el detalle de un área (detalleArea.html).
// Por ahora solo maneja el menú lateral y la búsqueda/filtros de la lista.
// La carga de datos reales desde la base de datos se agregará en el siguiente paso.

// Búsqueda y filtros de la lista de áreas (solo existen en areas.html)
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

// Botón "…" de la ficha de la unidad (solo existe en detalleArea.html): muestra u oculta los datos
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

  document.getElementById('listaVacia').style.display = visibles === 0 ? 'block' : 'none';
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
