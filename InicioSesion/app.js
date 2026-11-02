// Al llegar a iniciar sesión (o después de cerrarla) se olvida que ya se mostró la ventana
// "Iniciaste un nuevo PTA", para que vuelva a salir una vez en el siguiente ingreso.
try { sessionStorage.removeItem('ventanaNuevoPTAVista'); } catch (e) { /* sin sessionStorage */ }

document.addEventListener('DOMContentLoaded', () => {
  // Si validar.php nos regresó aquí por un error, mostrar el aviso
  const parametros = new URLSearchParams(window.location.search);
  if (parametros.get('error') === '1') {
    const cajaAvisos = document.getElementById('avisoLogin');
    if (cajaAvisos) cajaAvisos.style.display = 'block';
  }
});
