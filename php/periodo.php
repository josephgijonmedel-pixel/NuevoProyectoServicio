<?php
// Año del PTA (periodo activo).
//   GET  periodo.php               → {anio, anios: [años que ya existen], periodos: [{anio, activo, fecha_apertura}]}
//   POST periodo.php?accion=finalizar → Planeación finaliza (cierra) el PTA del año activo. Ya nadie lo puede modificar.
//   POST periodo.php?accion=crear  → Planeación crea un PTA de un año NUEVO y lo deja activo. Recibe JSON {anio: 2030}
//                                    Solo se puede después de finalizar el PTA actual (botón "Nuevo PTA").
//
// Solo se pueden crear años que no existan: si ya hay un PTA de ese año, se rechaza y no se cambia nada.
// Así los PTA de otros años no se pueden volver a abrir ni modificar; se consultarán en el historial.

require "sesion.php";
requerirSesion();
require "conexion.php";

const ANIO_MINIMO = 2020;
const ANIO_MAXIMO = 2100;

try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        responderJson(datosPeriodo($conexion));
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_GET['accion'] ?? '') === 'finalizar') {
        requerirPlaneacion("Solo la Coordinación de Planeación puede finalizar el PTA.");
        $anio = finalizarPeriodo($conexion);
        $respuesta = datosPeriodo($conexion);
        $respuesta["mensaje"] = "Se finalizó el PTA $anio. Las áreas ya no pueden modificar su PTA ni sus seguimientos.";
        responderJson($respuesta);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_GET['accion'] ?? '') === 'crear') {
        requerirPlaneacion("Solo la Coordinación de Planeación puede crear un nuevo PTA.");

        $datos = json_decode(file_get_contents("php://input"), true);
        $anio = $datos['anio'] ?? null;
        if (!is_numeric($anio) || (int) $anio != $anio || $anio < ANIO_MINIMO || $anio > ANIO_MAXIMO) {
            responderJson(["error" => "Escribe un año válido, entre " . ANIO_MINIMO . " y " . ANIO_MAXIMO . "."], 422);
        }
        $anio = (int) $anio;

        crearPeriodo($conexion, $anio);
        $respuesta = datosPeriodo($conexion);
        $respuesta["mensaje"] = "Se creó el PTA $anio. Las áreas ya pueden capturar su PTA $anio.";
        responderJson($respuesta);
    }

    responderJson(["error" => "Método no permitido."], 405);
} catch (mysqli_sql_exception $e) {
    if (isset($conexion)) {
        try { mysqli_rollback($conexion); } catch (Throwable $t) { /* no había transacción abierta */ }
    }
    error_log("periodo.php: " . $e->getMessage());
    responderJson(["error" => "Ocurrió un error al consultar la base de datos."], 500);
}

// ---------------------------------------------------------------------

function datosPeriodo($conexion)
{
    $anio = anioActivo($conexion);
    $consulta = mysqli_prepare($conexion, "SELECT finalizado, fecha_finalizacion FROM periodos WHERE anio = ?");
    mysqli_stmt_bind_param($consulta, "i", $anio);
    mysqli_stmt_execute($consulta);
    $actual = mysqli_fetch_assoc(mysqli_stmt_get_result($consulta));
    mysqli_stmt_close($consulta);

    $periodos = mysqli_fetch_all(
        mysqli_query($conexion, "SELECT anio, activo, fecha_apertura FROM periodos ORDER BY anio DESC"),
        MYSQLI_ASSOC
    );
    foreach ($periodos as &$periodo) {
        $periodo['anio'] = (int) $periodo['anio'];
        $periodo['activo'] = (bool) $periodo['activo'];
    }

    // Años que ya existen (como periodo o con algún plan guardado): no se pueden volver a crear
    $anios = array_map('intval', array_column(mysqli_fetch_all(mysqli_query(
        $conexion,
        "SELECT anio FROM periodos UNION SELECT anio FROM planes_trabajo ORDER BY anio DESC"
    )), 0));

    return [
        "anio" => $anio,
        "finalizado" => $actual && (int) $actual['finalizado'] === 1,
        "fecha_finalizacion" => $actual['fecha_finalizacion'] ?? null,
        "anios" => $anios,
        "periodos" => $periodos,
    ];
}

// ¿Ya existe un PTA de ese año? (como periodo o con algún plan guardado)
function existeAnio($conexion, $anio)
{
    $consulta = mysqli_prepare(
        $conexion,
        "SELECT (SELECT COUNT(*) FROM periodos WHERE anio = ?) + (SELECT COUNT(*) FROM planes_trabajo WHERE anio = ?)"
    );
    mysqli_stmt_bind_param($consulta, "ii", $anio, $anio);
    mysqli_stmt_execute($consulta);
    $total = (int) mysqli_fetch_row(mysqli_stmt_get_result($consulta))[0];
    mysqli_stmt_close($consulta);
    return $total > 0;
}

// Crea el periodo de un año nuevo y lo deja activo (desactiva el anterior).
// Si el año ya existe responde 409 sin cambiar nada.
function crearPeriodo($conexion, $anio)
{
    mysqli_begin_transaction($conexion);

    // FOR UPDATE: si dos personas crean un PTA a la vez, una espera a la otra
    $fila = mysqli_fetch_row(mysqli_query(
        $conexion,
        "SELECT anio, finalizado FROM periodos WHERE activo = 1 ORDER BY anio DESC LIMIT 1 FOR UPDATE"
    ));
    $anterior = $fila ? (int) $fila[0] : null;

    // Primero hay que finalizar el PTA actual
    if ($fila && (int) $fila[1] !== 1) {
        mysqli_rollback($conexion);
        responderJson(["error" => "Primero finaliza el PTA $anterior."], 409);
    }

    if (existeAnio($conexion, $anio)) {
        mysqli_rollback($conexion);
        responderJson(["error" => "Ya existe un PTA $anio. Los PTA de otros años se consultarán en el historial."], 409);
    }

    mysqli_query($conexion, "UPDATE periodos SET activo = 0 WHERE activo = 1");

    $usuarioId = $_SESSION['usuario_id'] ?? null;
    $consulta = mysqli_prepare($conexion, "INSERT INTO periodos (anio, activo, abierto_por) VALUES (?, 1, ?)");
    mysqli_stmt_bind_param($consulta, "ii", $anio, $usuarioId);
    mysqli_stmt_execute($consulta);
    $periodoId = mysqli_insert_id($conexion);
    mysqli_stmt_close($consulta);

    $antes = $anterior === null ? "ninguno" : $anterior;
    registrarBitacora($conexion, "periodos", $periodoId, "CREAR", "Creó el PTA $anio (antes $antes)");

    mysqli_commit($conexion);
}

// Finaliza el PTA del año activo: queda cerrado y nadie lo puede modificar.
// Los datos de las áreas se quedan en la base de datos (planes_trabajo, acciones, metas y seguimientos de ese año).
// Devuelve el año finalizado. Si no hay PTA activo o ya estaba finalizado responde 409 sin cambiar nada.
function finalizarPeriodo($conexion)
{
    mysqli_begin_transaction($conexion);

    // FOR UPDATE: si dos personas lo finalizan a la vez, una espera a la otra
    $periodo = mysqli_fetch_assoc(mysqli_query(
        $conexion,
        "SELECT id, anio, finalizado FROM periodos WHERE activo = 1 ORDER BY anio DESC LIMIT 1 FOR UPDATE"
    ));
    if (!$periodo) {
        mysqli_rollback($conexion);
        responderJson(["error" => "No hay un PTA activo para finalizar."], 409);
    }
    $anio = (int) $periodo['anio'];
    if ((int) $periodo['finalizado'] === 1) {
        mysqli_rollback($conexion);
        responderJson(["error" => "El PTA $anio ya estaba finalizado."], 409);
    }

    $usuarioId = $_SESSION['usuario_id'] ?? null;
    $consulta = mysqli_prepare(
        $conexion,
        "UPDATE periodos SET finalizado = 1, finalizado_por = ?, fecha_finalizacion = NOW() WHERE id = ?"
    );
    $periodoId = (int) $periodo['id'];
    mysqli_stmt_bind_param($consulta, "ii", $usuarioId, $periodoId);
    mysqli_stmt_execute($consulta);
    mysqli_stmt_close($consulta);

    registrarBitacora($conexion, "periodos", $periodoId, "EDITAR", "Finalizó el PTA $anio");
    mysqli_commit($conexion);
    return $anio;
}
