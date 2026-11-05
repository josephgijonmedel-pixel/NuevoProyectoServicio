<?php
// Plan de trabajo del año actual de la Unidad Responsable que inició sesión.
//   GET  → devuelve el plan (si existe), sus acciones con los 12 meses y los catálogos
//   POST → recibe JSON {acciones: [...]} y guarda la programación completa
//
// Reglas:
//   * Un plan por unidad por año (se crea solo la primera vez que se guarda).
//   * Aquí solo se captura lo PROGRAMADO; lo REALIZADO se captura en los seguimientos
//     y aquí solo se muestra (guardar la programación no lo borra).
//   * Al guardar, el PTA se envía a Planeación (ENVIADO) y queda bloqueado mientras lo revisa.
//     Si Planeación lo rechaza (CON OBSERVACIONES) se puede corregir y volver a guardar;
//     si lo acepta (APROBADO) ya no se modifica y se habilitan los seguimientos.

require "sesion.php";
$unidadId = requerirUnidad();
require "conexion.php";

// Estados del PTA (columna planes_trabajo.estado):
//   ENVIADO            → el área lo guardó y Planeación lo está revisando (bloqueado)
//   CON OBSERVACIONES  → Planeación lo rechazó con un motivo; el área lo corrige y lo vuelve a guardar
//   APROBADO           → Planeación lo aceptó; ya se capturan los seguimientos (bloqueado)
// La Programación solo se puede guardar cuando todavía no existe o cuando fue rechazada.
const ESTADOS_EDITABLES = ['CON OBSERVACIONES'];
// Columnas de texto libre de cada acción (después del Total Anual en la pantalla)
const CAMPOS_COMPLEMENTARIOS = ['beneficiados', 'responsables', 'participantes', 'observaciones_generales'];
$anio = anioActivo($conexion);

try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        responderJson(armarRespuesta($conexion, $unidadId, $anio));
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $datos = json_decode(file_get_contents("php://input"), true);
        $plan = obtenerPlan($conexion, $unidadId, $anio);

        if (ptaFinalizado($conexion, $anio)) {
            responderJson(["error" => "Planeación finalizó el PTA $anio; ya no se puede modificar."], 409);
        }
        if ($plan && !in_array($plan['estado'], ESTADOS_EDITABLES, true)) {
            $motivo = $plan['estado'] === 'APROBADO'
                ? "Planeación ya aceptó tu PTA; no se puede modificar."
                : "Tu PTA está en revisión por Planeación; no se puede modificar.";
            responderJson(["error" => $motivo], 409);
        }

        // Primera vez (se crea el plan) o corrección después de un rechazo (se reemplaza lo programado).
        // En los dos casos el PTA queda ENVIADO: en revisión por Planeación.
        $acciones = validarAcciones($conexion, $datos['acciones'] ?? null);
        mysqli_begin_transaction($conexion);
        $esNuevo = !$plan;
        if ($esNuevo) {
            $plan = crearPlan($conexion, $unidadId, $anio);
        }
        guardarAcciones($conexion, (int) $plan['id'], $acciones);
        mysqli_query($conexion, "UPDATE planes_trabajo SET estado = 'ENVIADO', fecha_envio = NOW() WHERE id = " . (int) $plan['id']);
        registrarBitacora($conexion, "planes_trabajo", (int) $plan['id'], "ENVIAR", $esNuevo ? "PTA enviado a revisión" : "PTA corregido y reenviado a revisión");
        mysqli_commit($conexion);

        $respuesta = armarRespuesta($conexion, $unidadId, $anio);
        $respuesta["mensaje"] = "Tu PTA se envió a Planeación para su revisión.";
        responderJson($respuesta);
    }

    responderJson(["error" => "Método no permitido."], 405);
} catch (mysqli_sql_exception $e) {
    error_log("programacion.php: " . $e->getMessage());
    responderJson(["error" => "Ocurrió un error al consultar la base de datos."], 500);
}

// ---------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------

function armarRespuesta($conexion, $unidadId, $anio)
{
    $plan = obtenerPlan($conexion, $unidadId, $anio);
    $finalizado = ptaFinalizado($conexion, $anio);

    return [
        "unidad" => ["nombre" => nombreUnidad($conexion, $unidadId)],
        "anio" => $anio,
        "finalizado" => $finalizado,   // Planeación cerró el PTA de este año: todo de solo lectura
        "plan" => $plan ? [
            "id" => (int) $plan['id'],
            "estado" => $plan['estado'],
            "editable" => !$finalizado && in_array($plan['estado'], ESTADOS_EDITABLES, true),
            "observaciones" => $plan['observaciones_planeacion'],   // motivo del rechazo
            "estado_final" => $plan['estado_final'],
        ] : null,
        "acciones" => $plan ? obtenerAcciones($conexion, (int) $plan['id']) : [],
        "catalogos" => obtenerCatalogos($conexion),
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
        "SELECT id, estado, estado_final, observaciones_planeacion FROM planes_trabajo
         WHERE unidad_responsable_id = ? AND anio = ?"
    );
    mysqli_stmt_bind_param($consulta, "ii", $unidadId, $anio);
    mysqli_stmt_execute($consulta);
    $plan = mysqli_fetch_assoc(mysqli_stmt_get_result($consulta));
    mysqli_stmt_close($consulta);
    return $plan;
}

// Acciones del plan, cada una con sus 12 meses de programado (p) y realizado (r)
function obtenerAcciones($conexion, $planId)
{
    $consulta = mysqli_prepare(
        $conexion,
        "SELECT a.id, a.lineas_accion_id, o.proyecto_id, a.descripcion, a.con_recursos, a.unidad_medida_id,
                a.beneficiados, a.responsables, a.participantes, a.observaciones_generales
         FROM acciones_estrategicas a
         JOIN lineas_accion l ON l.id = a.lineas_accion_id
         JOIN objetivos_especificos o ON o.id = l.objetivo_id
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
            "linea_id" => (int) $fila['lineas_accion_id'],
            "proyecto_id" => (int) $fila['proyecto_id'],
            "descripcion" => $fila['descripcion'],
            "con_recursos" => (int) $fila['con_recursos'],
            "unidad_medida_id" => (int) $fila['unidad_medida_id'],
            "beneficiados" => $fila['beneficiados'] ?? '',
            "responsables" => $fila['responsables'] ?? '',
            "participantes" => $fila['participantes'] ?? '',
            "observaciones_generales" => $fila['observaciones_generales'] ?? '',
            "p" => array_fill(0, 12, 0),
            "r" => array_fill(0, 12, 0),
        ];
    }
    mysqli_stmt_close($consulta);

    if ($acciones) {
        $consulta = mysqli_prepare(
            $conexion,
            "SELECT m.accion_id, m.mes, m.programado, m.realizado
             FROM metas_mensuales m
             JOIN acciones_estrategicas a ON a.id = m.accion_id
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

function obtenerCatalogos($conexion)
{
    $todos = fn($sql) => mysqli_fetch_all(mysqli_query($conexion, $sql), MYSQLI_ASSOC);

    return [
        "proyectos" => $todos("SELECT id, clave, nombre FROM proyectos_institucionales ORDER BY CAST(clave AS UNSIGNED), id"),
        "lineas" => $todos(
            "SELECT l.id, o.proyecto_id, l.clave, l.descripcion
             FROM lineas_accion l JOIN objetivos_especificos o ON o.id = l.objetivo_id
             ORDER BY o.proyecto_id, l.clave"
        ),
        "unidades" => $todos("SELECT id, nombre FROM unidades_medida ORDER BY nombre"),
    ];
}

// ---------------------------------------------------------------------
// Validación
// ---------------------------------------------------------------------

// Revisa las acciones recibidas; si algo está mal responde 422 con los errores por fila.
function validarAcciones($conexion, $acciones)
{
    if (!is_array($acciones) || count($acciones) === 0) {
        responderJson(["error" => "Agrega al menos una acción estratégica."], 422);
    }
    // Máximo 4 proyectos estratégicos (filas) por PTA; la página revisa el mismo límite
    if (count($acciones) > 4) {
        responderJson(["error" => "Solo puedes tener un máximo de 4 proyectos estratégicos en tu PTA."], 422);
    }

    $idsDe = fn($sql) => array_map('intval', array_column(mysqli_fetch_all(mysqli_query($conexion, $sql)), 0));
    $lineasValidas = array_flip($idsDe("SELECT id FROM lineas_accion"));
    $unidadesValidas = array_flip($idsDe("SELECT id FROM unidades_medida"));

    $limpias = [];
    $errores = [];

    foreach (array_values($acciones) as $i => $a) {
        $fila = $i + 1;
        $a = is_array($a) ? $a : [];

        $accion = [
            "id" => isset($a['id']) && $a['id'] !== '' && $a['id'] !== null ? (int) $a['id'] : null,
            "linea_id" => (int) ($a['linea_id'] ?? 0),
            "descripcion" => trim((string) ($a['descripcion'] ?? '')),
            "con_recursos" => !empty($a['con_recursos']) ? 1 : 0,
            "unidad_medida_id" => (int) ($a['unidad_medida_id'] ?? 0),
            "p" => [],
        ];

        // Texto libre obligatorio: Beneficiados, Responsable(s), Participantes y Observaciones Generales
        $nombresCampos = [
            'beneficiados' => 'Beneficiados', 'responsables' => 'Responsable(s)',
            'participantes' => 'Participantes', 'observaciones_generales' => 'Observaciones Generales',
        ];
        foreach (CAMPOS_COMPLEMENTARIOS as $campo) {
            $texto = trim((string) ($a[$campo] ?? ''));
            if ($texto === '') {
                $errores[] = ["fila" => $fila, "campo" => $campo, "mensaje" => "Acción $fila: escribe {$nombresCampos[$campo]}."];
            } elseif (mb_strlen($texto) > 2000) {
                $errores[] = ["fila" => $fila, "campo" => $campo, "mensaje" => "Acción $fila: {$nombresCampos[$campo]} es muy largo (máximo 2000 caracteres)."];
            }
            $accion[$campo] = $texto === '' ? null : $texto;
        }

        if (!isset($lineasValidas[$accion['linea_id']])) {
            $errores[] = ["fila" => $fila, "campo" => "linea_id", "mensaje" => "Acción $fila: selecciona una línea de acción."];
        }
        if ($accion['descripcion'] === '') {
            $errores[] = ["fila" => $fila, "campo" => "descripcion", "mensaje" => "Acción $fila: escribe la acción estratégica."];
        } elseif (mb_strlen($accion['descripcion']) > 2000) {
            $errores[] = ["fila" => $fila, "campo" => "descripcion", "mensaje" => "Acción $fila: la descripción es muy larga (máximo 2000 caracteres)."];
        }
        if (!isset($unidadesValidas[$accion['unidad_medida_id']])) {
            $errores[] = ["fila" => $fila, "campo" => "unidad_medida_id", "mensaje" => "Acción $fila: selecciona una unidad de medida."];
        }

        $p = $a['p'] ?? [];
        $mesesValidos = is_array($p) && count($p) === 12;
        for ($mes = 0; $mesesValidos && $mes < 12; $mes++) {
            $valor = $p[$mes] === '' || $p[$mes] === null ? 0 : $p[$mes];
            if (!is_numeric($valor) || (int) $valor != $valor || $valor < 0 || $valor > 1000000) {
                $mesesValidos = false;
            } else {
                $accion['p'][] = (int) $valor;
            }
        }
        if (!$mesesValidos) {
            $errores[] = ["fila" => $fila, "campo" => "p", "mensaje" => "Acción $fila: los meses deben ser números enteros de 0 en adelante."];
        }

        $limpias[] = $accion;
    }

    if ($errores) {
        responderJson(["error" => "Revisa las acciones marcadas.", "errores" => $errores], 422);
    }
    return $limpias;
}

// ---------------------------------------------------------------------
// Escritura (se llama dentro de una transacción)
// ---------------------------------------------------------------------

function crearPlan($conexion, $unidadId, $anio)
{
    // Se copia el responsable actual de la unidad como responsable del plan
    $consulta = mysqli_prepare(
        $conexion,
        "INSERT INTO planes_trabajo (unidad_responsable_id, anio, responsable_nombre, responsable_cargo, estado)
         SELECT ur.id, ?, ur.responsable_nombre, c.nombre, 'BORRADOR'
         FROM unidades_responsables ur LEFT JOIN cargos c ON c.id = ur.cargo_id
         WHERE ur.id = ?"
    );
    mysqli_stmt_bind_param($consulta, "ii", $anio, $unidadId);
    mysqli_stmt_execute($consulta);
    mysqli_stmt_close($consulta);

    return obtenerPlan($conexion, $unidadId, $anio);
}

function guardarAcciones($conexion, $planId, $acciones)
{
    // Ids de las acciones que ya tiene el plan
    $consulta = mysqli_prepare($conexion, "SELECT id FROM acciones_estrategicas WHERE plan_id = ?");
    mysqli_stmt_bind_param($consulta, "i", $planId);
    mysqli_stmt_execute($consulta);
    $existentes = array_flip(array_map('intval', array_column(mysqli_fetch_all(mysqli_stmt_get_result($consulta)), 0)));
    mysqli_stmt_close($consulta);

    $actualizar = mysqli_prepare(
        $conexion,
        "UPDATE acciones_estrategicas
         SET lineas_accion_id = ?, descripcion = ?, con_recursos = ?, unidad_medida_id = ?, orden = ?,
             beneficiados = ?, responsables = ?, participantes = ?, observaciones_generales = ?
         WHERE id = ? AND plan_id = ?"
    );
    $insertar = mysqli_prepare(
        $conexion,
        "INSERT INTO acciones_estrategicas (plan_id, lineas_accion_id, descripcion, con_recursos, unidad_medida_id, orden,
                                            beneficiados, responsables, participantes, observaciones_generales)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    // Solo cambia lo programado; lo realizado (de los seguimientos) se conserva
    $guardarMes = mysqli_prepare(
        $conexion,
        "INSERT INTO metas_mensuales (accion_id, mes, programado) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE programado = VALUES(programado)"
    );

    $conservadas = [];
    foreach ($acciones as $orden => $a) {
        if ($a['id'] !== null && isset($existentes[$a['id']])) {
            mysqli_stmt_bind_param($actualizar, "isiiissssii", $a['linea_id'], $a['descripcion'], $a['con_recursos'], $a['unidad_medida_id'], $orden,
                $a['beneficiados'], $a['responsables'], $a['participantes'], $a['observaciones_generales'], $a['id'], $planId);
            mysqli_stmt_execute($actualizar);
            $accionId = $a['id'];
        } else {
            // Id desconocido o vacío: es una acción nueva
            mysqli_stmt_bind_param($insertar, "iisiiissss", $planId, $a['linea_id'], $a['descripcion'], $a['con_recursos'], $a['unidad_medida_id'], $orden,
                $a['beneficiados'], $a['responsables'], $a['participantes'], $a['observaciones_generales']);
            mysqli_stmt_execute($insertar);
            $accionId = mysqli_insert_id($conexion);
        }
        $conservadas[] = (int) $accionId;

        foreach ($a['p'] as $indice => $programado) {
            $mes = $indice + 1;
            mysqli_stmt_bind_param($guardarMes, "iii", $accionId, $mes, $programado);
            mysqli_stmt_execute($guardarMes);
        }
    }
    mysqli_stmt_close($actualizar);
    mysqli_stmt_close($insertar);
    mysqli_stmt_close($guardarMes);

    // Las acciones que se quitaron de la tabla se borran (sus metas y seguimientos se borran en cascada)
    $quitadas = array_diff(array_keys($existentes), $conservadas);
    if ($quitadas) {
        $lista = implode(",", array_map('intval', $quitadas));
        mysqli_query($conexion, "DELETE FROM acciones_estrategicas WHERE plan_id = " . (int) $planId . " AND id IN ($lista)");
    }
}
