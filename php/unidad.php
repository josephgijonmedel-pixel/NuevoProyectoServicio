<?php
// Datos de la Unidad Responsable del usuario que inició sesión.
//   GET  → devuelve los datos de la unidad y los catálogos (tipos de unidad y cargos)
//   POST → recibe JSON con los datos editados y los guarda
// Cada cuenta solo puede ver y editar SU propia unidad (la de la sesión).

require "sesion.php";
$unidadId = requerirUnidad();
require "conexion.php";

try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        responderJson([
            "unidad" => obtenerUnidad($conexion, $unidadId),
            "tipos" => obtenerCatalogo($conexion, "tipo_unidad"),
            "cargos" => obtenerCatalogo($conexion, "cargos"),
        ]);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $datos = json_decode(file_get_contents("php://input"), true) ?? [];
        $limpios = validarDatos($conexion, $datos);
        guardarUnidad($conexion, $unidadId, $limpios);
        registrarBitacora($conexion, "unidades_responsables", $unidadId, "EDITAR");

        responderJson(["mensaje" => "Datos guardados correctamente.", "unidad" => obtenerUnidad($conexion, $unidadId)]);
    }

    responderJson(["error" => "Método no permitido."], 405);
} catch (mysqli_sql_exception $e) {
    error_log("unidad.php: " . $e->getMessage());
    responderJson(["error" => "Ocurrió un error al consultar la base de datos."], 500);
}

// ---------------------------------------------------------------------

function obtenerUnidad($conexion, $unidadId)
{
    $consulta = mysqli_prepare(
        $conexion,
        "SELECT id, nombre, tipo_unidad_id, responsable_nombre, cargo_id, telefono,
                correo_institucional, correo_personal
         FROM unidades_responsables WHERE id = ?"
    );
    mysqli_stmt_bind_param($consulta, "i", $unidadId);
    mysqli_stmt_execute($consulta);
    $unidad = mysqli_fetch_assoc(mysqli_stmt_get_result($consulta));
    mysqli_stmt_close($consulta);

    if (!$unidad) {
        responderJson(["error" => "No se encontró la Unidad Responsable."], 404);
    }
    return $unidad;
}

// Devuelve [{id, nombre}, ...] de una tabla de catálogo (nombre de tabla fijo, no viene del usuario)
function obtenerCatalogo($conexion, $tabla)
{
    $resultado = mysqli_query($conexion, "SELECT id, nombre FROM `$tabla` ORDER BY nombre");
    return mysqli_fetch_all($resultado, MYSQLI_ASSOC);
}

function existeEnCatalogo($conexion, $tabla, $id)
{
    $consulta = mysqli_prepare($conexion, "SELECT 1 FROM `$tabla` WHERE id = ?");
    mysqli_stmt_bind_param($consulta, "i", $id);
    mysqli_stmt_execute($consulta);
    $existe = mysqli_stmt_get_result($consulta)->num_rows > 0;
    mysqli_stmt_close($consulta);
    return $existe;
}

// Revisa los datos recibidos; si algo está mal responde 422 con la lista de errores.
function validarDatos($conexion, $datos)
{
    $texto = fn($campo) => trim((string) ($datos[$campo] ?? ''));

    $limpios = [
        "nombre" => $texto("nombre"),
        "tipo_unidad_id" => (int) ($datos["tipo_unidad_id"] ?? 0),
        "responsable_nombre" => $texto("responsable_nombre"),
        "cargo_id" => (int) ($datos["cargo_id"] ?? 0),
        "telefono" => preg_replace('/\D/', '', $texto("telefono")),
        "correo_institucional" => $texto("correo_institucional"),
        "correo_personal" => $texto("correo_personal"),
    ];

    $errores = [];

    if ($limpios["nombre"] === '' || mb_strlen($limpios["nombre"]) > 150) {
        $errores["nombre"] = "Escribe el nombre de la unidad (máximo 150 caracteres).";
    }
    if (!existeEnCatalogo($conexion, "tipo_unidad", $limpios["tipo_unidad_id"])) {
        $errores["tipo_unidad_id"] = "Selecciona un tipo de unidad válido.";
    }
    if ($limpios["responsable_nombre"] === '' || mb_strlen($limpios["responsable_nombre"]) > 150) {
        $errores["responsable_nombre"] = "Escribe el nombre del responsable (máximo 150 caracteres).";
    }
    if (!existeEnCatalogo($conexion, "cargos", $limpios["cargo_id"])) {
        $errores["cargo_id"] = "Selecciona un cargo válido.";
    }
    if (strlen($limpios["telefono"]) !== 10) {
        $errores["telefono"] = "El celular debe tener 10 dígitos.";
    }
    foreach (["correo_institucional" => "institucional", "correo_personal" => "personal"] as $campo => $etiqueta) {
        if (!filter_var($limpios[$campo], FILTER_VALIDATE_EMAIL) || mb_strlen($limpios[$campo]) > 150) {
            $errores[$campo] = "Escribe un correo $etiqueta válido.";
        }
    }

    if ($errores) {
        responderJson(["error" => "Revisa los campos marcados.", "campos" => $errores], 422);
    }
    return $limpios;
}

function guardarUnidad($conexion, $unidadId, $d)
{
    $consulta = mysqli_prepare(
        $conexion,
        "UPDATE unidades_responsables
         SET nombre = ?, tipo_unidad_id = ?, responsable_nombre = ?, cargo_id = ?,
             telefono = ?, tipo_telefono = 'celular', correo_institucional = ?, correo_personal = ?
         WHERE id = ?"
    );
    mysqli_stmt_bind_param(
        $consulta,
        "sisisssi",
        $d["nombre"],
        $d["tipo_unidad_id"],
        $d["responsable_nombre"],
        $d["cargo_id"],
        $d["telefono"],
        $d["correo_institucional"],
        $d["correo_personal"],
        $unidadId
    );
    mysqli_stmt_execute($consulta);
    mysqli_stmt_close($consulta);
}
