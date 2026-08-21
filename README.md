# Scarlett XV 2026 — hosting público

Portada Open Graph y recursos multimedia de la invitación de Scarlett Montserrath.

## Privacidad

- El repositorio no contiene nombres, pases ni tokens reales de invitados.
- Cada enlace conserva únicamente un UUID opaco al redirigir al web app.
- La portada usa `noindex, nofollow` y no incluye datos personales en la vista previa de WhatsApp.

## Arquitectura

- GitHub Pages sirve la portada, la imagen social y los recursos estáticos por HTTPS.
- Google Apps Script valida cada UUID contra la hoja privada y sirve la invitación personalizada.
- La cuenta externa que administra la hoja aporta su propio `deploymentId`; la portada no conserva un despliegue fijo.
- El web app debe publicarse con acceso anónimo para que los invitados no tengan que iniciar sesión.

## Enlace portable

Cada invitación comparte esta forma canónica:

```text
https://hgalvezb-sketch.github.io/scarlett-xv-2026/?app=<deploymentId>&token=<uuid>
```

Después de validar ambos valores, la portada abre exclusivamente:

```text
https://script.google.com/macros/s/<deploymentId>/exec?token=<uuid>
```

Los valores ausentes o duplicados, los parámetros adicionales y cualquier intento de
inyectar una URL o dominio se rechazan antes de redirigir.

## Derechos de uso

La familia anfitriona debe conservar autorización para publicar las fotografías, el video y la pista musical incluidos.
