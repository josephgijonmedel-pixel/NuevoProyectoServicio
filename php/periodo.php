<?php
// Año del PTA (periodo activo).
//   GET  periodo.php               → {anio, anios: [años que ya existen], periodos: [{anio, activo, fecha_apertura}]}
//   POST periodo.php?accion=crear  → Planeación crea un PTA de un año NUEVO y lo deja activo. Recibe JSON {anio: 2030}
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
    $fila = mysqli_fetch_row(mysqli_query($conexion, "SELECT MAX(anio) FROM periodos WHERE activo = 1 FOR UPDATE"));
    $anterior = $fila && $fila[0] !== null ? (int) $fila[0] : null;

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
