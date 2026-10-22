<?php
// Datos básicos de la cuenta que inició sesión.
// Las páginas lo usan para el menú lateral: el nombre de la unidad y si se muestra "Ver áreas".

require "sesion.php";
requerirSesion();
require "conexion.php";

$unidad = '';
$unidadId = $_SESSION['unidad_responsable_id'] ?? null;
if ($unidadId !== null) {
    $consulta = mysqli_prepare($conexion, "SELECT nombre FROM unidades_responsables WHERE id = ?");
    mysqli_stmt_bind_param($consulta, "i", $unidadId);
    mysqli_stmt_execute($consulta);
    $unidad = mysqli_fetch_assoc(mysqli_stmt_get_result($consulta))['nombre'] ?? '';
    mysqli_stmt_close($consulta);
}

responderJson([
    "nombre" => $_SESSION['nombre_completo'] ?? '',
    "unidad" => $unidad,
    "tipo_usuario" => $_SESSION['tipo_usuario'] ?? 'UR',
    "esPlaneacion" => esPlaneacion(),
]);
