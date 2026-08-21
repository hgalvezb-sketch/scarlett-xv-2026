# Scarlett XV 2026 — hosting público

Portada Open Graph y recursos multimedia de la invitación de Scarlett Montserrath.

## Privacidad

- El repositorio no contiene nombres, pases ni tokens reales de invitados.
- Cada enlace conserva únicamente un UUID opaco al redirigir al web app.
- La portada usa `noindex, nofollow` y no incluye datos personales en la vista previa de WhatsApp.

## Arquitectura

- GitHub Pages sirve la portada, la imagen social y los recursos estáticos por HTTPS.
- Google Apps Script valida cada UUID contra la hoja privada y sirve la invitación personalizada.
- Por política actual del dominio propietario, el web app está restringido a cuentas del dominio durante la revisión. Antes de enviarlo a invitados externos se debe desplegar el backend desde una cuenta que permita acceso anónimo.

## Derechos de uso

La familia anfitriona debe conservar autorización para publicar las fotografías, el video y la pista musical incluidos.
