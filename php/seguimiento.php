<?php
// Seguimiento semestral del plan de trabajo del año actual.
//   GET  seguimiento.php?periodo=1  → acciones del plan con lo programado y lo realizado del semestre
//   POST seguimiento.php?periodo=1  → recibe JSON {acciones: [{id, r: [6 meses]}]} y guarda lo realizado
//
// periodo 1 = enero a junio, periodo 2 = julio a diciembre.
// Aquí solo se captura lo REALIZADO; lo programado viene de Programación y es de solo lectura.
// El registro en `seguimientos` se crea la primera vez que se guarda.
//
// Los seguimientos no se envían a Planeación: Planeación los consulta en "Ver áreas".
// Solo se pueden capturar cuando Planeación ya aceptó el PTA (estado APROBADO).

require "sesion.php";
$unidadId = requerirUnidad();
require "conexion.php";

$anio = anioActivo($conexion);

// Aviso cuando el área ya subió Evidencias, Causas y Acuerdos
const AVISO_CIERRE_BLOQUEADO = "Ya subiste tus evidencias de este seguimiento. Si necesitas modificarlas, pide a Planeación que lo habilite.";

$periodo = (int) ($_GET['periodo'] ?? 0);
if ($periodo !== 1 && $periodo !== 2) {
    responderJson(["error" => "Periodo no válido (debe ser 1 o 2)."], 400);
}
// Meses del semestre: 1..6 o 7..12
$primerMes = $periodo === 1 ? 1 : 7;

try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        responderJson(armarRespuesta($conexion, $unidadId, $anio, $periodo, $primerMes));
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $plan = obtenerPlan($conexion, $unidadId, $anio);
        if (!$plan) {
            responderJson(["error" => "Primero guarda tu Programación."], 409);
        }
        $finalizado = ptaFinalizado($conexion, $anio);
        if (!seguimientoEditable($plan, $finalizado)) {
            responderJson(["error" => motivoBloqueo($plan, $finalizado, $anio)], 409);
        }
        $planId = (int) $plan['id'];

        // Meses que se pueden escribir: el mes en curso (o todos, si Planeación los habilitó),
        // menos los que el área ya subió (esos solo se modifican si Planeación lo permite)
        $mesesAbiertos = mesesAbiertos($conexion, $anio, $planId, $primerMes);
        // Al terminar el semestre también se escriben Evidencias, Causas y Acuerdos,
        // hasta que el área los sube (después solo se modifican si Planeación lo permite)
        $seguimientoActual = obtenerSeguimiento($conexion, $planId, $periodo);
        $cierreBloqueado = $seguimientoActual && (int) $seguimientoActual['cierre_bloqueado'] === 1;
        $cierreEditable = cierreVisible($conexion, $anio, $periodo, $planId) && !$cierreBloqueado;
        if (!$mesesAbiertos && !$cierreEditable) {
            responderJson(["error" => $cierreBloqueado ? AVISO_CIERRE_BLOQUEADO : avisoMeses($conexion, $anio, $planId, $primerMes)], 409);
        }

        $datos = json_decode(file_get_contents("php://input"), true);
        $acciones = validarAcciones($conexion, $planId, $datos['acciones'] ?? null);

        mysqli_begin_transaction($conexion);
        $seguimiento = obtenerSeguimiento($conexion, $planId, $periodo);
        $esNuevo = !$seguimiento;
        if ($esNuevo) {
            $seguimiento = crearSeguimiento($conexion, $planId, $periodo);
        }

        guardarRealizado($conexion, $acciones, $primerMes, $mesesAbiertos);
        if ($cierreEditable) {
            guardarCierre($conexion, (int) $seguimiento['id'], $acciones);
        }
        // Actualiza la fecha de modificación del seguimiento aunque no cambie otro campo
        mysqli_query($conexion, "UPDATE seguimientos SET fecha_modificacion = NOW() WHERE id = " . (int) $seguimiento['id']);

        // "Subir avance": lo capturado (borrador del área) pasa a ser lo que ve Planeación.
        // El guardado automático NO sube nada: solo guarda el borrador.
        $subir = ($_GET['accion'] ?? '') === 'subir';
        if ($subir) {
            subirAvance($conexion, $planId, $mesesAbiertos, (int) $seguimiento['id']);
            if ($cierreEditable) {
                // Evidencias, Causas y Acuerdos subidos: ya no se modifican (salvo que Planeación lo permita)
                mysqli_query($conexion, "UPDATE seguimientos SET cierre_bloqueado = 1 WHERE id = " . (int) $seguimiento['id']);
            }
            registrarBitacora($conexion, "seguimientos", (int) $seguimiento['id'], "ENVIAR", "Subió su avance (periodo $periodo)");
        } else {
            registrarBitacora($conexion, "seguimientos", (int) $seguimiento['id'], $esNuevo ? "CREAR" : "EDITAR", "periodo $periodo");
        }
        mysqli_commit($conexion);

        $respuesta = armarRespuesta($conexion, $unidadId, $anio, $periodo, $primerMes);
        $respuesta["mensaje"] = $subir
            ? "Tu avance se subió. Planeación ya lo puede ver y ya no se puede modificar."
            : "Seguimiento guardado correctamente.";
        responderJson($respuesta);
    }

    responderJson(["error" => "Método no permitido."], 405);
} catch (mysqli_sql_exception $e) {
    error_log("seguimiento.php: " . $e->getMessage());
    responderJson(["error" => "Ocurrió un error al consultar la base de datos."], 500);
}

// ---------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------

function armarRespuesta($conexion, $unidadId, $anio, $periodo, $primerMes)
{
    $plan = obtenerPlan($conexion, $unidadId, $anio);
    $seguimiento = $plan ? obtenerSeguimiento($conexion, (int) $plan['id'], $periodo) : null;
    $finalizado = ptaFinalizado($conexion, $anio);
    $editable = $plan ? seguimientoEditable($plan, $finalizado) : false;
    $cierreVisible = $plan && cierreVisible($conexion, $anio, $periodo, (int) $plan['id']);
    $cierreBloqueado = $seguimiento && (int) $seguimiento['cierre_bloqueado'] === 1;

    return [
        "unidad" => ["nombre" => nombreUnidad($conexion, $unidadId)],
        "anio" => $anio,
        "periodo" => $periodo,
        "hayPlan" => (bool) $plan,
        "seguimiento" => [
            "editable" => $plan ? seguimientoEditable($plan, $finalizado) : false,
            "motivo_bloqueo" => $plan && !seguimientoEditable($plan, $finalizado) ? motivoBloqueo($plan, $finalizado, $anio) : null,
            "guardado" => (bool) $seguimiento,
            "fecha_subido" => $seguimiento['fecha_envio'] ?? null,   // última vez que subió su avance
            "primer_mes" => $primerMes,   // 1 = enero (Primer seguimiento), 7 = julio (Segundo)
            // Meses de este semestre que se pueden escribir, y por qué no hay ninguno (si es el caso)
            "meses_abiertos" => $plan ? mesesAbiertos($conexion, $anio, (int) $plan['id'], $primerMes) : [],
            // Meses que ya terminaron (o ya subidos): si el área no envió nada, se muestran como 0
            "meses_cerrados" => $plan ? mesesRealizadoCerrados($conexion, $anio, (int) $plan['id']) : [],
            "aviso_meses" => $plan && !mesesAbiertos($conexion, $anio, (int) $plan['id'], $primerMes)
                ? avisoMeses($conexion, $anio, (int) $plan['id'], $primerMes) : null,
            "estado_programacion" => $plan['estado'] ?? null,
            "estado_final" => $plan['estado_final'] ?? null,
            // Evidencias, Causas, Acuerdos y Observaciones de Planeación (al terminar el semestre)
            "cierre_visible" => $cierreVisible,
            "cierre_editable" => $editable && $cierreVisible && !$cierreBloqueado,
            // Ya los subió: quedan bloqueados hasta que Planeación los habilite
            "cierre_bloqueado" => $cierreBloqueado,
            "aviso_cierre" => $cierreVisible && $cierreBloqueado ? AVISO_CIERRE_BLOQUEADO : null,
        ],
        // Con el PTA rechazado no se manda nada: la tabla del seguimiento se ve vacía hasta que Planeación lo acepte
        "acciones" => $plan && $plan['estado'] !== 'CON OBSERVACIONES' ? obtenerAcciones($conexion, (int) $plan['id'], $primerMes, $seguimiento ? (int) $seguimiento['id'] : null) : [],
    ];
}

function nombreUnidad($conexion, $unidadId)
{
    $consulta = mysqli_prepare($conexion, "SELECT nombre FROM unidades_responsables WHERE id = ?");
    mysqli_stmt_bind_param($consulta, "i", $unidadId);
    mysqli_stmt_execute($consulta);
    $fila = mysqli_fetch_assoc(mysqli_stmt_get_result($consulta));
    mysqli_stmt_close($consulta);
    return $fila['nombre'] ?? '';
}

function obtenerPlan($conexion, $unidadId, $anio)
{
    $consulta = mysqli_prepare(
        $conexion,
        "SELECT id, estado, estado_final FROM planes_trabajo WHERE unidad_responsable_id = ? AND anio = ?"
    );
    mysqli_stmt_bind_param($consulta, "ii", $unidadId, $anio);
    mysqli_stmt_execute($consulta);
    $plan = mysqli_fetch_assoc(mysqli_stmt_get_result($consulta));
    mysqli_stmt_close($consulta);
    return $plan;
}

function obtenerSeguimiento($conexion, $planId, $periodo)
{
    $consulta = mysqli_prepare($conexion, "SELECT id, estado, fecha_envio, cierre_bloqueado FROM seguimientos WHERE plan_id = ? AND periodo = ?");
    mysqli_stmt_bind_param($consulta, "ii", $planId, $periodo);
    mysqli_stmt_execute($consulta);
    $seguimiento = mysqli_fetch_assoc(mysqli_stmt_get_result($consulta));
    mysqli_stmt_close($consulta);
    return $seguimiento;
}

// Acciones del plan con sus textos, los 6 meses del semestre: programado (p) y realizado (r),
// y los campos de cierre del seguimiento (cierre)
function obtenerAcciones($conexion, $planId, $primerMes, $seguimientoId = null)
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
            "id" => (int) $fila['id'],
            "proyecto" => $fila['proyecto'],
            "linea" => $fila['linea'],
            "descripcion" => $fila['descripcion'],
            "con_recursos" => (int) $fila['con_recursos'],
            "unidad_medida" => $fila['unidad_medida'],
            "p" => array_fill(0, 6, 0),
            "r" => array_fill(0, 6, 0),
            "cierre" => ["evidencias" => "", "causas" => "", "acuerdos" => "", "observaciones_planeacion" => ""],
        ];
    }
    mysqli_stmt_close($consulta);

    // Campos de cierre ya escritos en este seguimiento
    if ($acciones && $seguimientoId) {
        $consulta = mysqli_prepare(
            $conexion,
            // El área solo ve las observaciones que Planeación ya envió (no su borrador)
            "SELECT accion_id, evidencias, causas_incumplimiento, acuerdos_compromisos,
                    observaciones_enviadas AS observaciones_planeacion
             FROM seguimientos_acciones WHERE seguimiento_id = ?"
        );
        mysqli_stmt_bind_param($consulta, "i", $seguimientoId);
        mysqli_stmt_execute($consulta);
        $resultado = mysqli_stmt_get_result($consulta);
        while ($fila = mysqli_fetch_assoc($resultado)) {
            if (!isset($acciones[(int) $fila['accion_id']])) continue;
            $acciones[(int) $fila['accion_id']]['cierre'] = [
                "evidencias" => $fila['evidencias'] ?? '',
                "causas" => $fila['causas_incumplimiento'] ?? '',
                "acuerdos" => $fila['acuerdos_compromisos'] ?? '',
                "observaciones_planeacion" => $fila['observaciones_planeacion'] ?? '',
            ];
        }
        mysqli_stmt_close($consulta);
    }

    if ($acciones) {
        $ultimoMes = $primerMes + 5;
        $consulta = mysqli_prepare(
            $conexion,
            "SELECT m.accion_id, m.mes, m.programado, m.realizado
             FROM metas_mensuales m JOIN acciones_estrategicas a ON a.id = m.accion_id
             WHERE a.plan_id = ? AND m.mes BETWEEN ? AND ?"
        );
        mysqli_stmt_bind_param($consulta, "iii", $planId, $primerMes, $ultimoMes);
        mysqli_stmt_execute($consulta);
        $resultado = mysqli_stmt_get_result($consulta);
        while ($meta = mysqli_fetch_assoc($resultado)) {
            $indice = (int) $meta['mes'] - $primerMes;
            $acciones[(int) $meta['accion_id']]['p'][$indice] = (int) $meta['programado'];
            $acciones[(int) $meta['accion_id']]['r'][$indice] = (int) $meta['realizado'];
        }
        mysqli_stmt_close($consulta);
    }

    return array_values($acciones);
}

// ---------------------------------------------------------------------
// Validación y escritura
// ---------------------------------------------------------------------

// Revisa que cada acción sea del plan y que traiga 6 meses de números enteros >= 0
function validarAcciones($conexion, $planId, $acciones)
{
    if (!is_array($acciones) || count($acciones) === 0) {
        responderJson(["error" => "No hay acciones que guardar."], 422);
    }

    $consulta = mysqli_prepare($conexion, "SELECT id FROM acciones_estrategicas WHERE plan_id = ?");
    mysqli_stmt_bind_param($consulta, "i", $planId);
    mysqli_stmt_execute($consulta);
    $delPlan = array_flip(array_map('intval', array_column(mysqli_fetch_all(mysqli_stmt_get_result($consulta)), 0)));
    mysqli_stmt_close($consulta);

    $limpias = [];
    $errores = [];

    foreach (array_values($acciones) as $i => $a) {
        $fila = $i + 1;
        $id = (int) ($a['id'] ?? 0);
        if (!isset($delPlan[$id])) {
            // La acción se quitó en Programación mientras esta página estaba abierta
            responderJson(["error" => "La programación cambió. Recarga la página e intenta de nuevo."], 409);
        }

        $r = $a['r'] ?? null;
        $valores = [];
        $validos = is_array($r) && count($r) === 6;
        for ($mes = 0; $validos && $mes < 6; $mes++) {
            $valor = $r[$mes] === '' || $r[$mes] === null ? 0 : $r[$mes];
            if (!is_numeric($valor) || (int) $valor != $valor || $valor < 0 || $valor > 1000000) {
                $validos = false;
            } else {
                $valores[] = (int) $valor;
            }
        }
        if (!$validos) {
            $errores[] = ["fila" => $fila, "mensaje" => "Acción $fila: lo realizado debe ser un número entero de 0 en adelante."];
        }

        // Campos de cierre (texto libre, opcionales)
        $cierre = [];
        foreach (CAMPOS_CIERRE_AREA as $columna => $nombre) {
            $texto = trim((string) ($a[$nombre] ?? ''));
            if (mb_strlen($texto) > 2000) {
                $errores[] = ["fila" => $fila, "mensaje" => "Acción $fila: el texto es muy largo (máximo 2000 caracteres)."];
            }
            $cierre[$columna] = $texto === '' ? null : $texto;
        }

        $limpias[] = ["id" => $id, "r" => $valores, "cierre" => $cierre];
    }

    if ($errores) {
        responderJson(["error" => "Revisa las acciones marcadas.", "errores" => $errores], 422);
    }
    return $limpias;
}

// Guarda Evidencias, Causas y Acuerdos de cada acción (las Observaciones las escribe Planeación)
function guardarCierre($conexion, $seguimientoId, $acciones)
{
    $consulta = mysqli_prepare(
        $conexion,
        "INSERT INTO seguimientos_acciones (seguimiento_id, accion_id, evidencias, causas_incumplimiento, acuerdos_compromisos)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE evidencias = VALUES(evidencias),
                                 causas_incumplimiento = VALUES(causas_incumplimiento),
                                 acuerdos_compromisos = VALUES(acuerdos_compromisos)"
    );
    foreach ($acciones as $a) {
        $c = $a['cierre'];
        mysqli_stmt_bind_param($consulta, "iisss", $seguimientoId, $a['id'],
            $c['evidencias'], $c['causas_incumplimiento'], $c['acuerdos_compromisos']);
        mysqli_stmt_execute($consulta);
    }
    mysqli_stmt_close($consulta);
}

function crearSeguimiento($conexion, $planId, $periodo)
{
    $consulta = mysqli_prepare($conexion, "INSERT INTO seguimientos (plan_id, periodo, estado) VALUES (?, ?, 'BORRADOR')");
    mysqli_stmt_bind_param($consulta, "ii", $planId, $periodo);
    mysqli_stmt_execute($consulta);
    mysqli_stmt_close($consulta);
    return obtenerSeguimiento($conexion, $planId, $periodo);
}

// Solo cambia lo realizado; lo programado se conserva
// Copia lo capturado en los meses abiertos (realizado) a lo que ve Planeación (realizado_enviado),
// anota la fecha y deja esos meses bloqueados para el área (avances_subidos).
function subirAvance($conexion, $planId, $meses, $seguimientoId)
{
    $copiar = mysqli_prepare(
        $conexion,
        "UPDATE metas_mensuales m JOIN acciones_estrategicas a ON a.id = m.accion_id
         SET m.realizado_enviado = m.realizado
         WHERE a.plan_id = ? AND m.mes = ?"
    );
    $bloquear = mysqli_prepare(
        $conexion,
        "INSERT INTO avances_subidos (plan_id, mes) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE fecha_subido = NOW()"
    );
    foreach ($meses as $mes) {
        mysqli_stmt_bind_param($copiar, "ii", $planId, $mes);
        mysqli_stmt_execute($copiar);
        mysqli_stmt_bind_param($bloquear, "ii", $planId, $mes);
        mysqli_stmt_execute($bloquear);
    }
    mysqli_stmt_close($copiar);
    mysqli_stmt_close($bloquear);

    mysqli_query($conexion, "UPDATE seguimientos SET estado = 'ENVIADO', fecha_envio = NOW() WHERE id = " . (int) $seguimientoId);
}

// Guarda solo los meses abiertos ($meses); lo que llegue de los demás meses se ignora
function guardarRealizado($conexion, $acciones, $primerMes, $meses)
{
    $guardarMes = mysqli_prepare(
        $conexion,
        "INSERT INTO metas_mensuales (accion_id, mes, realizado) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE realizado = VALUES(realizado)"
    );
    foreach ($acciones as $a) {
        foreach ($a['r'] as $indice => $realizado) {
            $mes = $primerMes + $indice;
            if (!in_array($mes, $meses, true)) {
                continue; // mes bloqueado: ya pasó, no llega o ya se subió
            }
            mysqli_stmt_bind_param($guardarMes, "iii", $a['id'], $mes, $realizado);
            mysqli_stmt_execute($guardarMes);
        }
    }
    mysqli_stmt_close($guardarMes);
}

// Meses de este semestre que el área puede escribir: los que deja la regla (mes en curso,
// o todos si Planeación los habilitó) menos los que ya subió.
function mesesAbiertos($conexion, $anio, $planId, $primerMes)
{
    $delSemestre = array_filter(mesesDeCaptura($conexion, $anio), fn($mes) => $mes >= $primerMes && $mes <= $primerMes + 5);
    return array_values(array_diff($delSemestre, mesesSubidos($conexion, $planId)));
}

// Por qué no hay ningún mes abierto en este seguimiento
function avisoMeses($conexion, $anio, $planId, $primerMes)
{
    $delSemestre = array_values(array_filter(mesesDeCaptura($conexion, $anio), fn($mes) => $mes >= $primerMes && $mes <= $primerMes + 5));
    if ($delSemestre) {
        // Había meses abiertos, pero el área ya los subió
        return count($delSemestre) === 1
            ? "Ya subiste tu avance de " . nombreMes($delSemestre[0]) . ". Si necesitas modificarlo, pide a Planeación que lo habilite."
            : "Ya subiste tus avances de este semestre. Si necesitas modificarlos, pide a Planeación que los habilite.";
    }
    $mes = mesDeCaptura($anio);
    if ($mes === 0) {
        return "No hay meses abiertos para capturar en este PTA.";
    }
    return $mes > $primerMes + 5
        ? "Avances del primer semestre concluidos."
        : "Los avances del segundo semestre se capturan a partir de julio.";
}

// ¿Se puede capturar lo realizado? Solo cuando Planeación ya aceptó el PTA
// (y Planeación no ha finalizado el PTA del año)
function seguimientoEditable($plan, $finalizado)
{
    return !$finalizado && $plan['estado'] === 'APROBADO' && $plan['estado_final'] === 'BORRADOR';
}

// Explicación de por qué no se puede capturar lo realizado
function motivoBloqueo($plan, $finalizado, $anio)
{
    if ($finalizado) {
        return "Planeación finalizó el PTA $anio; ya no se pueden capturar avances.";
    }
    switch ($plan['estado']) {
        case 'ENVIADO':
            return "Tu PTA está en revisión por Planeación. Podrás capturar tus avances cuando lo acepte.";
        case 'CON OBSERVACIONES':
            return "Planeación rechazó tu PTA. Podrás capturar tus avances cuando lo acepte.";
        case 'APROBADO':
            return "Tu PTA final ya se envió a Planeación; ya no se puede modificar.";
        default:
            return "Todavía no puedes capturar tus avances.";
    }
}
