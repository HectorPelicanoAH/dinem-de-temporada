# Activar el calendario familiar

El desarrollo funciona sin configuración en modo de prueba local. La conexión real queda pendiente deliberadamente. No se han creado servicios, enviado invitaciones ni publicado cambios.

## Probar antes de configurar

Ejecutar `python3 -m http.server 8080` en la raíz y abrir `http://localhost:8080/familia.html`. Elegir **Provar amb una còpia local**. Editar un día, crear una receta y navegar al calendario o la compra. Esta copia se guarda en localStorage, solo en ese navegador; no representa una cuenta real. Al salir de la prueba se elimina tras confirmación. Las pestañas de un mismo navegador comparten la prueba.

Las cuentas reales usan un código por correo y una sesión en sessionStorage (por pestaña). No hay contraseñas gestionadas por la web. Los cambios se guardan con los botones «Desar». Para ver cambios hechos en otro dispositivo hay que recargar; no se incorpora sincronización en tiempo real.

## Configuración pendiente, en orden

1. Crear un proyecto Supabase gratuito. Elegir una región europea. Guardar la contraseña de base de datos en un gestor de contraseñas; nunca en este repositorio.
2. Ejecutar una sola vez `supabase/migrations/001_family.sql` desde SQL Editor. Crea las tablas, los permisos y la función de guardado.
3. Configurar autenticación por email. Desactivar el registro de usuarios nuevos en la configuración del servicio (no basta con ocultarlo en la interfaz). La aplicación también envía `create_user: false`.
4. Configurar un proveedor SMTP propio y verificar el remitente. El servicio de correo de prueba de Supabase tiene restricciones y no debe darse por válido para las cuentas de la pareja. En la plantilla **Magic Link**, incluir `{{ .Token }}` para entregar el código que pide el formulario, en lugar de un enlace. Revisar los límites de envío y la caducidad del código.
5. Crear los dos usuarios desde la administración de Supabase, con sus correos autorizados. Si se usa el flujo de invitación, completar la aceptación de cada cuenta antes de probar los códigos. No es necesario habilitar registro público.
6. Crear el espacio familiar y asociar los UUID reales de los dos usuarios, desde SQL Editor. Sustituir los dos UUID del ejemplo antes de ejecutarlo; no guardar correos ni identificadores reales en Git:

```sql
begin;
with family as (
  insert into public.family_documents(name)
  values ('La nostra família') returning family_id
)
insert into public.family_members(user_id, family_id)
select member_id, family_id
from family cross join unnest(array[
  '00000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000002'::uuid
]) as users(member_id);
commit;
```

7. Completar `assets/js/family-config.js` con la URL `https://<proyecto>.supabase.co` y la clave **publishable** (o la antigua **anon**). Son configuración pública. **Nunca usar `service_role`, `sb_secret_…`, una contraseña o un token de sesión.** No se necesita una clave administrativa en la web.
8. Publicar la rama revisada en el alojamiento estático existente. Es compatible con GitHub Pages y rutas bajo una subcarpeta; no hace falta migrar a Cloudflare para activar las cuentas. Configurar Site URL de Supabase con la dirección publicada. Este flujo usa un código y no requiere callback de OAuth.
   Para activar también **Continuar amb Google**, en Supabase activa el proveedor Google y crea un cliente OAuth en Google Cloud. Usa como callback `https://wvhjzdzvvifgiqkilvxa.supabase.co/auth/v1/callback` y añade `https://hectorpelicanoah.github.io/dinem-de-temporada/familia.html` como URL de redirección. La rama ya incluye el botón y el consumo seguro del token OAuth; solo faltan las credenciales del proveedor.
9. Entrar con la primera cuenta y pulsar **Crear la nostra còpia**. Inicializa los 365 días de 2026 y las recetas presentes en `data/recipes.json` en ese momento.
10. Entrar desde otro navegador/dispositivo con la segunda cuenta y verificar que ambos ven la misma familia.

Referencias: [OTP por email](https://supabase.com/docs/guides/auth/auth-email-passwordless), [SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Comprobación final antes de darlo por activado

- Código recibido y aceptado en las dos cuentas; código incorrecto y cuenta no invitada rechazados.
- Guardar un día en una cuenta y verlo tras recargar la otra; repetir con una receta nueva.
- Intentar guardar desde una pantalla antigua: debe avisar del conflicto y permitir descargar el borrador. Recargar después y volver a aplicar el cambio deseado.
- Comprobar calendario, receta, compra y valoración con el mismo conjunto de datos privados.
- Una tercera cuenta sin membresía no obtiene datos; otra familia no puede leer o guardar la primera ni acceder a su historial.
- Probar cierre de sesión, recarga y sesión caducada. Ante error de red nunca se sustituye silenciosamente el calendario privado por el público.
- Descargar una copia y comprobar su importación. Confirmar los recuentos antes de reemplazar datos.

## Datos, copias y límites

- El calendario y recetas que ya están en `data/` **siguen siendo públicos**, como antes. La copia personalizada y los cambios nuevos viven en Supabase; no se escriben en Git. Hacer privado el repositorio no convierte los archivos estáticos publicados en privados.
- Una cuenta pertenece a un espacio familiar en esta primera versión. Ambos miembros pueden editar el mismo calendario. Para otra familia, crear otro espacio y sus membresías.
- La base de datos aplica RLS y solo permite escritura mediante una función que comprueba membresía, bloquea la fila y exige la revisión esperada. Las asignaciones de familia solo las cambia el administrador.
- Se retienen las 20 versiones anteriores en `family_history`, solo legibles por miembros de esa familia. No equivale a una copia externa; descargar copias periódicamente.
- Recuperación: el administrador puede extraer `data` de una versión en `family_history` y guardarlo como JSON con `menus` y `recipes`. El usuario lo carga en **Recuperar una còpia** y confirma el reemplazo; se crea una revisión nueva. No modificar la tabla directamente para evitar saltarse el control de versiones.
- Cada familia guarda un documento completo (calendario y biblioteca), adecuado para el uso familiar previsto. Límite de importación 6 MB; validación de contenido de 3 millones de caracteres, 2.000 recetas. El calendario de esta versión es 2026.
- Las nuevas recetas no incluyen subida de fotos. Las imágenes existentes y los metadatos del libro se conservan al editar. Solo se admiten rutas de imágenes locales de la biblioteca.
- Favoritos e historial de navegación siguen siendo locales del navegador. Las marcas de la compra se separan por cuenta/modo y semana; no se sincronizan entre dispositivos.
- No hay registro público, invitaciones desde la interfaz, borrado de recetas, subida de fotos ni sincronización instantánea en esta primera entrega.

## Verificación del desarrollo

La web no necesita Node para funcionar. Node 22 o posterior solo se utiliza para las pruebas:

```sh
npm ci --ignore-scripts
npm test
```

Las pruebas ejecutan PostgreSQL localmente mediante PGlite (sin servicios externos). Comprueban RLS con dos familias y tres usuarios, guardados con revisiones obsoletas, permisos de anónimos, historial, validación, preservación de datos, renovación de sesión y fallos de red. El correo y la configuración real del proyecto necesitan la comprobación final anterior.
