-- MariaDB dump 10.19  Distrib 10.4.32-MariaDB, for Win64 (AMD64)
--
-- Host: localhost    Database: planeacionzonasur
-- ------------------------------------------------------
-- Server version	10.4.32-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `acciones_estrategicas`
--

DROP TABLE IF EXISTS `acciones_estrategicas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `acciones_estrategicas` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `plan_id` int(10) unsigned NOT NULL,
  `indicador_id` int(10) unsigned DEFAULT NULL,
  `descripcion` text NOT NULL,
  `con_recursos` tinyint(1) NOT NULL DEFAULT 0,
  `unidad_medida_id` int(10) unsigned NOT NULL,
  `beneficiados` text DEFAULT NULL,
  `responsables` text DEFAULT NULL,
  `participantes` text DEFAULT NULL,
  `observaciones_generales` text DEFAULT NULL,
  `orden` smallint(6) NOT NULL DEFAULT 0,
  `creacion_registro` timestamp NOT NULL DEFAULT current_timestamp(),
  `fecha_modificacion` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `lineas_accion_id` int(10) unsigned NOT NULL,
  PRIMARY KEY (`id`),
  KEY `planes_trabajo_plan_id_acciones_estrategicas` (`plan_id`),
  KEY `indicadsores_desempeno_indicador_id_acciones_estrategicas` (`indicador_id`),
  KEY `lineas_accion_lineas_accion_id_acciones_estrategicas` (`lineas_accion_id`),
  KEY `unidades_medida_unidad_medida_id_acciones:estragtegicas` (`unidad_medida_id`),
  CONSTRAINT `indicadsores_desempeno_indicador_id_acciones_estrategicas` FOREIGN KEY (`indicador_id`) REFERENCES `indicadores_desempeno` (`id`),
  CONSTRAINT `lineas_accion_lineas_accion_id_acciones_estrategicas` FOREIGN KEY (`lineas_accion_id`) REFERENCES `lineas_accion` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `planes_trabajo_plan_id_acciones_estrategicas` FOREIGN KEY (`plan_id`) REFERENCES `planes_trabajo` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `unidades_medida_unidad_medida_id_acciones:estragtegicas` FOREIGN KEY (`unidad_medida_id`) REFERENCES `unidades_medida` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `acciones_recursos`
--

DROP TABLE IF EXISTS `acciones_recursos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `acciones_recursos` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `accion_id` int(10) unsigned NOT NULL,
  `concepto_id` int(10) unsigned NOT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  `monto` decimal(12,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`),
  KEY `concepto_gasto_concepto_id_acciones_recursos` (`concepto_id`),
  KEY `fk_recursos_accion` (`accion_id`),
  CONSTRAINT `concepto_gasto_concepto_id_acciones_recursos` FOREIGN KEY (`concepto_id`) REFERENCES `concepto_gasto` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_recursos_accion` FOREIGN KEY (`accion_id`) REFERENCES `acciones_estrategicas` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `bitacora`
--

DROP TABLE IF EXISTS `bitacora`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `bitacora` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `usuario_id` int(10) unsigned DEFAULT NULL,
  `tabla` varchar(64) NOT NULL,
  `registro_id` int(10) unsigned DEFAULT NULL,
  `accion` enum('CREAR','EDITAR','ELIMINAR','ENVIAR','APROBAR','OBSERVAR','LOGIN') NOT NULL,
  `detalle` text DEFAULT NULL,
  `fecha` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `usuarios_usuario_id_bitacora` (`usuario_id`),
  CONSTRAINT `usuarios_usuario_id_bitacora` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=114 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `cargos`
--

DROP TABLE IF EXISTS `cargos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cargos` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(50) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=32 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `concepto_gasto`
--

DROP TABLE IF EXISTS `concepto_gasto`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `concepto_gasto` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `gasto_id` int(10) unsigned NOT NULL,
  `nombre` varchar(200) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `gastos_gasto_id_concepto_gasto` (`gasto_id`),
  CONSTRAINT `gastos_gasto_id_concepto_gasto` FOREIGN KEY (`gasto_id`) REFERENCES `gastos` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `gastos`
--

DROP TABLE IF EXISTS `gastos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `gastos` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(120) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `indicadores_desempeno`
--

DROP TABLE IF EXISTS `indicadores_desempeno`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `indicadores_desempeno` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `proyecto_id` int(10) unsigned NOT NULL,
  `descripcion` text NOT NULL,
  PRIMARY KEY (`id`),
  KEY `proyectos_institucionales_proyecto_id_indicadores_desempeño` (`proyecto_id`),
  CONSTRAINT `proyectos_institucionales_proyecto_id_indicadores_desempeño` FOREIGN KEY (`proyecto_id`) REFERENCES `proyectos_institucionales` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `lineas_accion`
--

DROP TABLE IF EXISTS `lineas_accion`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `lineas_accion` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `objetivo_id` int(10) unsigned NOT NULL,
  `clave` varchar(150) NOT NULL,
  `descripcion` text NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_linea_objetivo_clave` (`objetivo_id`,`clave`),
  CONSTRAINT `objetivos_especificos_objetivo_id_lineas_accion` FOREIGN KEY (`objetivo_id`) REFERENCES `objetivos_especificos` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `metas_mensuales`
--

DROP TABLE IF EXISTS `metas_mensuales`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `metas_mensuales` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `accion_id` int(10) unsigned NOT NULL,
  `mes` tinyint(4) NOT NULL,
  `programado` int(10) unsigned NOT NULL DEFAULT 0,
  `realizado` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_metas_accion_mes` (`accion_id`,`mes`),
  CONSTRAINT `fk_metas_accion` FOREIGN KEY (`accion_id`) REFERENCES `acciones_estrategicas` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_metas_mes` CHECK (`mes` between 1 and 12)
) ENGINE=InnoDB AUTO_INCREMENT=445 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `objetivos_especificos`
--

DROP TABLE IF EXISTS `objetivos_especificos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `objetivos_especificos` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `proyecto_id` int(10) unsigned NOT NULL,
  `clave` varchar(10) NOT NULL,
  `descripcion` text NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_objetivo_proyecto_clave` (`proyecto_id`,`clave`),
  CONSTRAINT `proyectos_institucionales_objetivos_especificos` FOREIGN KEY (`proyecto_id`) REFERENCES `proyectos_institucionales` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `periodos`
--

DROP TABLE IF EXISTS `periodos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `periodos` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `anio` smallint(5) unsigned NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 0,
  `abierto_por` int(10) unsigned DEFAULT NULL,
  `fecha_apertura` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `periodos_anio` (`anio`),
  KEY `usuarios_abierto_por_periodos` (`abierto_por`),
  CONSTRAINT `usuarios_abierto_por_periodos` FOREIGN KEY (`abierto_por`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `planes_trabajo`
--

DROP TABLE IF EXISTS `planes_trabajo`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `planes_trabajo` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `unidad_responsable_id` int(10) unsigned NOT NULL,
  `anio` smallint(5) unsigned NOT NULL,
  `responsable_nombre` varchar(150) DEFAULT NULL,
  `responsable_cargo` varchar(80) DEFAULT NULL,
  `estado` enum('BORRADOR','ENVIADO','CON OBSERVACIONES','APROBADO') NOT NULL DEFAULT 'BORRADOR',
  `observaciones_planeacion` text DEFAULT NULL,
  `fecha_envio` datetime DEFAULT NULL,
  `revisado_por` int(10) unsigned DEFAULT NULL,
  `fecha_revision` datetime DEFAULT NULL,
  `estado_final` enum('BORRADOR','ENVIADO','CON OBSERVACIONES','APROBADO') NOT NULL DEFAULT 'BORRADOR',
  `fecha_envio_final` datetime DEFAULT NULL,
  `creacion_fecha` timestamp NOT NULL DEFAULT current_timestamp(),
  `modificacion_fecha` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_plan_unidad_anio` (`unidad_responsable_id`,`anio`),
  KEY `usuarios_revisado_por_planes_trabajo` (`revisado_por`),
  CONSTRAINT `unidades_responsables_unidad_responsable_planes_trabajo` FOREIGN KEY (`unidad_responsable_id`) REFERENCES `unidades_responsables` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `usuarios_revisado_por_planes_trabajo` FOREIGN KEY (`revisado_por`) REFERENCES `usuarios` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `proyectos_institucionales`
--

DROP TABLE IF EXISTS `proyectos_institucionales`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `proyectos_institucionales` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `clave` varchar(10) DEFAULT NULL,
  `nombre` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `clave` (`clave`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `seguimientos`
--

DROP TABLE IF EXISTS `seguimientos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `seguimientos` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `plan_id` int(10) unsigned NOT NULL,
  `periodo` tinyint(3) unsigned NOT NULL,
  `estado` enum('BORRADOR','ENVIADO','CON OBSERVACIONES','APROBADO') NOT NULL DEFAULT 'BORRADOR',
  `fecha_envio` datetime DEFAULT NULL,
  `revisado_por` int(10) unsigned DEFAULT NULL,
  `fecha_revision` datetime DEFAULT NULL,
  `fecha_creacion` timestamp NOT NULL DEFAULT current_timestamp(),
  `fecha_modificacion` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_seguimiento_plan_periodo` (`plan_id`,`periodo`),
  KEY `usuarios_plan_id_seguimiento` (`revisado_por`),
  CONSTRAINT `planes_trabajo_plan_id_seguimiento` FOREIGN KEY (`plan_id`) REFERENCES `planes_trabajo` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `usuarios_plan_id_seguimiento` FOREIGN KEY (`revisado_por`) REFERENCES `usuarios` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `chk_seguimiento_periodo` CHECK (`periodo` in (1,2))
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `seguimientos_acciones`
--

DROP TABLE IF EXISTS `seguimientos_acciones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `seguimientos_acciones` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `seguimiento_id` int(10) unsigned NOT NULL,
  `accion_id` int(10) unsigned NOT NULL,
  `evidencias` text DEFAULT NULL,
  `causas_incumplimiento` text DEFAULT NULL,
  `acuerdos_compromisos` text DEFAULT NULL,
  `observaciones_planeacion` text DEFAULT NULL,
  `fecha_modificacion` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_seg_accion` (`seguimiento_id`,`accion_id`),
  KEY `fk_seg_acciones_accion` (`accion_id`),
  CONSTRAINT `fk_seg_acciones_accion` FOREIGN KEY (`accion_id`) REFERENCES `acciones_estrategicas` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_seg_acciones_seguimiento` FOREIGN KEY (`seguimiento_id`) REFERENCES `seguimientos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tipo_unidad`
--

DROP TABLE IF EXISTS `tipo_unidad`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tipo_unidad` (
  `id` tinyint(3) unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(50) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `unidades_medida`
--

DROP TABLE IF EXISTS `unidades_medida`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `unidades_medida` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(80) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=30 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `unidades_responsables`
--

DROP TABLE IF EXISTS `unidades_responsables`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `unidades_responsables` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(150) NOT NULL,
  `responsable_nombre` varchar(150) DEFAULT NULL,
  `cargo_id` int(10) unsigned DEFAULT NULL,
  `telefono` varchar(20) DEFAULT NULL,
  `tipo_telefono` enum('fijo','celular') DEFAULT NULL,
  `correo_institucional` varchar(150) DEFAULT NULL,
  `correo_personal` varchar(150) DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `actualizacion` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `tipo_unidad_id` tinyint(3) unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `cargo_id` (`cargo_id`),
  KEY `tipo_unidad_tipo_unidad_id_unidades_responsables` (`tipo_unidad_id`),
  CONSTRAINT `cargos_cargos_id_unidades_responsables` FOREIGN KEY (`cargo_id`) REFERENCES `cargos` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `tipo_unidad_tipo_unidad_id_unidades_responsables` FOREIGN KEY (`tipo_unidad_id`) REFERENCES `tipo_unidad` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `usuarios`
--

DROP TABLE IF EXISTS `usuarios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `usuarios` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `nombre_completo` varchar(150) NOT NULL,
  `correo_institucional` varchar(150) NOT NULL,
  `unidade_responsable_id` int(10) unsigned DEFAULT NULL,
  `rol` enum('COORDINADORA','COORDINADOR','SUBCOORDINADOR','JEFE','JEFA','SUBJEFE','SUBAUDITOR','RESPONSABLE','ENCARGADO','SECRETARIO') NOT NULL,
  `tipo_usuario` enum('UR','PLANEACION','ADMIN') NOT NULL DEFAULT 'UR',
  `password` varchar(255) NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `ultimo_acceso` datetime DEFAULT NULL,
  `fecha_creacion` timestamp NOT NULL DEFAULT current_timestamp(),
  `fecha_modificacion` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `correo_institucional` (`correo_institucional`),
  UNIQUE KEY `uq_usuario_unidad` (`unidade_responsable_id`),
  CONSTRAINT `unidades_responsables_unidade_responsables_id_usuarios` FOREIGN KEY (`unidade_responsable_id`) REFERENCES `unidades_responsables` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `chk_usuario_ur_con_unidad` CHECK (`tipo_usuario` <> 'UR' or `unidade_responsable_id` is not null)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed
