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
