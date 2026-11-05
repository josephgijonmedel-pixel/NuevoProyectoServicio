<?php
// Funciones compartidas por los PHP que responden en JSON a las páginas.
// Uso:  require "sesion.php";  requerirSesion();

session_start();

// Responde en JSON con el código HTTP indicado y termina el script.
function responderJson($datos, $codigo = 200)
{
    http_response_code($codigo);
    header("Content-Type: application/json; charset=utf-8");
    echo json_encode($datos, JSON_UNESCAPED_UNICODE);
    exit;
}

// Si no hay sesión iniciada, responde 401 para que la página mande al login.
function requerirSesion()
{
    if (empty($_SESSION['usuario_id'])) {
        responderJson(["error" => "Tu sesión expiró. Inicia sesión de nuevo."], 401);
    }
}

// Devuelve el id de la Unidad Responsable de la sesión, o responde 403 si la cuenta no tiene unidad.
function requerirUnidad()
{
    requerirSesion();
    $unidadId = $_SESSION['unidad_responsable_id'] ?? null;
    if ($unidadId === null) {
        responderJson(["error" => "Esta cuenta no pertenece a ninguna Unidad Responsable."], 403);
    }
    return (int) $unidadId;
}

// ¿La cuenta de la sesión puede supervisar a las demás áreas?
function esPlaneacion()
{
    return in_array($_SESSION['tipo_usuario'] ?? '', ['PLANEACION', 'ADMIN'], true);
}

// Solo deja pasar a Planeación (o Admin); a los demás les responde 403.
function requerirPlaneacion($mensaje = "Solo la Coordinación de Planeación puede ver las áreas.")
{
    requerirSesion();
    if (!esPlaneacion()) {
        responderJson(["error" => $mensaje], 403);
    }
}

// Guarda un movimiento en la tabla `bitacora`.
function registrarBitacora($conexion, $tabla, $registroId, $accion, $detalle = null)
{
    $usuarioId = $_SESSION['usuario_id'] ?? null;
    $consulta = mysqli_prepare(
        $conexion,
        "INSERT INTO bitacora (usuario_id, tabla, registro_id, accion, detalle) VALUES (?, ?, ?, ?, ?)"
    );
    mysqli_stmt_bind_param($consulta, "isiss", $usuarioId, $tabla, $registroId, $accion, $detalle);
    mysqli_stmt_execute($consulta);
    mysqli_stmt_close($consulta);
}

// Año del periodo activo: el que capturan las áreas y consulta Planeación.
// Lo decide Planeación con el botón "Abrir nuevo periodo"; si todavía no hay ninguno, se usa el año actual.
function anioActivo($conexion)
{
    $fila = mysqli_fetch_row(mysqli_query($conexion, "SELECT anio FROM periodos WHERE activo = 1 ORDER BY anio DESC LIMIT 1"));
    return $fila ? (int) $fila[0] : (int) date('Y');
}

// ¿Planeación ya finalizó el PTA de ese año? Un PTA finalizado ya no se puede modificar:
// ni la Programación, ni los seguimientos, ni la revisión.
function ptaFinalizado($conexion, $anio)
{
    $consulta = mysqli_prepare($conexion, "SELECT finalizado FROM periodos WHERE anio = ?");
    mysqli_stmt_bind_param($consulta, "i", $anio);
    mysqli_stmt_execute($consulta);
    $fila = mysqli_fetch_row(mysqli_stmt_get_result($consulta));
    mysqli_stmt_close($consulta);
    return $fila && (int) $fila[0] === 1;
}
