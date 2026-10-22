<?php
// Valida el inicio de sesión contra la tabla `usuarios` de la base de datos.
require "sesion.php";
require "conexion.php";

// Rutas relativas a esta carpeta (php/), así funcionan dentro de /PaginaServicioSocial/
const PAGINA_LOGIN = "../InicioSesion/inicioSesion.html";
const PAGINA_INICIO = "../Programacion/programacion.html";

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header("Location: " . PAGINA_LOGIN);
    exit;
}

$correo = trim($_POST['correo'] ?? '');
$contrasena = $_POST['password'] ?? '';

if ($correo === '' || $contrasena === '') {
    header("Location: " . PAGINA_LOGIN . "?error=1");
    exit;
}

$consulta = mysqli_prepare(
    $conexion,
    "SELECT id, nombre_completo, password, rol, tipo_usuario, unidade_responsable_id, activo
     FROM usuarios WHERE correo_institucional = ? LIMIT 1"
);
mysqli_stmt_bind_param($consulta, "s", $correo);
mysqli_stmt_execute($consulta);
$usuario = mysqli_fetch_assoc(mysqli_stmt_get_result($consulta));
mysqli_stmt_close($consulta);

$loginValido = $usuario
    && (int) $usuario['activo'] === 1
    && password_verify($contrasena, $usuario['password']);

if (!$loginValido) {
    header("Location: " . PAGINA_LOGIN . "?error=1");
    exit;
}

// Regenerar el ID de sesión al iniciar sesión evita que se reutilice uno viejo
session_regenerate_id(true);

$_SESSION['usuario_id'] = (int) $usuario['id'];
$_SESSION['nombre_completo'] = $usuario['nombre_completo'];
$_SESSION['rol'] = $usuario['rol'];
$_SESSION['tipo_usuario'] = $usuario['tipo_usuario'];
$_SESSION['unidad_responsable_id'] = $usuario['unidade_responsable_id'] !== null
    ? (int) $usuario['unidade_responsable_id']
    : null;

mysqli_query($conexion, "UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = " . (int) $usuario['id']);
registrarBitacora($conexion, "usuarios", (int) $usuario['id'], "LOGIN");

mysqli_close($conexion);
header("Location: " . PAGINA_INICIO);
exit;
