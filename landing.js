const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEPLOYMENT_ID_PATTERN = /^[A-Za-z0-9_-]{20,128}$/;

export function isCanonicalUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export function isValidDeploymentId(value) {
  return typeof value === 'string' && DEPLOYMENT_ID_PATTERN.test(value);
}

export function getInvitationParameters(pageUrl) {
  let url;

  try {
    url = new URL(pageUrl);
  } catch {
    return null;
  }

  if (url.searchParams.size !== 2) {
    return null;
  }

  const deploymentIdValues = url.searchParams.getAll('app');
  const tokenValues = url.searchParams.getAll('token');
  if (
    deploymentIdValues.length !== 1
    || tokenValues.length !== 1
    || !isValidDeploymentId(deploymentIdValues[0])
    || !isCanonicalUuid(tokenValues[0])
  ) {
    return null;
  }

  return {
    deploymentId: deploymentIdValues[0],
    token: tokenValues[0],
  };
}

export function buildAppsScriptUrl(deploymentId, token) {
  if (!isValidDeploymentId(deploymentId)) {
    throw new TypeError('El deployment ID de Apps Script no es válido.');
  }

  if (!isCanonicalUuid(token)) {
    throw new TypeError('El token debe ser un UUID canónico.');
  }

  return `https://script.google.com/macros/s/${deploymentId}/exec?token=${encodeURIComponent(token)}`;
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
) {
  const invitationParameters = getInvitationParameters(locationObject.href);

  if (!invitationParameters) {
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
    destination = buildAppsScriptUrl(
      invitationParameters.deploymentId,
      invitationParameters.token,
    );
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
