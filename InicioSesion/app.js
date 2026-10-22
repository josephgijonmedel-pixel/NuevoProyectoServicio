document.addEventListener('DOMContentLoaded', () => {
  // Si validar.php nos regresó aquí por un error, mostrar el aviso
  const parametros = new URLSearchParams(window.location.search);
  if (parametros.get('error') === '1') {
    const cajaAvisos = document.getElementById('avisoLogin');
    if (cajaAvisos) cajaAvisos.style.display = 'block';
  }
});
