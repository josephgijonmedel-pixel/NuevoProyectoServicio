<?php
// Conexión central a la base de datos "planeacionzonasur".
// El resto de los scripts PHP incluyen este archivo en vez de conectarse cada uno por su cuenta.

try {
    $conexion = mysqli_connect("localhost", "root", "", "planeacionzonasur");
    mysqli_set_charset($conexion, "utf8mb4");
} catch (mysqli_sql_exception $e) {
    // No mostrar el detalle técnico al usuario; queda en el log de Apache
    error_log("Error de conexión a la BD: " . $e->getMessage());
    http_response_code(500);
    die("No se pudo conectar a la base de datos. ¿Está encendido MySQL en XAMPP?");
}
