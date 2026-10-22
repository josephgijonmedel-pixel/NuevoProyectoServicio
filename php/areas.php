<?php
// "Ver áreas" de la Coordinación de Planeación (solo lectura).
//   GET areas.php        → lista de áreas con el estado de su Programación y de su PTA final del año actual
//   GET areas.php?id=5   → datos de un área y su plan anual completo (12 meses, programado y realizado)
//
// Solo pueden entrar las cuentas de Planeación (o Admin). La unidad de Planeación no aparece
// en la lista: su propio PTA lo captura en sus pantallas de siempre.

require "sesion.php";
requerirPlaneacion();
require "conexion.php";

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    responderJson(["error" => "Método no permitido."], 405);
}

$anio = (int) date('Y');

try {
    if (isset($_GET['id'])) {
        responderJson(detalleArea($conexion, (int) $_GET['id'], $anio));
    }
    responderJson([
        "anio" => $anio,
        "areas" => listaAreas($conexion, $anio, (int) ($_SESSION['unidad_responsable_id'] ?? 0)),
    ]);
} catch (mysqli_sql_exception $e) {
    error_log("areas.php: " . $e->getMessage());
    responderJson(["error" => "Ocurrió un error al consultar la base de datos."], 500);
}

// ---------------------------------------------------------------------

// Todas las áreas activas (menos la propia) con el estado de su Programación y de su PTA final.
// Un estado null significa que todavía no existe (sin plan / sin capturar).
function listaAreas($conexion, $anio, $unidadPropia)
{
    $consulta = mysqli_prepare(
        $conexion,
        "SELECT ur.id, ur.nombre, t.nombre AS tipo, ur.responsable_nombre AS responsable,
                p.estado AS estado_plan, p.estado_final
         FROM unidades_responsables ur
         LEFT JOIN tipo_unidad t ON t.id = ur.tipo_unidad_id
         LEFT JOIN planes_trabajo p ON p.unidad_responsable_id = ur.id AND p.anio = ?
         WHERE ur.activo = 1 AND ur.id <> ?
         ORDER BY ur.nombre"
    );
    mysqli_stmt_bind_param($consulta, "ii", $anio, $unidadPropia);
    mysqli_stmt_execute($consulta);
    $areas = mysqli_fetch_all(mysqli_stmt_get_result($consulta), MYSQLI_ASSOC);
    mysqli_stmt_close($consulta);

    foreach ($areas as &$area) {
        $area['id'] = (int) $area['id'];
    }
    return $areas;
}

function detalleArea($conexion, $unidadId, $anio)
{
    $consulta = mysqli_prepare(
        $conexion,
        "SELECT ur.id, ur.nombre, t.nombre AS tipo, ur.responsable_nombre AS responsable, c.nombre AS cargo,
                ur.telefono, ur.correo_institucional, ur.correo_personal
         FROM unidades_responsables ur
         LEFT JOIN tipo_unidad t ON t.id = ur.tipo_unidad_id
         LEFT JOIN cargos c ON c.id = ur.cargo_id
         WHERE ur.id = ? AND ur.activo = 1"
    );
    mysqli_stmt_bind_param($consulta, "i", $unidadId);
    mysqli_stmt_execute($consulta);
    $unidad = mysqli_fetch_assoc(mysqli_stmt_get_result($consulta));
    mysqli_stmt_close($consulta);

    if (!$unidad) {
        responderJson(["error" => "No se encontró el área solicitada."], 404);
    }
    $unidad['id'] = (int) $unidad['id'];

    $consulta = mysqli_prepare(
        $conexion,
        "SELECT p.id, p.estado, p.responsable_nombre, p.responsable_cargo, p.estado_final,
                (s1.id IS NOT NULL) AS seg1_guardado, (s2.id IS NOT NULL) AS seg2_guardado
         FROM planes_trabajo p
         LEFT JOIN seguimientos s1 ON s1.plan_id = p.id AND s1.periodo = 1
         LEFT JOIN seguimientos s2 ON s2.plan_id = p.id AND s2.periodo = 2
         WHERE p.unidad_responsable_id = ? AND p.anio = ?"
    );
    mysqli_stmt_bind_param($consulta, "ii", $unidadId, $anio);
    mysqli_stmt_execute($consulta);
    $plan = mysqli_fetch_assoc(mysqli_stmt_get_result($consulta));
    mysqli_stmt_close($consulta);

    return [
        "anio" => $anio,
        "unidad" => $unidad,
        "plan" => $plan ? [
            "estado" => $plan['estado'],
            "elaborado_por" => $plan['responsable_nombre'],
            "cargo" => $plan['responsable_cargo'],
            "estado_final" => $plan['estado_final'],
            "seg1_guardado" => (bool) $plan['seg1_guardado'],
            "seg2_guardado" => (bool) $plan['seg2_guardado'],
        ] : null,
        "acciones" => $plan ? accionesDelPlan($conexion, (int) $plan['id']) : [],
    ];
}

// Acciones del plan con sus textos y los 12 meses de programado (p) y realizado (r)
function accionesDelPlan($conexion, $planId)
{
    $consulta = mysqli_prepare(
        $conexion,
        "SELECT a.id, a.descripcion, a.con_recursos,
                CONCAT(p.clave, '. ', p.nombre) AS proyecto,
                CONCAT(l.clave, '. ', l.descripcion) AS linea,
                u.nombre AS unidad_medida
         FROM acciones_estrategicas a
         JOIN lineas_accion l ON l.id = a.lineas_accion_id
         JOIN objetivos_especificos o ON o.id = l.objetivo_id
         JOIN proyectos_institucionales p ON p.id = o.proyecto_id
         JOIN unidades_medida u ON u.id = a.unidad_medida_id
         WHERE a.plan_id = ?
         ORDER BY a.orden, a.id"
    );
    mysqli_stmt_bind_param($consulta, "i", $planId);
    mysqli_stmt_execute($consulta);
    $resultado = mysqli_stmt_get_result($consulta);

    $acciones = [];
    while ($fila = mysqli_fetch_assoc($resultado)) {
        $acciones[(int) $fila['id']] = [
            "proyecto" => $fila['proyecto'],
            "linea" => $fila['linea'],
            "descripcion" => $fila['descripcion'],
            "con_recursos" => (int) $fila['con_recursos'],
            "unidad_medida" => $fila['unidad_medida'],
            "p" => array_fill(0, 12, 0),
            "r" => array_fill(0, 12, 0),
        ];
    }
    mysqli_stmt_close($consulta);

    if ($acciones) {
        $consulta = mysqli_prepare(
            $conexion,
            "SELECT m.accion_id, m.mes, m.programado, m.realizado
             FROM metas_mensuales m JOIN acciones_estrategicas a ON a.id = m.accion_id
             WHERE a.plan_id = ?"
        );
        mysqli_stmt_bind_param($consulta, "i", $planId);
        mysqli_stmt_execute($consulta);
        $resultado = mysqli_stmt_get_result($consulta);
        while ($meta = mysqli_fetch_assoc($resultado)) {
            $indice = (int) $meta['mes'] - 1;
            $acciones[(int) $meta['accion_id']]['p'][$indice] = (int) $meta['programado'];
            $acciones[(int) $meta['accion_id']]['r'][$indice] = (int) $meta['realizado'];
        }
        mysqli_stmt_close($consulta);
    }

    return array_values($acciones);
}
