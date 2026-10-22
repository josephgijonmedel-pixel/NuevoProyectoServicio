-- =====================================================================
-- Datos iniciales de los catálogos que usa la pantalla "Mi unidad".
-- Se puede ejecutar más de una vez: INSERT IGNORE no duplica registros.
-- =====================================================================

USE `planeacionzonasur`;
SET NAMES utf8mb4; -- para que los acentos (ACADÉMICA) se guarden bien desde cualquier cliente

INSERT IGNORE INTO `tipo_unidad` (`nombre`) VALUES
  ('ACADÉMICA'),
  ('ADMINISTRATIVA');

INSERT IGNORE INTO `cargos` (`nombre`) VALUES
  ('COORDINADORA'),
  ('COORDINADOR'),
  ('SUBCOORDINADOR'),
  ('JEFE'),
  ('JEFA'),
  ('SUBJEFE'),
  ('SUBAUDITOR'),
  ('RESPONSABLE'),
  ('ENCARGADO'),
  ('SECRETARIO');

-- ---------------------------------------------------------------------
-- Catálogos de Programación (generados a partir de Programacion/app.js)
-- ---------------------------------------------------------------------

INSERT IGNORE INTO `proyectos_institucionales` (`clave`, `nombre`) VALUES
  ('1', 'Responsabilidad Social y Ambiental'),
  ('2', 'Impulsar la digitalización de la gestión administrativa de la CGZS'),
  ('3', 'Redimensionar la gestión Institucional'),
  ('4', 'Coadyuvar en la formación integral del estudiante, a través de la extensión y vinculación universitarias');

-- Objetivos específicos (textos tomados del PTA 2026, hoja "Objetivos Especificos").
INSERT IGNORE INTO `objetivos_especificos` (`proyecto_id`, `clave`, `descripcion`)
  SELECT id, '1.1', 'Sensibilizar y formar a la comunidad UAGro sobre la importancia de la responsabilidad social y ambiental.' FROM `proyectos_institucionales` WHERE clave = '1';
INSERT IGNORE INTO `objetivos_especificos` (`proyecto_id`, `clave`, `descripcion`)
  SELECT id, '1.2', 'Desarrollar proyectos y programas de responsabilidad social y ambiental que respondan a las necesidades y demandas de la sociedad. Para ello, se apoyará esta actividad con profesores investigadores y prestadores de servicio social de las Unidades Académicas de Ciencias Ambientales, Ecología Marina, el Centro de Ciencias el Desarrollo Regional y el Centro de Gestión del Desarrollo, entre otras.' FROM `proyectos_institucionales` WHERE clave = '1';
INSERT IGNORE INTO `objetivos_especificos` (`proyecto_id`, `clave`, `descripcion`)
  SELECT id, '1.3', 'Promover la participación activa de la comunidad UAGro en proyectos y programas de responsabilidad social y ambiental.' FROM `proyectos_institucionales` WHERE clave = '1';
INSERT IGNORE INTO `objetivos_especificos` (`proyecto_id`, `clave`, `descripcion`)
  SELECT id, '1.4', 'Fomentar la implementación de prácticas sustentables en la gestión universitaria, en aspectos como la gestión de residuos, el uso eficiente de recursos, la movilidad sustentable, entre otros.' FROM `proyectos_institucionales` WHERE clave = '1';
INSERT IGNORE INTO `objetivos_especificos` (`proyecto_id`, `clave`, `descripcion`)
  SELECT id, '1.5', 'Contribuir al desarrollo sustentable de la sociedad a través de la formación de profesionales comprometidos con la responsabilidad social y ambiental' FROM `proyectos_institucionales` WHERE clave = '1';
INSERT IGNORE INTO `objetivos_especificos` (`proyecto_id`, `clave`, `descripcion`)
  SELECT id, '1.6', 'Evaluar periódicamente los avances y resultados de los proyectos y programas de responsabilidad social y ambiental, con el fin de mejorar continuamente su impacto y efectividad.' FROM `proyectos_institucionales` WHERE clave = '1';
INSERT IGNORE INTO `objetivos_especificos` (`proyecto_id`, `clave`, `descripcion`)
  SELECT id, '1.7', 'Establecer alianzas estratégicas con organizaciones y entidades del sector público y privado para fortalecer la capacidad de la UAGro en materia de responsabilidad social y ambiental.' FROM `proyectos_institucionales` WHERE clave = '1';
INSERT IGNORE INTO `objetivos_especificos` (`proyecto_id`, `clave`, `descripcion`)
  SELECT id, '2.1', 'Digitalizar los procesos administrativos de la CGZS para mejorar su eficiencia y reducir tiempos y costos, lo que permitirá un mejor aprovechamiento de los recursos humanos y financieros de la universidad.' FROM `proyectos_institucionales` WHERE clave = '2';
INSERT IGNORE INTO `objetivos_especificos` (`proyecto_id`, `clave`, `descripcion`)
  SELECT id, '2.2', 'Gestionar una infraestructura tecnológica adecuada y actualizada que soporte la digitalización integral de la GCZS, incluyendo la instalación de redes de alta velocidad, la implementación de sistemas de seguridad informática y la adquisición de equipos y software especializado.' FROM `proyectos_institucionales` WHERE clave = '2';
INSERT IGNORE INTO `objetivos_especificos` (`proyecto_id`, `clave`, `descripcion`)
  SELECT id, '2.3', 'Fomentar la cultura digital en la comunidad universitaria, promoviendo el uso responsable y ético de las tecnologías de la información y la comunicación, así como la alfabetización digital del personal administrativo y la comunidad en general.' FROM `proyectos_institucionales` WHERE clave = '2';
INSERT IGNORE INTO `objetivos_especificos` (`proyecto_id`, `clave`, `descripcion`)
  SELECT id, '2.4', 'Evaluar de forma periódica el impacto de la digitalización integral en la calidad de los servicios que ofrece la CGZS, para retroalimentar y mejorar la implementación del programa y asegurar que se cumplan los objetivos planteados' FROM `proyectos_institucionales` WHERE clave = '2';
INSERT IGNORE INTO `objetivos_especificos` (`proyecto_id`, `clave`, `descripcion`)
  SELECT id, '3.1', 'Desarrollar y mejorar los procesos administrativos y de gestión en la UAGro para garantizar su eficiencia y eficacia en el uso de los recursos.' FROM `proyectos_institucionales` WHERE clave = '3';
INSERT IGNORE INTO `objetivos_especificos` (`proyecto_id`, `clave`, `descripcion`)
  SELECT id, '3.2', 'Establecer políticas y procedimientos claros y transparentes para la toma de decisiones en la gestión de los medios necesarios para el funcionamiento óptimo de la CGZS.' FROM `proyectos_institucionales` WHERE clave = '3';
INSERT IGNORE INTO `objetivos_especificos` (`proyecto_id`, `clave`, `descripcion`)
  SELECT id, '3.3', 'Implementar sistemas y herramientas de control y seguimiento para asegurar la transparencia en el uso de los recursos en la UAGro.' FROM `proyectos_institucionales` WHERE clave = '3';
INSERT IGNORE INTO `objetivos_especificos` (`proyecto_id`, `clave`, `descripcion`)
  SELECT id, '3.4', 'Continuar con la ética y la integridad en la gestión de los recursos de la Universidad, fomentando una cultura de responsabilidad y de rendición de cuentas.' FROM `proyectos_institucionales` WHERE clave = '3';
INSERT IGNORE INTO `objetivos_especificos` (`proyecto_id`, `clave`, `descripcion`)
  SELECT id, '3.5', 'Desarrollar programas de capacitación y formación en administración y gestión eficiente, eficaz y efectiva para el personal de la UAGro.' FROM `proyectos_institucionales` WHERE clave = '3';
INSERT IGNORE INTO `objetivos_especificos` (`proyecto_id`, `clave`, `descripcion`)
  SELECT id, '3.6', 'Cultura de la Planeación, evaluación y seguimiento institucional. Continuar en el Impulso de una cultura de planeación, evaluación y seguimiento en toda la CGZS que contribuya eficazmente al desarrollo institucional y a la mejora continua de los procesos y servicios que ofrece a los usuarios.' FROM `proyectos_institucionales` WHERE clave = '3';
INSERT IGNORE INTO `objetivos_especificos` (`proyecto_id`, `clave`, `descripcion`)
  SELECT id, '4.1', 'Elaborar y difundir un Catálogo de Servicios (Culturales, de arte, deportivos y atención psicopedagógica) que brinda a las Unidades Académicas las áreas de extensión con el objeto de coadyuvar en la formación integral de los estudiantes.' FROM `proyectos_institucionales` WHERE clave = '4';
INSERT IGNORE INTO `objetivos_especificos` (`proyecto_id`, `clave`, `descripcion`)
  SELECT id, '4.2', 'Promover y coordinar con los estudiantes y PTCs de las Unidades Académicas el estudio, la valoración y la difusión de las expresiones de las diversas culturas populares rurales y urbanas delas regiones Costa Chica, Costa Grande y Acapulco, reconociendo su importancia como elemento que consolida las identidades regional y nacional.' FROM `proyectos_institucionales` WHERE clave = '4';
INSERT IGNORE INTO `objetivos_especificos` (`proyecto_id`, `clave`, `descripcion`)
  SELECT id, '4.3', 'Difusión a la sociedad a través de eventos locales y regionales de las expresiones culturales, artísticas, deportivas, científicas y tecnológicas con la participación de estudiantes de EMS, ES y posgrado.' FROM `proyectos_institucionales` WHERE clave = '4';
INSERT IGNORE INTO `objetivos_especificos` (`proyecto_id`, `clave`, `descripcion`)
  SELECT id, '4.4', 'Elaborar un diagnóstico de la vinculación de la UAGro con los sectores Productivo, Social, Público, etc. (Convenios y alcance de los mismos) y del Seguimiento de Egresados, así como elaborar un catálogo de los servicios que se ofrecen a los distintos sectores' FROM `proyectos_institucionales` WHERE clave = '4';

INSERT IGNORE INTO `lineas_accion` (`objetivo_id`, `clave`, `descripcion`)
  SELECT o.id, '1.1.1', 'Sensibilización y Formación en Responsabilidad Social. Implementar programas de sensibilización y formación dirigidos a la comunidad UAGro sobre la importancia de la responsabilidad social y ambiental. Se realizarán actividades de capacitación, charlas y campañas de concientización.' FROM `objetivos_especificos` o
  JOIN `proyectos_institucionales` p ON p.id = o.proyecto_id WHERE p.clave = '1' AND o.clave = '1.1';
INSERT IGNORE INTO `lineas_accion` (`objetivo_id`, `clave`, `descripcion`)
  SELECT o.id, '1.2.1', 'Desarrollo de Proyectos y Programas Socioambientales. Fomentar la creación y desarrollo de proyectos y programas de responsabilidad social y ambiental que aborden problemáticas relevantes para la sociedad. Se impulsará la participación de estudiantes, docentes y personal administrativo en la concepción e implementación de estas iniciativas.' FROM `objetivos_especificos` o
  JOIN `proyectos_institucionales` p ON p.id = o.proyecto_id WHERE p.clave = '1' AND o.clave = '1.2';
INSERT IGNORE INTO `lineas_accion` (`objetivo_id`, `clave`, `descripcion`)
  SELECT o.id, '1.3.1', 'Promoción de la Participación Activa. Estimular la participación activa de la comunidad UAGro en proyectos y programas de responsabilidad social y ambiental. Se crearán espacios y plataformas para que los miembros de la comunidad puedan involucrarse y contribuir con sus ideas y esfuerzos.' FROM `objetivos_especificos` o
  JOIN `proyectos_institucionales` p ON p.id = o.proyecto_id WHERE p.clave = '1' AND o.clave = '1.3';
INSERT IGNORE INTO `lineas_accion` (`objetivo_id`, `clave`, `descripcion`)
  SELECT o.id, '1.4.1', 'Implementación de Prácticas Sustentables en la Gestión Universitaria. Promover la implementación de prácticas sustentables en la gestión universitaria en aspectos como la gestión de residuos, el uso eficiente de recursos y la movilidad sustentable, entre otros. Se establecerán políticas y acciones concretas para reducir el impacto ambiental de la universidad.' FROM `objetivos_especificos` o
  JOIN `proyectos_institucionales` p ON p.id = o.proyecto_id WHERE p.clave = '1' AND o.clave = '1.4';
INSERT IGNORE INTO `lineas_accion` (`objetivo_id`, `clave`, `descripcion`)
  SELECT o.id, '1.5.1', 'Formación de Profesionales Comprometidos. Introducir la responsabilidad social y ambiental como un eje transversal en la formación de profesionales en la UAGro. Se incorporarán contenidos curriculares relacionados con estas temáticas y se promoverá la participación en actividades extracurriculares relacionadas con la responsabilidad social.' FROM `objetivos_especificos` o
  JOIN `proyectos_institucionales` p ON p.id = o.proyecto_id WHERE p.clave = '1' AND o.clave = '1.5';
INSERT IGNORE INTO `lineas_accion` (`objetivo_id`, `clave`, `descripcion`)
  SELECT o.id, '1.6.1', 'Evaluación y Mejora Continua. Establecer mecanismos de evaluación periódica para medir el avance y los resultados de los proyectos y programas de responsabilidad social y ambiental. Se utilizarán indicadores de desempeño para retroalimentar y mejorar continuamente las acciones implementadas.' FROM `objetivos_especificos` o
  JOIN `proyectos_institucionales` p ON p.id = o.proyecto_id WHERE p.clave = '1' AND o.clave = '1.6';
INSERT IGNORE INTO `lineas_accion` (`objetivo_id`, `clave`, `descripcion`)
  SELECT o.id, '1.7.1', 'Alianzas Estratégicas. Establecer alianzas con organizaciones y entidades del sector público y privado que compartan los mismos valores y objetivos en materia de responsabilidad social y ambiental. Se buscarán sinergias para fortalecer la capacidad de la UAGro en este ámbito y ampliar el impacto de las acciones.' FROM `objetivos_especificos` o
  JOIN `proyectos_institucionales` p ON p.id = o.proyecto_id WHERE p.clave = '1' AND o.clave = '1.7';
INSERT IGNORE INTO `lineas_accion` (`objetivo_id`, `clave`, `descripcion`)
  SELECT o.id, '2.1.1', 'Fortalecimiento de la Infraestructura Tecnológica. Mejorar y actualizar la infraestructura tecnológica de la universidad, incluyendo redes de alta velocidad, sistemas de almacenamiento y seguridad informática, para garantizar una base sólida para la digitalización integral.' FROM `objetivos_especificos` o
  JOIN `proyectos_institucionales` p ON p.id = o.proyecto_id WHERE p.clave = '2' AND o.clave = '2.1';
INSERT IGNORE INTO `lineas_accion` (`objetivo_id`, `clave`, `descripcion`)
  SELECT o.id, '2.2.1', 'Capacitación en Competencias Digitales. Brindar capacitación y formación en competencias digitales al personal administrativo, para que estén preparados para utilizar eficazmente las herramientas digitales en sus labores educativas y administrativas.' FROM `objetivos_especificos` o
  JOIN `proyectos_institucionales` p ON p.id = o.proyecto_id WHERE p.clave = '2' AND o.clave = '2.2';
INSERT IGNORE INTO `lineas_accion` (`objetivo_id`, `clave`, `descripcion`)
  SELECT o.id, '2.3.1', 'Digitalización de Procesos Administrativos. Optimizar los procesos administrativos mediante la digitalización de trámites, gestión de recursos humanos y finanzas, entre otros, para mejorar la eficiencia y reducir tiempos y costos.' FROM `objetivos_especificos` o
  JOIN `proyectos_institucionales` p ON p.id = o.proyecto_id WHERE p.clave = '2' AND o.clave = '2.3';
INSERT IGNORE INTO `lineas_accion` (`objetivo_id`, `clave`, `descripcion`)
  SELECT o.id, '2.4.1', 'Evaluación y Seguimiento de la Transformación Digital. Establecer un sistema de evaluación y seguimiento periódico para medir el avance y el impacto de la transformación digital, los procesos administrativos y la satisfacción de los usuarios.' FROM `objetivos_especificos` o
  JOIN `proyectos_institucionales` p ON p.id = o.proyecto_id WHERE p.clave = '2' AND o.clave = '2.4';
INSERT IGNORE INTO `lineas_accion` (`objetivo_id`, `clave`, `descripcion`)
  SELECT o.id, '3.1.1', 'Optimización de Procesos Administrativos. Realizar una revisión exhaustiva de los procesos administrativos y de gestión en la CGZS para identificar áreas de mejora y oportunidades de optimización. Implementar cambios y actualizaciones para asegurar la eficiencia, eficacia y efectividad en el uso de los recursos.' FROM `objetivos_especificos` o
  JOIN `proyectos_institucionales` p ON p.id = o.proyecto_id WHERE p.clave = '3' AND o.clave = '3.1';
INSERT IGNORE INTO `lineas_accion` (`objetivo_id`, `clave`, `descripcion`)
  SELECT o.id, '3.2.1', 'Establecimiento de Políticas Transparentes. Desarrollar y difundir políticas y procedimientos claros y transparentes para la toma de decisiones en la gestión de los medios necesarios para el funcionamiento óptimo de la Universidad. Esto incluirá la definición de criterios de asignación de recursos y el establecimiento de mecanismos de rendición de cuentas.' FROM `objetivos_especificos` o
  JOIN `proyectos_institucionales` p ON p.id = o.proyecto_id WHERE p.clave = '3' AND o.clave = '3.2';
INSERT IGNORE INTO `lineas_accion` (`objetivo_id`, `clave`, `descripcion`)
  SELECT o.id, '3.3.1', 'Implementación de Sistemas de Control y Seguimiento. Establecer sistemas y herramientas de control y seguimiento para asegurar la transparencia en el uso de los recursos en la CGZS. Esto incluirá la implementación de tecnologías de información que permitan el monitoreo de los gastos y la gestión financiera.' FROM `objetivos_especificos` o
  JOIN `proyectos_institucionales` p ON p.id = o.proyecto_id WHERE p.clave = '3' AND o.clave = '3.3';
INSERT IGNORE INTO `lineas_accion` (`objetivo_id`, `clave`, `descripcion`)
  SELECT o.id, '3.4.1', 'Promoción de la Ética y la Integridad. Fomentar una cultura de ética y responsabilidad en la gestión de los recursos de la universidad. Implementar programas de formación y capacitación en ética administrativa y promover cultura de la rendición de cuentas en todos los niveles de la institución.' FROM `objetivos_especificos` o
  JOIN `proyectos_institucionales` p ON p.id = o.proyecto_id WHERE p.clave = '3' AND o.clave = '3.4';
INSERT IGNORE INTO `lineas_accion` (`objetivo_id`, `clave`, `descripcion`)
  SELECT o.id, '3.5.1', 'Capacitación en Administración Eficiente. Desarrollar programas de capacitación y formación en administración y gestión eficiente, eficaz y efectiva para el personal de la CGZS. Esto incluirá cursos y talleres sobre buenas prácticas en la administración de recursos, manejo de presupuestos, planificación estratégica, entre otros.' FROM `objetivos_especificos` o
  JOIN `proyectos_institucionales` p ON p.id = o.proyecto_id WHERE p.clave = '3' AND o.clave = '3.5';
INSERT IGNORE INTO `lineas_accion` (`objetivo_id`, `clave`, `descripcion`)
  SELECT o.id, '3.6.1', 'Identidad Institucional. Fomentar la identidad institucional en todos los trabajadores de las coordinaciones y áreas de la CGZS, con la finalidad que todo el personal de la CGZS conozca y se identifique con la Visión, Misión y Principios Institucionales, así como con el Código de Ética.' FROM `objetivos_especificos` o
  JOIN `proyectos_institucionales` p ON p.id = o.proyecto_id WHERE p.clave = '3' AND o.clave = '3.6';
INSERT IGNORE INTO `lineas_accion` (`objetivo_id`, `clave`, `descripcion`)
  SELECT o.id, '3.6.2', 'Promover el trabajo colaborativo, integral, sistemático y planeativo de toda la CGZS. A través de la participación para elaborar los Planes de Trabajo y Programas Operativos Anuales, se fomentará el trabajo colaborativo entre las diferentes áreas de una coordinación y entre coordinaciones.' FROM `objetivos_especificos` o
  JOIN `proyectos_institucionales` p ON p.id = o.proyecto_id WHERE p.clave = '3' AND o.clave = '3.6';
INSERT IGNORE INTO `lineas_accion` (`objetivo_id`, `clave`, `descripcion`)
  SELECT o.id, '4.1.1', 'Catálogo de Servicios Actualizado. Desarrollar y difundir a través del Catálogo en todas las Unidades Académicas de las regiones de Costa Chica, Costa Grande y Acapulco los servicios que ofrece la Coordinación de Extensión.' FROM `objetivos_especificos` o
  JOIN `proyectos_institucionales` p ON p.id = o.proyecto_id WHERE p.clave = '4' AND o.clave = '4.1';
INSERT IGNORE INTO `lineas_accion` (`objetivo_id`, `clave`, `descripcion`)
  SELECT o.id, '4.2.1', 'Formación de extensionistas. Implementar programas de capacitación para la formación de extensionistas en cada Unidad Académica de la Zona Sur con la finalidad de difundir y promover el arte, la cultura, la poesía, la oratoria, así como el deporte, que contribuyan a la formación integral de los estudiantes.' FROM `objetivos_especificos` o
  JOIN `proyectos_institucionales` p ON p.id = o.proyecto_id WHERE p.clave = '4' AND o.clave = '4.2';
INSERT IGNORE INTO `lineas_accion` (`objetivo_id`, `clave`, `descripcion`)
  SELECT o.id, '4.3.1', 'Expresiones diversas en eventos de importancia regional. Representar a la Universidad a través de estudiantes de EMS y Superior con participaciones artísticas, culturales, deportivas, científicas y tecnológicas, etc., en eventos de importancia regional.' FROM `objetivos_especificos` o
  JOIN `proyectos_institucionales` p ON p.id = o.proyecto_id WHERE p.clave = '4' AND o.clave = '4.3';
INSERT IGNORE INTO `lineas_accion` (`objetivo_id`, `clave`, `descripcion`)
  SELECT o.id, '4.4.1', 'Conformar consejos de vinculación en las unidades académicas (Coordinadores de PE y de CA) con la CGZS y que estos promuevan: 1.- La revisión de las LGAC que desarrollan los CA, con la finalidad de incorporar líneas de investigación tendientes a la transmisión del conocimiento al Sector Productivo y de servicio, 2.- Revisión de Planes y programas de los PE que incorporen competencias y unidades de aprendizaje relacionadas con el sector productivo y de servicios, 3.- Revisión de la pertinencia del PE.' FROM `objetivos_especificos` o
  JOIN `proyectos_institucionales` p ON p.id = o.proyecto_id WHERE p.clave = '4' AND o.clave = '4.4';

INSERT IGNORE INTO `unidades_medida` (`nombre`) VALUES
  ('Actualizaciones'),
  ('Bazares'),
  ('Catálogos'),
  ('Charlas'),
  ('Coloquios'),
  ('Concursos'),
  ('Convenios'),
  ('Digitalizaciones'),
  ('Docentes'),
  ('Encuestas'),
  ('Equipos de cómputo'),
  ('Estudiantes'),
  ('Evaluaciones'),
  ('Eventos Académicos'),
  ('Eventos Artísticos'),
  ('Expedientes'),
  ('Exposiciones'),
  ('Gestiones'),
  ('Oficios'),
  ('Procesos y Procedimientos'),
  ('Registros'),
  ('Reportes'),
  ('Reuniones'),
  ('Seguimiento'),
  ('Simulacros'),
  ('Talleres'),
  ('Utensilios'),
  ('Visitas'),
  ('Otros');
