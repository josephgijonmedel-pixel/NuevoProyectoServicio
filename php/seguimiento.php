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

        // Solo se captura el mes en curso; los demás meses están bloqueados
        $mesCaptura = mesDeCaptura($anio);
        if ($mesCaptura < $primerMes || $mesCaptura > $primerMes + 5) {
            responderJson(["error" => "En este seguimiento no hay un mes abierto para capturar. Solo se captura lo realizado del mes en curso."], 409);
        }

        $datos = json_decode(file_get_contents("php://input"), true);
        $acciones = validarAcciones($conexion, $planId, $datos['acciones'] ?? null);

        mysqli_begin_transaction($conexion);
        $seguimiento = obtenerSeguimiento($conexion, $planId, $periodo);
        $esNuevo = !$seguimiento;
        if ($esNuevo) {
            $seguimiento = crearSeguimiento($conexion, $planId, $periodo);
        }

        guardarRealizado($conexion, $acciones, $primerMes, $mesCaptura);
        // Actualiza la fecha de modificación del seguimiento aunque no cambie otro campo
        mysqli_query($conexion, "UPDATE seguimientos SET fecha_modificacion = NOW() WHERE id = " . (int) $seguimiento['id']);
        registrarBitacora($conexion, "seguimientos", (int) $seguimiento['id'], $esNuevo ? "CREAR" : "EDITAR", "periodo $periodo");
        mysqli_commit($conexion);

        $respuesta = armarRespuesta($conexion, $unidadId, $anio, $periodo, $primerMes);
        $respuesta["mensaje"] = "Seguimiento guardado correctamente.";
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

    return [
        "unidad" => ["nombre" => nombreUnidad($conexion, $unidadId)],
        "anio" => $anio,
        "periodo" => $periodo,
        "hayPlan" => (bool) $plan,
        "seguimiento" => [
            "editable" => $plan ? seguimientoEditable($plan, $finalizado) : false,
            "motivo_bloqueo" => $plan && !seguimientoEditable($plan, $finalizado) ? motivoBloqueo($plan, $finalizado, $anio) : null,
            "guardado" => (bool) $seguimiento,
            "mes_captura" => mesDeCaptura($anio),   // único mes que se puede escribir (1-12); 0 = ninguno
            "primer_mes" => $primerMes,             // 1 = enero (Primer seguimiento), 7 = julio (Segundo)
            "estado_programacion" => $plan['estado'] ?? null,
            "estado_final" => $plan['estado_final'] ?? null,
        ],
        "acciones" => $plan ? obtenerAcciones($conexion, (int) $plan['id'], $primerMes) : [],
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
    $consulta = mysqli_prepare($conexion, "SELECT id, estado FROM seguimientos WHERE plan_id = ? AND periodo = ?");
    mysqli_stmt_bind_param($consulta, "ii", $planId, $periodo);
    mysqli_stmt_execute($consulta);
    $seguimiento = mysqli_fetch_assoc(mysqli_stmt_get_result($consulta));
    mysqli_stmt_close($consulta);
    return $seguimiento;
}

// Acciones del plan con sus textos y los 6 meses del semestre: programado (p) y realizado (r)
function obtenerAcciones($conexion, $planId, $primerMes)
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
        ];
    }
    mysqli_stmt_close($consulta);

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

        $limpias[] = ["id" => $id, "r" => $valores];
    }

    if ($errores) {
        responderJson(["error" => "Revisa las acciones marcadas.", "errores" => $errores], 422);
    }
    return $limpias;
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
// Guarda solo el mes en curso ($mesCaptura); lo que llegue de los demás meses se ignora
function guardarRealizado($conexion, $acciones, $primerMes, $mesCaptura)
{
    $guardarMes = mysqli_prepare(
        $conexion,
        "INSERT INTO metas_mensuales (accion_id, mes, realizado) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE realizado = VALUES(realizado)"
    );
    foreach ($acciones as $a) {
        foreach ($a['r'] as $indice => $realizado) {
            $mes = $primerMes + $indice;
            if ($mes !== $mesCaptura) {
                continue; // mes bloqueado: ya pasó o todavía no llega
            }
            mysqli_stmt_bind_param($guardarMes, "iii", $a['id'], $mes, $realizado);
            mysqli_stmt_execute($guardarMes);
        }
    }
    mysqli_stmt_close($guardarMes);
}

// Único mes en el que se puede capturar lo realizado: el mes en curso (1-12),
// y solo si el PTA activo es del año en curso. 0 = ningún mes.
function mesDeCaptura($anio)
{
    return (int) date('Y') === (int) $anio ? (int) date('n') : 0;
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
            return "Planeación rechazó tu PTA. Corrígelo en Inicio y vuelve a guardarlo; podrás capturar tus avances cuando lo acepte.";
        case 'APROBADO':
            return "Tu PTA final ya se envió a Planeación; ya no se puede modificar.";
        default:
            return "Todavía no puedes capturar tus avances.";
    }
}
