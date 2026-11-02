<?php
// "Ver áreas" de la Coordinación de Planeación.
//   GET  areas.php                   → lista de áreas con PTA del año activo y su estado de revisión
//   GET  areas.php?id=5              → datos de un área y su plan anual completo (12 meses, programado y realizado)
//   POST areas.php?accion=revisar    → Planeación acepta o rechaza un PTA en revisión.
//        Recibe JSON {id: 5, decision: "aceptar" | "rechazar", motivo: "..."} (motivo obligatorio al rechazar)
//
// Solo pueden entrar las cuentas de Planeación (o Admin). La lista incluye a todas las áreas con PTA,
// también a Planeación (su PTA lo captura en sus pantallas de siempre, aquí solo se consulta).

require "sesion.php";
requerirPlaneacion();
require "conexion.php";

$anio = anioActivo($conexion);

try {
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_GET['accion'] ?? '') === 'revisar') {
        $datos = json_decode(file_get_contents("php://input"), true);
        $mensaje = revisarPlan($conexion, $datos, $anio);
        $respuesta = detalleArea($conexion, (int) ($datos['id'] ?? 0), $anio);
        $respuesta["mensaje"] = $mensaje;
        responderJson($respuesta);
    }
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        responderJson(["error" => "Método no permitido."], 405);
    }

    if (isset($_GET['id'])) {
        responderJson(detalleArea($conexion, (int) $_GET['id'], $anio));
    }
    responderJson([
        "anio" => $anio,
        "areas" => listaAreas($conexion, $anio),
    ]);
} catch (mysqli_sql_exception $e) {
    error_log("areas.php: " . $e->getMessage());
    responderJson(["error" => "Ocurrió un error al consultar la base de datos."], 500);
}

// ---------------------------------------------------------------------

// Áreas activas (incluida Planeación) que ya guardaron su Programación/PTA del año indicado
function listaAreas($conexion, $anio)
{
    // JOIN (no LEFT JOIN) con planes_trabajo: un área sin plan de ese año no aparece
    $consulta = mysqli_prepare(
        $conexion,
        "SELECT ur.id, ur.nombre, t.nombre AS tipo, ur.responsable_nombre AS responsable,
                p.estado AS estado_plan, p.estado_final
         FROM unidades_responsables ur
         LEFT JOIN tipo_unidad t ON t.id = ur.tipo_unidad_id
         JOIN planes_trabajo p ON p.unidad_responsable_id = ur.id AND p.anio = ?
         WHERE ur.activo = 1
         ORDER BY ur.nombre"
    );
    mysqli_stmt_bind_param($consulta, "i", $anio);
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
                p.observaciones_planeacion, p.fecha_envio, p.fecha_revision,
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
            "observaciones" => $plan['observaciones_planeacion'],
            "fecha_envio" => $plan['fecha_envio'],
            "fecha_revision" => $plan['fecha_revision'],
            "seg1_guardado" => (bool) $plan['seg1_guardado'],
            "seg2_guardado" => (bool) $plan['seg2_guardado'],
        ] : null,
        "acciones" => $plan ? accionesDelPlan($conexion, (int) $plan['id']) : [],
    ];
}

// Acepta o rechaza el PTA de un área. Solo se puede revisar un PTA en revisión (ENVIADO).
// Devuelve el mensaje para mostrar; si algo está mal responde con el error.
function revisarPlan($conexion, $datos, $anio)
{
    $unidadId = (int) ($datos['id'] ?? 0);
    $decision = $datos['decision'] ?? '';
    $motivo = trim((string) ($datos['motivo'] ?? ''));

    if (!in_array($decision, ['aceptar', 'rechazar'], true)) {
        responderJson(["error" => "Decisión no válida."], 422);
    }
    if ($decision === 'rechazar' && $motivo === '') {
        responderJson(["error" => "Escribe el motivo del rechazo para que el área sepa qué corregir."], 422);
    }
    if (mb_strlen($motivo) > 2000) {
        responderJson(["error" => "El motivo es muy largo (máximo 2000 caracteres)."], 422);
    }

    mysqli_begin_transaction($conexion);
    $consulta = mysqli_prepare(
        $conexion,
        "SELECT id, estado FROM planes_trabajo WHERE unidad_responsable_id = ? AND anio = ? FOR UPDATE"
    );
    mysqli_stmt_bind_param($consulta, "ii", $unidadId, $anio);
    mysqli_stmt_execute($consulta);
    $plan = mysqli_fetch_assoc(mysqli_stmt_get_result($consulta));
    mysqli_stmt_close($consulta);

    if (!$plan) {
        mysqli_rollback($conexion);
        responderJson(["error" => "Esta área no tiene PTA de este año."], 404);
    }
    if ($plan['estado'] !== 'ENVIADO') {
        mysqli_rollback($conexion);
        $estados = ['APROBADO' => 'ya fue aceptado', 'CON OBSERVACIONES' => 'fue rechazado y el área lo está corrigiendo'];
        $texto = $estados[$plan['estado']] ?? 'no está en revisión';
        responderJson(["error" => "Este PTA $texto."], 409);
    }

    $planId = (int) $plan['id'];
    $nuevoEstado = $decision === 'aceptar' ? 'APROBADO' : 'CON OBSERVACIONES';
    $observaciones = $decision === 'rechazar' ? $motivo : null;
    $revisor = $_SESSION['usuario_id'] ?? null;

    $consulta = mysqli_prepare(
        $conexion,
        "UPDATE planes_trabajo
         SET estado = ?, observaciones_planeacion = ?, revisado_por = ?, fecha_revision = NOW()
         WHERE id = ?"
    );
    mysqli_stmt_bind_param($consulta, "ssii", $nuevoEstado, $observaciones, $revisor, $planId);
    mysqli_stmt_execute($consulta);
    mysqli_stmt_close($consulta);

    if ($decision === 'aceptar') {
        registrarBitacora($conexion, "planes_trabajo", $planId, "APROBAR", "PTA aceptado");
    } else {
        registrarBitacora($conexion, "planes_trabajo", $planId, "OBSERVAR", "PTA rechazado: $motivo");
    }
    mysqli_commit($conexion);

    return $decision === 'aceptar'
        ? "PTA aceptado. El área ya puede capturar sus avances en los seguimientos."
        : "PTA rechazado. El área verá el motivo y podrá corregirlo.";
}

// Acciones del plan con sus textos y los 12 meses de programado (p) y realizado (r)
function accionesDelPlan($conexion, $planId)
{
    $consulta = mysqli_prepare(
        $conexion,
        "SELECT a.id, a.descripcion, a.con_recursos,
                a.beneficiados, a.responsables, a.participantes, a.observaciones_generales,
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
            "beneficiados" => $fila['beneficiados'],
            "responsables" => $fila['responsables'],
            "participantes" => $fila['participantes'],
            "observaciones_generales" => $fila['observaciones_generales'],
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
