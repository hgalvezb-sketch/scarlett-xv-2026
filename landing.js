export const APPS_SCRIPT_EXEC_URL = 'https://script.google.com/macros/s/AKfycbxEap7RJgkSd2prm1qCkzZGyRf4x-vaq30sJJ5aguqvhUPz1JD0A3IxyHZJm1By9i6f/exec';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isCanonicalUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export function getInvitationToken(pageUrl) {
  let url;

  try {
    url = new URL(pageUrl);
  } catch {
    return null;
  }

  const tokenValues = url.searchParams.getAll('token');
  if (tokenValues.length !== 1 || !isCanonicalUuid(tokenValues[0])) {
    return null;
  }

  return tokenValues[0];
}

export function buildAppsScriptUrl(destination, token) {
  if (destination === '__APPS_SCRIPT_EXEC_URL__') {
    throw new Error('La URL de Apps Script todavía no está configurada.');
  }

  if (!isCanonicalUuid(token)) {
    throw new TypeError('El token debe ser un UUID canónico.');
  }

  let url;

  try {
    url = new URL(destination);
  } catch {
    throw new TypeError('La URL de destino debe usar HTTPS.');
  }

  if (url.protocol !== 'https:' || url.hostname !== 'script.google.com') {
    throw new TypeError('La URL de destino debe usar HTTPS y pertenecer a Apps Script.');
  }

  url.search = '';
  url.hash = '';
  url.searchParams.set('token', token);
  return url.toString();
}

function updateStatus(documentObject, state, title, message) {
  const status = documentObject.getElementById('status');
  const statusTitle = documentObject.getElementById('statusTitle');
  const statusMessage = documentObject.getElementById('statusMessage');

  if (!status || !statusTitle || !statusMessage) {
    return;
  }

  status.dataset.state = state;
  statusTitle.textContent = title;
  statusMessage.textContent = message;
}

export function startLanding(
  documentObject,
  locationObject,
  appsScriptExecUrl = APPS_SCRIPT_EXEC_URL,
) {
  const token = getInvitationToken(locationObject.href);

  if (!token) {
    updateStatus(
      documentObject,
      'invalid',
      'Enlace de invitación no válido',
      'Solicita a la familia anfitriona que te comparta nuevamente tu enlace personal.',
    );
    return false;
  }

  let destination;

  try {
    destination = buildAppsScriptUrl(appsScriptExecUrl, token);
  } catch {
    updateStatus(
      documentObject,
      'unavailable',
      'Invitación temporalmente no disponible',
      'Intenta abrir este mismo enlace nuevamente en unos minutos.',
    );
    return false;
  }

  updateStatus(
    documentObject,
    'ready',
    'Abriendo tu invitación',
    'Estamos preparando una experiencia especial para ti.',
  );
  locationObject.replace(destination);
  return true;
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  startLanding(document, window.location);
}
