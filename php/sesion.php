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

// ¿Planeación habilitó todos los meses de los seguimientos? (botón temporal mientras se termina el proyecto)
// Normalmente solo se captura el mes en curso.
function todosLosMesesHabilitados($conexion, $anio)
{
    $consulta = mysqli_prepare($conexion, "SELECT todos_los_meses FROM periodos WHERE anio = ?");
    mysqli_stmt_bind_param($consulta, "i", $anio);
    mysqli_stmt_execute($consulta);
    $fila = mysqli_fetch_row(mysqli_stmt_get_result($consulta));
    mysqli_stmt_close($consulta);
    return $fila && (int) $fila[0] === 1;
}

// Nombre de un mes (1 = enero ... 12 = diciembre)
function nombreMes($mes)
{
    $nombres = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
                'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    return $nombres[$mes - 1] ?? '';
}

// Mes en curso (1-12) si el PTA activo es del año en curso; 0 si no.
function mesDeCaptura($anio)
{
    return (int) date('Y') === (int) $anio ? (int) date('n') : 0;
}

// Meses que la regla deja capturar: el mes en curso, o los 12 si Planeación habilitó todos los meses.
// (No toma en cuenta los avances que el área ya subió; eso lo revisa mesesSubidos.)
function mesesDeCaptura($conexion, $anio)
{
    if (todosLosMesesHabilitados($conexion, $anio)) {
        return range(1, 12);
    }
    $mes = mesDeCaptura($anio);
    return $mes ? [$mes] : [];
}

// Campos de cierre del seguimiento (Evidencias, Causas, Acuerdos y Observaciones de Planeación).
// Ya NO se muestran solos por fecha: solo cuando Planeación los muestra con el botón "Mostrar evidencias"
// del detalle del área (planes_trabajo.cierre_habilitado), un semestre a la vez.
// Con "Habilitar todos los meses" (botón temporal de Planeación) también se muestran.
function cierreVisible($conexion, $anio, $periodo, $planId = null)
{
    if (todosLosMesesHabilitados($conexion, $anio)) {
        return true;
    }
    return $planId && cierreHabilitadoPorPlaneacion($conexion, $planId) === $periodo;
}

// ¿En qué seguimiento habilitó Planeación a mano los campos de cierre de esta área?
// (botón "Mostrar evidencias" del detalle del área). 0 = ninguno, 1 = Primer seguimiento, 2 = Segundo.
// Solo uno a la vez.
function cierreHabilitadoPorPlaneacion($conexion, $planId)
{
    $consulta = mysqli_prepare($conexion, "SELECT cierre_habilitado FROM planes_trabajo WHERE id = ?");
    mysqli_stmt_bind_param($consulta, "i", $planId);
    mysqli_stmt_execute($consulta);
    $fila = mysqli_fetch_row(mysqli_stmt_get_result($consulta));
    mysqli_stmt_close($consulta);
    return $fila ? (int) $fila[0] : 0;
}

// Campos de cierre que escribe el área (columna en seguimientos_acciones => nombre en la página)
const CAMPOS_CIERRE_AREA = [
    'evidencias' => 'evidencias',
    'causas_incumplimiento' => 'causas',
    'acuerdos_compromisos' => 'acuerdos',
];

// Meses cuyo avance ya subió el área: quedan bloqueados hasta que Planeación los habilite.
function mesesSubidos($conexion, $planId)
{
    $consulta = mysqli_prepare($conexion, "SELECT mes FROM avances_subidos WHERE plan_id = ? ORDER BY mes");
    mysqli_stmt_bind_param($consulta, "i", $planId);
    mysqli_stmt_execute($consulta);
    $meses = array_map('intval', array_column(mysqli_fetch_all(mysqli_stmt_get_result($consulta)), 0));
    mysqli_stmt_close($consulta);
    return $meses;
}

// Meses del PTA cuyo Realizado ya cuenta aunque el área no haya enviado nada (se toman como 0):
// los meses que ya terminaron (todo el año si el PTA es de un año pasado) y los que el área ya subió.
function mesesRealizadoCerrados($conexion, $anio, $planId)
{
    $anioHoy = (int) date('Y');
    if ($anio < $anioHoy) {
        $terminados = range(1, 12);
    } elseif ($anio === $anioHoy && (int) date('n') > 1) {
        $terminados = range(1, (int) date('n') - 1);
    } else {
        $terminados = [];
    }
    $meses = array_values(array_unique(array_merge($terminados, mesesSubidos($conexion, $planId))));
    sort($meses);
    return $meses;
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
