<?php
$usuario=$_POST['usuarios'];
$contraseña=$_POST['contraseña'];
session_start();
$_SESSION['usuarios']=$usuario;  

$conexion=mysqli_connect("localhost","root","","servicio_social");

$$consulta="SELECT * FROM usuarios WHERE usuario='$usuario' and contraseña='$contraseña'";
$resultado=mysqli_query($conexion,$consulta);

$filas=mysqli_num_rows($resultado);

if($filas){
   
  header("location:../Programacion/programacion.html");
}else{
   
  ?>
  <?php
  include("index.html");
  ?>
  <h1 class="bad">ERROR DE AUTENTIFICACION</h1>
  <?php
}
mysqli_free_result($resultado);
mysqli_close($conexion);