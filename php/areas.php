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
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_GET['accion'] ?? '') === 'permitir_avance') {
        $datos = json_decode(file_get_contents("php://input"), true);
        $mensaje = permitirModificarAvance($conexion, (int) ($datos['id'] ?? 0), $anio);
        $respuesta = detalleArea($conexion, (int) ($datos['id'] ?? 0), $anio);
        $respuesta["mensaje"] = $mensaje;
        responderJson($respuesta);
    }
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_GET['accion'] ?? '') === 'cierre') {
        $datos = json_decode(file_get_contents("php://input"), true);
        $mensaje = cambiarCierreHabilitado($conexion, (int) ($datos['id'] ?? 0), (int) ($datos['periodo'] ?? 0), $anio);
        $respuesta = detalleArea($conexion, (int) ($datos['id'] ?? 0), $anio);
        $respuesta["mensaje"] = $mensaje;
        responderJson($respuesta);
    }
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_GET['accion'] ?? '') === 'enviar_observaciones') {
        $datos = json_decode(file_get_contents("php://input"), true);
        $mensaje = enviarObservaciones($conexion, (int) ($datos['id'] ?? 0), $anio);
        $respuesta = detalleArea($conexion, (int) ($datos['id'] ?? 0), $anio);
        $respuesta["mensaje"] = $mensaje;
        responderJson($respuesta);
    }
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_GET['accion'] ?? '') === 'observacion') {
        $datos = json_decode(file_get_contents("php://input"), true);
        guardarObservacionPlaneacion($conexion, $datos, $anio);
        responderJson(["mensaje" => "Observación guardada."]);
    }
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        responderJson(["error" => "Método no permitido."], 405);
    }

    if (isset($_GET['id'])) {
        responderJson(detalleArea($conexion, (int) $_GET['id'], $anio));
    }
    responderJson([
        "anio" => $anio,
        // Todas las áreas activas; cada una indica si tiene PTA y si ya subió el avance del mes
        "areas" => listaAreas($conexion, $anio),
    ]);
} catch (mysqli_sql_exception $e) {
    error_log("areas.php: " . $e->getMessage());
    responderJson(["error" => "Ocurrió un error al consultar la base de datos."], 500);
}

// ---------------------------------------------------------------------

// Todas las áreas activas (incluida Planeación) para la lista de Ver áreas.
//   tiene_pta  → ya guardó su Programación/PTA del año indicado
//   avance_mes → ya subió (botón "Subir avance") el avance del mes en curso
// Las tarjetas del resumen filtran la tabla con estos datos.
function listaAreas($conexion, $anio)
{
    $mes = mesDeCaptura($anio); // 0 si el PTA activo no es del año en curso
    // LEFT JOIN con planes_trabajo: también aparecen las áreas sin plan de ese año
    $consulta = mysqli_prepare(
        $conexion,
        "SELECT ur.id, ur.nombre, t.nombre AS tipo, ur.responsable_nombre AS responsable,
                p.estado AS estado_plan, p.estado_final,
                p.id IS NOT NULL AS tiene_pta,
                EXISTS (SELECT 1 FROM avances_subidos s WHERE s.plan_id = p.id AND s.mes = ?) AS avance_mes
         FROM unidades_responsables ur
         LEFT JOIN tipo_unidad t ON t.id = ur.tipo_unidad_id
         LEFT JOIN planes_trabajo p ON p.unidad_responsable_id = ur.id AND p.anio = ?
         WHERE ur.activo = 1
         ORDER BY ur.nombre"
    );
    mysqli_stmt_bind_param($consulta, "ii", $mes, $anio);
    mysqli_stmt_execute($consulta);
    $areas = mysqli_fetch_all(mysqli_stmt_get_result($consulta), MYSQLI_ASSOC);
    mysqli_stmt_close($consulta);

    foreach ($areas as &$area) {
        $area['id'] = (int) $area['id'];
        $area['tiene_pta'] = (bool) $area['tiene_pta'];
        $area['avance_mes'] = (bool) $area['avance_mes'];
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
                (s1.id IS NOT NULL) AS seg1_guardado, (s2.id IS NOT NULL) AS seg2_guardado,
                s1.fecha_envio AS avance1_subido, s2.fecha_envio AS avance2_subido
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
        "finalizado" => ptaFinalizado($conexion, $anio),   // PTA cerrado: ya no se acepta ni rechaza
        "semestre_actual" => semestreActual($anio),         // 1 o 2: la pestaña con la que abre el detalle
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
            "avance1_subido" => $plan['avance1_subido'],   // fecha en que el área subió su avance (o null)
            "avance2_subido" => $plan['avance2_subido'],
            // Meses subidos que Planeación puede volver a habilitar (los abiertos por la regla)
            "meses_para_habilitar" => $plan['estado'] === 'APROBADO' && !ptaFinalizado($conexion, $anio)
                ? mesesParaHabilitar($conexion, $anio, (int) $plan['id']) : [],
            // Seguimientos (1, 2) cuyas Evidencias, Causas y Acuerdos ya subió el área (bloqueados)
            "cierres_bloqueados" => $plan['estado'] === 'APROBADO' && !ptaFinalizado($conexion, $anio)
                ? cierresBloqueados($conexion, (int) $plan['id']) : [],
            // Mes del último avance que subió el área (para "Avance de noviembre enviado"); null si no hay
            "ultimo_mes_subido" => ultimoMesSubido($conexion, (int) $plan['id']),
            // Campos de cierre de cada seguimiento: se ven al terminar el semestre y si el área ya subió su avance;
            // Planeación escribe sus Observaciones mientras el PTA esté aceptado y sin finalizar
            // Seguimiento en el que Planeación habilitó a mano los campos de cierre (0 = ninguno, 1 o 2)
            "cierre_habilitado" => cierreHabilitadoPorPlaneacion($conexion, (int) $plan['id']),
            // ¿Hay observaciones de Planeación escritas que todavía no se envían al área?
            "observaciones_pendientes" => observacionesPendientes($conexion, (int) $plan['id']),
            "cierre" => [
                1 => estadoCierre($conexion, $anio, $plan, 1),
                2 => estadoCierre($conexion, $anio, $plan, 2),
            ],
        ] : null,
        "acciones" => $plan ? agregarCierres($conexion, (int) $plan['id'], accionesDelPlan($conexion, (int) $plan['id'])) : [],
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

    if (ptaFinalizado($conexion, $anio)) {
        responderJson(["error" => "El PTA $anio ya fue finalizado; no se puede revisar."], 409);
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
            "id" => (int) $fila['id'],
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
            // Planeación solo ve lo que el área subió con "Subir avance" (realizado_enviado),
            // no lo que el área está capturando todavía (realizado)
            "SELECT m.accion_id, m.mes, m.programado, m.realizado_enviado AS realizado
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

// Meses que el área ya subió y que Planeación puede volver a habilitar:
// solo los que la regla deja capturar ahora (el mes en curso, o todos si están habilitados).
function mesesParaHabilitar($conexion, $anio, $planId)
{
    return array_values(array_intersect(mesesSubidos($conexion, $planId), mesesDeCaptura($conexion, $anio)));
}

// Planeación permite que el área vuelva a modificar el avance que ya subió (el del mes en curso).
function permitirModificarAvance($conexion, $unidadId, $anio)
{
    if (ptaFinalizado($conexion, $anio)) {
        responderJson(["error" => "El PTA $anio ya fue finalizado."], 409);
    }
    $consulta = mysqli_prepare($conexion, "SELECT id, estado FROM planes_trabajo WHERE unidad_responsable_id = ? AND anio = ?");
    mysqli_stmt_bind_param($consulta, "ii", $unidadId, $anio);
    mysqli_stmt_execute($consulta);
    $plan = mysqli_fetch_assoc(mysqli_stmt_get_result($consulta));
    mysqli_stmt_close($consulta);
    if (!$plan || $plan['estado'] !== 'APROBADO') {
        responderJson(["error" => "Esta área no tiene un PTA aceptado."], 409);
    }

    $planId = (int) $plan['id'];
    $meses = mesesParaHabilitar($conexion, $anio, $planId);
    $cierres = cierresBloqueados($conexion, $planId);
    if (!$meses && !$cierres) {
        responderJson(["error" => "No hay avances subidos que se puedan habilitar."], 409);
    }

    // Evidencias, Causas y Acuerdos ya subidos: se vuelven a poder modificar
    if ($cierres) {
        $consulta = mysqli_prepare($conexion, "UPDATE seguimientos SET cierre_bloqueado = 0 WHERE plan_id = ?");
        mysqli_stmt_bind_param($consulta, "i", $planId);
        mysqli_stmt_execute($consulta);
        mysqli_stmt_close($consulta);
    }

    $borrar = mysqli_prepare($conexion, "DELETE FROM avances_subidos WHERE plan_id = ? AND mes = ?");
    foreach ($meses as $mes) {
        mysqli_stmt_bind_param($borrar, "ii", $planId, $mes);
        mysqli_stmt_execute($borrar);
    }
    mysqli_stmt_close($borrar);

    $partes = [];
    if ($meses) $partes[] = "su avance de " . implode(', ', array_map('nombreMes', $meses));
    if ($cierres) $partes[] = "sus evidencias";
    $texto = implode(' y ', $partes);
    registrarBitacora($conexion, "planes_trabajo", $planId, "EDITAR", "Permitió modificar $texto");
    return "El área ya puede modificar $texto. Cuando lo vuelva a subir, se bloqueará otra vez.";
}

// Mes del último avance que subió el área (el más reciente; si subió varios a la vez, el mayor).
// null si no ha subido ninguno o si Planeación lo volvió a habilitar y todavía no lo sube otra vez.
function ultimoMesSubido($conexion, $planId)
{
    $consulta = mysqli_prepare(
        $conexion,
        "SELECT mes FROM avances_subidos WHERE plan_id = ? ORDER BY fecha_subido DESC, mes DESC LIMIT 1"
    );
    mysqli_stmt_bind_param($consulta, "i", $planId);
    mysqli_stmt_execute($consulta);
    $fila = mysqli_fetch_row(mysqli_stmt_get_result($consulta));
    mysqli_stmt_close($consulta);
    return $fila ? (int) $fila[0] : null;
}

// Seguimiento (1 o 2) del plan, solo si el área ya subió su avance; null si no
function seguimientoSubido($conexion, $planId, $periodo)
{
    $consulta = mysqli_prepare(
        $conexion,
        "SELECT id FROM seguimientos WHERE plan_id = ? AND periodo = ? AND fecha_envio IS NOT NULL"
    );
    mysqli_stmt_bind_param($consulta, "ii", $planId, $periodo);
    mysqli_stmt_execute($consulta);
    $fila = mysqli_fetch_row(mysqli_stmt_get_result($consulta));
    mysqli_stmt_close($consulta);
    return $fila ? (int) $fila[0] : null;
}

// ¿Se ven los campos de cierre de ese seguimiento y Planeación puede escribir sus Observaciones?
function estadoCierre($conexion, $anio, $plan, $periodo)
{
    $visible = cierreVisible($conexion, $anio, $periodo, (int) $plan['id']);
    $subido = seguimientoSubido($conexion, (int) $plan['id'], $periodo) !== null;
    return [
        "visible" => $visible,
        "subido" => $subido,
        "editable" => $visible && $subido && $plan['estado'] === 'APROBADO' && !ptaFinalizado($conexion, $anio),
    ];
}

// Agrega a cada acción los campos de cierre de los 2 seguimientos (solo de los que el área ya subió)
function agregarCierres($conexion, $planId, $acciones)
{
    foreach ($acciones as &$accion) {
        $accion['cierre'] = [1 => null, 2 => null];
    }
    unset($accion);

    foreach ([1, 2] as $periodo) {
        $seguimientoId = seguimientoSubido($conexion, $planId, $periodo);
        if (!$seguimientoId) continue;
        $consulta = mysqli_prepare(
            $conexion,
            "SELECT accion_id, evidencias, causas_incumplimiento, acuerdos_compromisos, observaciones_planeacion
             FROM seguimientos_acciones WHERE seguimiento_id = ?"
        );
        mysqli_stmt_bind_param($consulta, "i", $seguimientoId);
        mysqli_stmt_execute($consulta);
        $porAccion = [];
        foreach (mysqli_fetch_all(mysqli_stmt_get_result($consulta), MYSQLI_ASSOC) as $fila) {
            $porAccion[(int) $fila['accion_id']] = $fila;
        }
        mysqli_stmt_close($consulta);

        foreach ($acciones as &$accion) {
            $fila = $porAccion[$accion['id']] ?? [];
            $accion['cierre'][$periodo] = [
                "evidencias" => $fila['evidencias'] ?? '',
                "causas" => $fila['causas_incumplimiento'] ?? '',
                "acuerdos" => $fila['acuerdos_compromisos'] ?? '',
                "observaciones_planeacion" => $fila['observaciones_planeacion'] ?? '',
            ];
        }
        unset($accion);
    }
    return $acciones;
}

// Planeación escribe sus Observaciones de una acción en un seguimiento.
// Recibe {id: unidad, periodo: 1|2, accion_id, texto}
function guardarObservacionPlaneacion($conexion, $datos, $anio)
{
    $unidadId = (int) ($datos['id'] ?? 0);
    $periodo = (int) ($datos['periodo'] ?? 0);
    $accionId = (int) ($datos['accion_id'] ?? 0);
    $texto = trim((string) ($datos['texto'] ?? ''));
    if ($periodo !== 1 && $periodo !== 2) {
        responderJson(["error" => "Seguimiento no válido."], 422);
    }
    if (mb_strlen($texto) > 2000) {
        responderJson(["error" => "La observación es muy larga (máximo 2000 caracteres)."], 422);
    }

    $consulta = mysqli_prepare($conexion, "SELECT id, estado FROM planes_trabajo WHERE unidad_responsable_id = ? AND anio = ?");
    mysqli_stmt_bind_param($consulta, "ii", $unidadId, $anio);
    mysqli_stmt_execute($consulta);
    $plan = mysqli_fetch_assoc(mysqli_stmt_get_result($consulta));
    mysqli_stmt_close($consulta);
    if (!$plan) {
        responderJson(["error" => "Esta área no tiene PTA de este año."], 404);
    }
    if (!estadoCierre($conexion, $anio, $plan, $periodo)['editable']) {
        responderJson(["error" => "Todavía no se pueden escribir observaciones en este seguimiento."], 409);
    }

    // La acción tiene que ser de este plan
    $consulta = mysqli_prepare($conexion, "SELECT id FROM acciones_estrategicas WHERE id = ? AND plan_id = ?");
    $planId = (int) $plan['id'];
    mysqli_stmt_bind_param($consulta, "ii", $accionId, $planId);
    mysqli_stmt_execute($consulta);
    $existe = mysqli_fetch_row(mysqli_stmt_get_result($consulta));
    mysqli_stmt_close($consulta);
    if (!$existe) {
        responderJson(["error" => "La acción no pertenece a esta área."], 422);
    }

    $seguimientoId = seguimientoSubido($conexion, $planId, $periodo);
    $valor = $texto === '' ? null : $texto;
    $consulta = mysqli_prepare(
        $conexion,
        "INSERT INTO seguimientos_acciones (seguimiento_id, accion_id, observaciones_planeacion) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE observaciones_planeacion = VALUES(observaciones_planeacion)"
    );
    mysqli_stmt_bind_param($consulta, "iis", $seguimientoId, $accionId, $valor);
    mysqli_stmt_execute($consulta);
    mysqli_stmt_close($consulta);
    registrarBitacora($conexion, "seguimientos", $seguimientoId, "EDITAR", "Borrador de observación de Planeación (seguimiento $periodo)");
}

// Planeación habilita a mano los campos de cierre de UN seguimiento de un área ($periodo = 1 o 2),
// sin esperar a julio / diciembre; con $periodo = 0 los quita. Si ya tocan por fecha, se siguen viendo.
function cambiarCierreHabilitado($conexion, $unidadId, $periodo, $anio)
{
    if (!in_array($periodo, [0, 1, 2], true)) {
        responderJson(["error" => "Semestre no válido."], 422);
    }
    if (ptaFinalizado($conexion, $anio)) {
        responderJson(["error" => "El PTA $anio ya fue finalizado."], 409);
    }
    $consulta = mysqli_prepare($conexion, "SELECT id, estado FROM planes_trabajo WHERE unidad_responsable_id = ? AND anio = ?");
    mysqli_stmt_bind_param($consulta, "ii", $unidadId, $anio);
    mysqli_stmt_execute($consulta);
    $plan = mysqli_fetch_assoc(mysqli_stmt_get_result($consulta));
    mysqli_stmt_close($consulta);
    if (!$plan || $plan['estado'] !== 'APROBADO') {
        responderJson(["error" => "Esta área no tiene un PTA aceptado."], 409);
    }

    $planId = (int) $plan['id'];
    // Si las evidencias de ese semestre ya se muestran (por fecha), no hace falta habilitarlas
    if ($periodo && cierreVisible($conexion, $anio, $periodo, $planId)) {
        responderJson(["error" => "Las evidencias de ese semestre ya se muestran."], 409);
    }
    $consulta = mysqli_prepare($conexion, "UPDATE planes_trabajo SET cierre_habilitado = ? WHERE id = ?");
    mysqli_stmt_bind_param($consulta, "ii", $periodo, $planId);
    mysqli_stmt_execute($consulta);
    mysqli_stmt_close($consulta);

    $nombre = [1 => 'Primer seguimiento', 2 => 'Segundo seguimiento'][$periodo] ?? '';
    registrarBitacora($conexion, "planes_trabajo", $planId, "EDITAR",
        $periodo ? "Mostró Evidencias, Causas y Acuerdos del $nombre" : "Ocultó Evidencias, Causas y Acuerdos");
    return $periodo
        ? "El área ya puede llenar Evidencias, Causas y Acuerdos en su $nombre."
        : "Se ocultaron las evidencias. El área ya no las ve hasta que las vuelvas a mostrar.";
}

// ¿Hay observaciones de Planeación (borrador) distintas a las que ya se enviaron al área?
function observacionesPendientes($conexion, $planId)
{
    $consulta = mysqli_prepare(
        $conexion,
        "SELECT COUNT(*) FROM seguimientos_acciones sa JOIN seguimientos s ON s.id = sa.seguimiento_id
         WHERE s.plan_id = ? AND NOT (sa.observaciones_planeacion <=> sa.observaciones_enviadas)"
    );
    mysqli_stmt_bind_param($consulta, "i", $planId);
    mysqli_stmt_execute($consulta);
    $total = (int) mysqli_fetch_row(mysqli_stmt_get_result($consulta))[0];
    mysqli_stmt_close($consulta);
    return $total > 0;
}

// Planeación envía al área sus observaciones: el borrador pasa a ser lo que ve el área
function enviarObservaciones($conexion, $unidadId, $anio)
{
    if (ptaFinalizado($conexion, $anio)) {
        responderJson(["error" => "El PTA $anio ya fue finalizado."], 409);
    }
    $consulta = mysqli_prepare($conexion, "SELECT id FROM planes_trabajo WHERE unidad_responsable_id = ? AND anio = ?");
    mysqli_stmt_bind_param($consulta, "ii", $unidadId, $anio);
    mysqli_stmt_execute($consulta);
    $plan = mysqli_fetch_assoc(mysqli_stmt_get_result($consulta));
    mysqli_stmt_close($consulta);
    if (!$plan) {
        responderJson(["error" => "Esta área no tiene PTA de este año."], 404);
    }
    $planId = (int) $plan['id'];
    if (!observacionesPendientes($conexion, $planId)) {
        responderJson(["error" => "No hay observaciones nuevas que enviar."], 409);
    }

    $consulta = mysqli_prepare(
        $conexion,
        "UPDATE seguimientos_acciones sa JOIN seguimientos s ON s.id = sa.seguimiento_id
         SET sa.observaciones_enviadas = sa.observaciones_planeacion
         WHERE s.plan_id = ?"
    );
    mysqli_stmt_bind_param($consulta, "i", $planId);
    mysqli_stmt_execute($consulta);
    mysqli_stmt_close($consulta);

    registrarBitacora($conexion, "planes_trabajo", $planId, "OBSERVAR", "Envió sus observaciones de los seguimientos al área");
    return "Observaciones enviadas. El área ya las puede ver en sus seguimientos.";
}

// Seguimientos (1, 2) cuyas Evidencias, Causas y Acuerdos ya subió el área y quedaron bloqueados
function cierresBloqueados($conexion, $planId)
{
    $consulta = mysqli_prepare($conexion, "SELECT periodo FROM seguimientos WHERE plan_id = ? AND cierre_bloqueado = 1 ORDER BY periodo");
    mysqli_stmt_bind_param($consulta, "i", $planId);
    mysqli_stmt_execute($consulta);
    $periodos = array_map('intval', array_column(mysqli_fetch_all(mysqli_stmt_get_result($consulta)), 0));
    mysqli_stmt_close($consulta);
    return $periodos;
}

// Semestre en el que va el área: 1 (enero a junio) o 2 (julio a diciembre).
// Un PTA de un año pasado ya está en el segundo; uno de un año que no llega, en el primero.
function semestreActual($anio)
{
    $mes = mesDeCaptura($anio);
    if ($mes === 0) {
        return (int) $anio < (int) date('Y') ? 2 : 1;
    }
    return $mes <= 6 ? 1 : 2;
}
