'use strict';

(function attachInvitationCore(root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.InvitationCore = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function createInvitationCore() {
  const MAX_GUEST_NAME_LENGTH = 120;
  const MAX_TOKEN_LENGTH = 128;
  const MAX_PASSES = 20;
  const SAFE_NAME = /^[\p{L}\p{M}\p{N} .,'’&-]+$/u;
  const SAFE_TOKEN = /^[A-Za-z0-9_-]{6,128}$/;
  const PUBLISHED_TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const DEPLOYMENT_ID = /^[A-Za-z0-9_-]{20,200}$/;

  function cloneDefaults(defaults) {
    return {
      guestName: String(defaults?.guestName ?? 'Familia invitada'),
      maxPasses: Number.isFinite(Number(defaults?.maxPasses))
        ? Math.max(0, Math.min(MAX_PASSES, Math.floor(Number(defaults.maxPasses))))
        : 1,
      token: String(defaults?.token ?? ''),
    };
  }

  function hasMalformedEncoding(search) {
    return /%(?![0-9A-Fa-f]{2})/.test(search);
  }

  function readFirst(params, names) {
    for (const name of names) {
      if (params.has(name)) return params.get(name);
    }
    return null;
  }

  function parseGuestParams(search, defaults) {
    const fallback = cloneDefaults(defaults);
    const source = typeof search === 'string' ? search : '';

    if (hasMalformedEncoding(source)) return fallback;

    let params;
    try {
      params = new URLSearchParams(source.startsWith('?') ? source.slice(1) : source);
    } catch (_error) {
      return fallback;
    }

    const guestRaw = readFirst(params, ['guest', 'invitado']);
    const passesRaw = readFirst(params, ['passes', 'pases']);
    const tokenRaw = readFirst(params, ['token', 'ci']);

    const guestName = guestRaw === null ? fallback.guestName : guestRaw.trim().replace(/\s+/g, ' ');
    const maxPasses = passesRaw === null ? fallback.maxPasses : Number(passesRaw);
    const token = tokenRaw === null ? fallback.token : tokenRaw.trim();

    const validGuest = guestName.length > 0
      && guestName.length <= MAX_GUEST_NAME_LENGTH
      && SAFE_NAME.test(guestName)
      && !/[\u0000-\u001F\u007F]/.test(guestName);
    const validPasses = Number.isInteger(maxPasses) && maxPasses >= 0 && maxPasses <= MAX_PASSES;
    const validToken = token === '' || (token.length <= MAX_TOKEN_LENGTH && SAFE_TOKEN.test(token));

    if (!validGuest || !validPasses || !validToken) return fallback;

    return { guestName, maxPasses, token };
  }

  function normalizePublishedToken(value) {
    const token = typeof value === 'string' ? value.trim().toLowerCase() : '';
    return PUBLISHED_TOKEN.test(token) ? token : '';
  }

  function publishedTokenFromSearch(search) {
    const source = typeof search === 'string' ? search : '';
    if (hasMalformedEncoding(source)) return '';

    try {
      const params = new URLSearchParams(source.startsWith('?') ? source.slice(1) : source);
      return normalizePublishedToken(readFirst(params, ['token', 'ci']));
    } catch (_error) {
      return '';
    }
  }

  function resolveInvitationBootstrap(options) {
    const settings = options && typeof options === 'object' ? options : {};
    const isAppsScript = settings.isAppsScript === true;

    if (!isAppsScript) {
      const guest = parseGuestParams(settings.search, settings.defaults);
      return {
        mode: 'preview',
        access: 'ready',
        token: guest.token,
        guest,
      };
    }

    const token = normalizePublishedToken(settings.initialToken)
      || publishedTokenFromSearch(settings.search);

    return {
      mode: 'published',
      access: token ? 'pending' : 'invalid',
      token,
      guest: null,
    };
  }

  function normalizePublishedGuest(data, token) {
    if (!data || typeof data !== 'object') return null;

    const normalizedToken = normalizePublishedToken(token);
    const guestName = typeof data.guestName === 'string'
      ? data.guestName.trim().replace(/\s+/g, ' ')
      : '';
    const passes = Number(data.passes);
    const validGuest = guestName.length > 0
      && guestName.length <= MAX_GUEST_NAME_LENGTH
      && SAFE_NAME.test(guestName)
      && !/[\u0000-\u001F\u007F]/.test(guestName);
    const validPasses = Number.isInteger(passes) && passes >= 1 && passes <= MAX_PASSES;

    if (!normalizedToken || !validGuest || !validPasses) return null;

    return {
      guestName,
      maxPasses: passes,
      token: normalizedToken,
    };
  }

  function clampConfirmed(value, maxPasses) {
    const safeMax = Number.isFinite(Number(maxPasses))
      ? Math.max(0, Math.floor(Number(maxPasses)))
      : 0;
    const parsed = Number(value);
    const safeValue = Number.isFinite(parsed) ? Math.floor(parsed) : 0;
    return Math.min(safeMax, Math.max(0, safeValue));
  }

  function countdownParts(target, now = new Date()) {
    const targetTime = target instanceof Date ? target.getTime() : new Date(target).getTime();
    const nowTime = now instanceof Date ? now.getTime() : new Date(now).getTime();
    const remaining = targetTime - nowTime;

    if (!Number.isFinite(remaining) || remaining <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
    }

    const totalSeconds = Math.floor(remaining / 1000);
    return {
      days: Math.floor(totalSeconds / 86400),
      hours: Math.floor((totalSeconds % 86400) / 3600),
      minutes: Math.floor((totalSeconds % 3600) / 60),
      seconds: totalSeconds % 60,
      isExpired: false,
    };
  }

  function formatPassLabel(count) {
    const safeCount = Number.isFinite(Number(count)) ? Math.max(0, Math.floor(Number(count))) : 0;
    if (safeCount === 0) return 'Sin pases disponibles';
    if (safeCount === 1) return '1 pase';
    return `${safeCount} pases`;
  }

  function buildMapsUrl(address) {
    const protocol = 'https:';
    const slashes = String.fromCharCode(47, 47);
    const baseUrl = `${protocol}${slashes}www.google.com/maps/search/?api=1&query=`;
    return `${baseUrl}${encodeURIComponent(String(address ?? '').trim())}`;
  }

  function buildPersonalInvitationUrl(pageHref, token) {
    const normalizedToken = normalizePublishedToken(token);
    if (!normalizedToken || typeof pageHref !== 'string') return '';

    try {
      const url = new URL(pageHref);
      const isLocalPreview = url.protocol === 'http:'
        && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
      const isSafePublishedUrl = url.protocol === 'https:';

      if ((!isLocalPreview && !isSafePublishedUrl) || url.username || url.password) return '';

      const deploymentValues = url.searchParams.getAll('app');
      const deploymentId = deploymentValues.length === 1 && DEPLOYMENT_ID.test(deploymentValues[0])
        ? deploymentValues[0]
        : '';
      url.search = '';
      url.hash = '';
      if (deploymentId) url.searchParams.set('app', deploymentId);
      url.searchParams.set('token', normalizedToken);
      return url.toString();
    } catch (_error) {
      return '';
    }
  }

  return {
    parseGuestParams,
    clampConfirmed,
    countdownParts,
    formatPassLabel,
    buildMapsUrl,
    buildPersonalInvitationUrl,
    resolveInvitationBootstrap,
    normalizePublishedGuest,
  };
});
