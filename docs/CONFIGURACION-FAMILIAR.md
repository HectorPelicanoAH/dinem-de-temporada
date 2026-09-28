# Activar el calendario familiar

La instancia real de Supabase y Google OAuth ya está configurada para `peli.tlc@gmail.com` y `albafuentes89@gmail.com`. La interfaz ofrece únicamente el acceso con Google.

## Probar antes de publicar

Ejecutar `python3 -m http.server 8080` en la raíz y abrir `http://localhost:8080/familia.html`. Para probar Google OAuth localmente, añadir temporalmente esa URL a las redirecciones permitidas en Supabase y retirarla al terminar. La cuenta debe estar autorizada en Google Cloud y tener membresía en la familia.

Las cuentas reales entran con Google y mantienen una sesión en sessionStorage (por pestaña). No hay contraseñas ni códigos por correo gestionados por la web. Los cambios se guardan con los botones «Desar». Para ver cambios hechos en otro dispositivo hay que recargar; no se incorpora sincronización en tiempo real.

## Configuración de una instalación nueva, en orden

1. Crear un proyecto Supabase gratuito. Elegir una región europea. Guardar la contraseña de base de datos en un gestor de contraseñas; nunca en este repositorio.
2. Ejecutar una sola vez `supabase/migrations/001_family.sql` desde SQL Editor. Crea las tablas, los permisos y la función de guardado.
3. Desactivar el registro de usuarios nuevos y el proveedor Email en Supabase. Mantener habilitado Google.
4. Crear un cliente OAuth web en Google Cloud. Registrar `https://<proyecto>.supabase.co/auth/v1/callback` como URI de redirección, guardar el ID y secreto solo en el proveedor Google de Supabase y añadir las cuentas autorizadas como usuarios de prueba en Google Cloud.
5. Crear los dos usuarios desde la administración de Supabase, con sus correos autorizados. No es necesario habilitar el registro público. Al entrar con Google usando el mismo correo verificado, Supabase vincula la identidad con el usuario existente.
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
8. Publicar la rama revisada en el alojamiento estático existente. Es compatible con GitHub Pages y rutas bajo una subcarpeta. Configurar Site URL de Supabase con la dirección publicada y permitir la URL publicada de `familia.html` como retorno OAuth. En esta instancia son `https://hectorpelicanoah.github.io/dinem-de-temporada` y `https://hectorpelicanoah.github.io/dinem-de-temporada/familia.html`.
9. Entrar con la primera cuenta y pulsar **Crear la nostra còpia**. Inicializa los 365 días de 2026 y las recetas presentes en `data/recipes.json` en ese momento.
10. Entrar desde otro navegador/dispositivo con la segunda cuenta y verificar que ambos ven la misma familia.

Referencias: [Google OAuth](https://supabase.com/docs/guides/auth/social-login/auth-google), [vinculación de identidades](https://supabase.com/docs/guides/auth/auth-identity-linking), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Comprobación final antes de darlo por activado

- Inicio de sesión con Google en las dos cuentas autorizadas; una cuenta no invitada no puede entrar en Google durante el modo de prueba ni acceder a datos familiares.
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

Las pruebas ejecutan PostgreSQL localmente mediante PGlite (sin servicios externos). Comprueban RLS con dos familias y tres usuarios, guardados con revisiones obsoletas, permisos de anónimos, historial, validación, retorno OAuth, renovación de sesión y fallos de red. El acceso real de cada cuenta necesita la comprobación final anterior.
