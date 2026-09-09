'use strict';

(function initializeInvitation() {
  const core = window.InvitationCore;
  if (!core) return;

  const EVENT_DATE = new Date('2026-10-24T18:00:00-06:00');
  const VENUE_ADDRESS = 'Salón de Eventos Mayyo, Calle 5 de Febrero, Nandambua 2a. Sección, C.P. 29160, Chiapa de Corzo, Chiapas';
  const DEFAULT_GUEST = Object.freeze({
    guestName: 'Familia invitada',
    maxPasses: 4,
    token: '',
  });

  const staticBackendId = new URLSearchParams(window.location.search).get('app') || '';

  function isAppsScriptRuntime() {
    return Boolean(window.google?.script?.run) || /^[A-Za-z0-9_-]{20,128}$/.test(staticBackendId);
  }

  const bootstrap = core.resolveInvitationBootstrap({
    isAppsScript: isAppsScriptRuntime(),
    search: window.location.search,
    initialToken: typeof window.__INITIAL_TOKEN__ === 'string' ? window.__INITIAL_TOKEN__ : '',
    defaults: DEFAULT_GUEST,
  });
  const state = { ...bootstrap };
  if (staticBackendId) {
    state.mode = 'published';
    state.token = new URLSearchParams(window.location.search).get('token') || '';
    state.access = state.token ? 'pending' : 'invalid';
  }
  const initialGuest = window.__INITIAL_GUEST__ && typeof window.__INITIAL_GUEST__ === 'object'
    ? core.normalizePublishedGuest(window.__INITIAL_GUEST__, bootstrap.token)
    : null;
  if (initialGuest && state.mode === 'published') {
    state.guest = initialGuest;
    state.access = 'ready';
  }

  const body = document.body;
  const main = document.querySelector('main');
  const openingScreen = document.querySelector('#openingScreen');
  const openButton = document.querySelector('#openInvitation');
  const openingHint = document.querySelector('.opening-hint');
  const invitationAccess = document.querySelector('#invitationAccess');
  const accessMessage = document.querySelector('#accessMessage');
  const reviewRibbon = document.querySelector('#reviewRibbon');
  const skipLink = document.querySelector('.skip-link');
  const quickActions = document.querySelector('.quick-actions');
  const personalizedSections = document.querySelectorAll('[data-personalized-section]');
  const personalizedLinks = document.querySelectorAll('[data-personalized-link]');
  const rsvpForm = document.querySelector('#rsvpForm');
  const confirmedCount = document.querySelector('#confirmedCount');
  const formStatus = document.querySelector('#formStatus');
  const lightbox = document.querySelector('#lightbox');
  const backgroundMusic = document.querySelector('#backgroundMusic');
  const musicAutoplayFallback = document.querySelector('#musicAutoplayFallback');
  const guestQr = document.querySelector('#guestQr');
  const invitationVideo = document.querySelector('.phone-frame video');
  let musicPausedByVideo = false;

  function createQrSvg(personalUrl) {
    if (!personalUrl || typeof window.qrcode !== 'function') return null;

    const qr = window.qrcode(0, 'M');
    qr.addData(personalUrl, 'Byte');
    qr.make();

    const moduleCount = qr.getModuleCount();
    const quietZone = 4;
    const viewSize = moduleCount + (quietZone * 2);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    const modules = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const path = [];

    for (let row = 0; row < moduleCount; row += 1) {
      for (let column = 0; column < moduleCount; column += 1) {
        if (qr.isDark(row, column)) {
          path.push(`M${column + quietZone} ${row + quietZone}h1v1h-1z`);
        }
      }
    }

    svg.setAttribute('viewBox', `0 0 ${viewSize} ${viewSize}`);
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('shape-rendering', 'crispEdges');
    svg.setAttribute('focusable', 'false');
    background.setAttribute('width', String(viewSize));
    background.setAttribute('height', String(viewSize));
    background.setAttribute('fill', '#ffffff');
    modules.setAttribute('d', path.join(''));
    modules.setAttribute('fill', '#4b2733');
    svg.append(background, modules);

    return svg;
  }

  function renderPersonalQr() {
    if (!guestQr || !state.guest) return;

    const initialPersonalSource = state.personalInvitationUrl || window.location.href;
    let personalUrl = core.buildPersonalInvitationUrl(initialPersonalSource, state.guest.token);
    if (!state.personalInvitationUrl
      && typeof window.__PUBLIC_INVITATION_URL__ === 'string'
      && window.__PUBLIC_INVITATION_URL__) {
      const publishedUrl = core.buildPersonalInvitationUrl(
        window.__PUBLIC_INVITATION_URL__,
        state.guest.token,
      );
      if (publishedUrl) personalUrl = publishedUrl;
    }

    const svg = createQrSvg(personalUrl);
    if (!svg) {
      guestQr.setAttribute('aria-label', 'Código QR personal no disponible');
      return;
    }

    guestQr.replaceChildren(svg);
    guestQr.dataset.qrValue = personalUrl;
    guestQr.setAttribute('role', 'presentation');

    const qrGraphic = guestQr.querySelector('svg');
    qrGraphic.setAttribute('role', 'img');
    qrGraphic.setAttribute(
      'aria-label',
      `Código QR para la invitación de ${state.guest.guestName}`,
    );
  }

  function hideMusicAutoplayFallback() {
    if (musicAutoplayFallback) musicAutoplayFallback.hidden = true;
  }

  function showMusicAutoplayFallback() {
    if (musicAutoplayFallback) musicAutoplayFallback.hidden = false;
  }

  function requestSongPlayback() {
    if (!backgroundMusic) return;
    hideMusicAutoplayFallback();
    backgroundMusic.volume = 0.65;

    try {
      backgroundMusic.play().catch(showMusicAutoplayFallback);
    } catch (_error) {
      showMusicAutoplayFallback();
    }
  }

  function pauseMusicForVideo() {
    if (!backgroundMusic) return;
    musicPausedByVideo = !backgroundMusic.paused;
    if (musicPausedByVideo) backgroundMusic.pause();
  }

  function resumeMusicAfterVideo() {
    if (!musicPausedByVideo) return;
    if (!backgroundMusic) return;
    musicPausedByVideo = false;
    hideMusicAutoplayFallback();

    try {
      backgroundMusic.play().catch(showMusicAutoplayFallback);
    } catch (_error) {
      showMusicAutoplayFallback();
    }
  }

  function setPersonalizedAccess(isAllowed) {
    [...personalizedSections, ...personalizedLinks].forEach((element) => {
      element.hidden = !isAllowed;
      element.inert = !isAllowed;
    });
  }

  function setOpeningBusy(isBusy) {
    openingScreen?.setAttribute('aria-busy', String(isBusy));
    if (openButton) {
      openButton.disabled = isBusy;
      openButton.setAttribute('aria-disabled', String(isBusy));
      const label = openButton.querySelector('span');
      if (label) label.textContent = isBusy ? 'Validando invitación…' : 'Abrir invitación';
    }
    if (openingHint) {
      openingHint.textContent = isBusy
        ? 'Estamos comprobando tu pase personal'
        : 'Toca para abrir con música';
    }
  }

  function openInvitation() {
    if (state.access !== 'ready' || !state.guest || !main || !openingScreen) return;

    requestSongPlayback();
    main.inert = false;
    if (quickActions) quickActions.inert = false;
    if (skipLink) skipLink.tabIndex = 0;
    body.classList.remove('is-locked');
    body.classList.add('is-open');
    main.focus({ preventScroll: true });
    openingScreen.inert = true;
    openingScreen.setAttribute('aria-hidden', 'true');
    window.setTimeout(() => {
      openingScreen.hidden = true;
    }, 850);
  }

  function showInvalidInvitation(message) {
    state.access = 'invalid';
    state.guest = null;
    setPersonalizedAccess(false);
    reviewRibbon?.setAttribute('hidden', '');
    body.classList.remove('is-locked', 'is-open');
    body.classList.add('is-invalid');

    if (main) {
      main.inert = true;
      main.hidden = true;
    }
    if (quickActions) {
      quickActions.inert = true;
      quickActions.hidden = true;
    }
    if (backgroundMusic) {
      backgroundMusic.pause();
      backgroundMusic.currentTime = 0;
    }
    if (skipLink) skipLink.hidden = true;
    if (accessMessage && message) accessMessage.textContent = message;
    if (invitationAccess) {
      invitationAccess.hidden = false;
      invitationAccess.inert = false;
      invitationAccess.focus({ preventScroll: true });
    }
    if (openingScreen) {
      openingScreen.inert = true;
      openingScreen.hidden = true;
      openingScreen.setAttribute('aria-hidden', 'true');
    }
  }

  function authorizeGuest(guest) {
    state.guest = guest;
    state.token = guest.token;
    state.access = 'ready';
    renderGuest();
    renderPersonalQr();
    setPersonalizedAccess(true);
    setOpeningBusy(false);

    window.requestAnimationFrame(() => {
      openButton?.focus({ preventScroll: true });
    });
  }

  function renderGuest() {
    if (!state.guest) return;

    document.querySelectorAll('[data-guest-name]').forEach((element) => {
      element.textContent = state.guest.guestName;
    });

    document.querySelectorAll('[data-pass-count]').forEach((element) => {
      element.textContent = String(state.guest.maxPasses);
    });

    document.querySelectorAll('[data-pass-label]').forEach((element) => {
      if (state.guest.maxPasses === 0) {
        element.textContent = 'sin pases';
      } else {
        element.textContent = state.guest.maxPasses === 1 ? 'pase' : 'pases';
      }
    });

    if (confirmedCount) {
      confirmedCount.max = String(state.guest.maxPasses);
      confirmedCount.value = String(Math.min(1, state.guest.maxPasses));
    }
  }

  function renderCountdown() {
    const remaining = core.countdownParts(EVENT_DATE, new Date());
    const values = {
      days: remaining.days,
      hours: remaining.hours,
      minutes: remaining.minutes,
      seconds: remaining.seconds,
    };

    Object.entries(values).forEach(([key, value]) => {
      const element = document.querySelector(`[data-countdown="${key}"]`);
      if (element) element.textContent = String(value).padStart(2, '0');
    });

    const countdown = document.querySelector('#countdown');
    if (remaining.isExpired && countdown) {
      countdown.setAttribute('aria-label', 'La celebración ha comenzado');
    }
  }

  function setupRevealAnimations() {
    const elements = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
      elements.forEach((element) => element.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver((entries, currentObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        currentObserver.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    elements.forEach((element) => observer.observe(element));
  }

  function setupGallery() {
    if (!lightbox || typeof lightbox.showModal !== 'function') return;
    const expandedImage = lightbox.querySelector('img');
    const closeButton = lightbox.querySelector('.lightbox__close');

    document.querySelectorAll('[data-gallery-src]').forEach((button) => {
      button.addEventListener('click', () => {
        const thumbnail = button.querySelector('img');
        expandedImage.src = button.dataset.gallerySrc;
        expandedImage.alt = thumbnail?.alt || 'Retrato ampliado de Scarlett';
        lightbox.showModal();
      });
    });

    closeButton?.addEventListener('click', () => lightbox.close());
    lightbox.addEventListener('click', (event) => {
      if (event.target === lightbox) lightbox.close();
    });
  }

  function setupQuickActions() {
    quickActions?.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        const targetId = link.getAttribute('href')?.slice(1);
        if (!targetId) return;

        const target = document.getElementById(targetId);
        if (!target || target.hidden) return;

        target.scrollIntoView({ behavior: 'auto', block: 'start' });
        window.requestAnimationFrame?.(() => {
          target.scrollIntoView({ behavior: 'auto', block: 'start' });
        });
        if (typeof window.history.replaceState === 'function') {
          window.history.replaceState(null, '', `#${targetId}`);
        }
      });
    });
  }

  function appsScriptCall(method, payload, timeoutMs = 12000) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (handler, value) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        handler(value);
      };
      const timeoutId = window.setTimeout(
        () => finish(reject, new Error('El servidor tardó demasiado en responder.')),
        timeoutMs,
      );
      if (!window.google?.script?.run) {
        const parameters = new URLSearchParams({
          api: method,
          format: 'json',
          token: typeof payload === 'string' ? payload : (payload?.token || ''),
        });
        if (method === 'submitRsvp') {
          parameters.set('status', payload.status || '');
          parameters.set('confirmedAttendees', String(payload.confirmedAttendees || 0));
        }
        if (method === 'submitWish') {
          parameters.set('author', payload.author || '');
          parameters.set('message', payload.message || '');
        }
        fetch(`https://script.google.com/macros/s/${staticBackendId}/exec?${parameters}`, {
          credentials: 'omit',
          signal: AbortSignal.timeout(timeoutMs),
        })
          .then((response) => response.ok ? response.json() : Promise.reject(new Error('Respuesta HTTP inválida.')))
          .then((value) => finish(resolve, value))
          .catch((error) => finish(reject, error));
        return;
      }

      const runner = window.google.script.run
        .withSuccessHandler((value) => finish(resolve, value))
        .withFailureHandler(() => finish(
          reject,
          new Error('No fue posible comunicarse con el servidor.'),
        ));

      if (method === 'getInvitationData') runner.getInvitationData(payload);
      if (method === 'submitRsvp') runner.submitRsvp(payload);
      if (method === 'submitWish') runner.submitWish(payload);
    });
  }

  async function hydrateFromSheet(attempt = 0) {
    if (state.mode !== 'published' || state.access !== 'pending' || !state.token) {
      showInvalidInvitation();
      return;
    }

    try {
      const response = await appsScriptCall('getInvitationData', state.token);
      const validatedGuest = response?.ok
        ? core.normalizePublishedGuest(response.data, state.token)
        : null;

      if (!validatedGuest) {
        showInvalidInvitation();
        return;
      }

      const personalInvitationUrl = core.buildPersonalInvitationUrl(
        response.data?.invitationUrl,
        state.token,
      );
      if (personalInvitationUrl) {
        try {
          const parsedPersonalUrl = new URL(personalInvitationUrl);
          if (parsedPersonalUrl.hostname === 'hgalvezb-sketch.github.io'
            && parsedPersonalUrl.pathname === '/scarlett-xv-2026/'
            && parsedPersonalUrl.searchParams.has('app')) {
            state.personalInvitationUrl = personalInvitationUrl;
          }
        } catch (_error) {
          state.personalInvitationUrl = '';
        }
      }

      authorizeGuest(validatedGuest);
    } catch (_error) {
      if (attempt < 1) {
        window.setTimeout(() => hydrateFromSheet(attempt + 1), 750);
        return;
      }
      showInvalidInvitation('No pudimos validar este pase. Solicita a la familia un enlace nuevo e inténtalo nuevamente.');
    }
  }

  function setFormStatus(message, stateName = 'success') {
    if (!formStatus) return;
    formStatus.dataset.state = stateName;
    formStatus.textContent = message;
  }

  function setupRsvp() {
    if (!rsvpForm || !confirmedCount) return;

    rsvpForm.querySelectorAll('input[name="attendance"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        if (!state.guest || state.access !== 'ready') return;
        const attending = rsvpForm.elements.attendance.value === 'yes';
        confirmedCount.disabled = !attending;
        confirmedCount.value = attending ? String(Math.min(1, state.guest.maxPasses)) : '0';
      });
    });

    rsvpForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!state.guest || state.access !== 'ready') {
        setFormStatus('Este pase aún no ha sido validado.', 'error');
        return;
      }

      const attendance = rsvpForm.elements.attendance.value;
      if (!attendance) {
        setFormStatus('Selecciona si podrás acompañarnos.', 'error');
        rsvpForm.querySelector('input[name="attendance"]')?.focus();
        return;
      }

      const attending = attendance === 'yes';
      const attendees = attending
        ? core.clampConfirmed(confirmedCount.value, state.guest.maxPasses)
        : 0;
      const message = String(rsvpForm.elements.wishMessage.value || '').trim().slice(0, 300);

      if (attending && attendees < 1) {
        setFormStatus('Indica al menos una persona para confirmar.', 'error');
        confirmedCount.focus();
        return;
      }

      const submitButton = rsvpForm.querySelector('button[type="submit"]');
      submitButton.disabled = true;
      submitButton.textContent = 'Enviando…';

      try {
        if (state.mode === 'published') {
          const response = await appsScriptCall('submitRsvp', {
            token: state.guest.token,
            status: attending ? 'confirmed' : 'declined',
            confirmedAttendees: attendees,
          });
          if (!response?.ok) throw new Error('Respuesta inválida');

          if (message) {
            const wishResponse = await appsScriptCall('submitWish', {
              token: state.guest.token,
              author: state.guest.guestName,
              message,
            });
            if (!wishResponse?.ok) {
              setFormStatus('Tu asistencia quedó registrada, pero el mensaje no pudo guardarse.', 'error');
              return;
            }
          }
          setFormStatus('¡Gracias! Tu confirmación quedó registrada.');
        } else {
          await new Promise((resolve) => window.setTimeout(resolve, 450));
          setFormStatus('Vista previa validada. Al publicar, esta respuesta se guardará en Google Sheets.');
        }
      } catch (_error) {
        setFormStatus('No pudimos guardar tu respuesta. Intenta nuevamente.', 'error');
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Enviar confirmación';
      }
    });
  }

  function configureReviewMode() {
    const params = new URLSearchParams(window.location.search);
    if (state.mode === 'published' || params.get('review') === '0') {
      reviewRibbon?.setAttribute('hidden', '');
    } else {
      reviewRibbon?.removeAttribute('hidden');
    }
  }

  function configureMapLinks() {
    const venueUrl = core.buildMapsUrl(VENUE_ADDRESS);
    document.querySelectorAll('.map-link').forEach((link) => {
      link.href = venueUrl;
    });
  }

  openButton?.addEventListener('click', openInvitation);
  invitationVideo?.addEventListener('play', pauseMusicForVideo);
  invitationVideo?.addEventListener('pause', resumeMusicAfterVideo);
  invitationVideo?.addEventListener('ended', resumeMusicAfterVideo);
  openingScreen?.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && state.access === 'ready') openInvitation();
  });

  setPersonalizedAccess(false);
  configureReviewMode();
  configureMapLinks();
  renderCountdown();
  setupRevealAnimations();
  setupGallery();
  setupQuickActions();
  setupRsvp();

  if (state.mode === 'preview' || state.access === 'ready') {
    if (state.guest) authorizeGuest(state.guest);
  } else if (state.access === 'invalid') {
    showInvalidInvitation();
  } else {
    setOpeningBusy(true);
    openingScreen?.focus({ preventScroll: true });
    let hydrationScheduled = false;
    const startPublishedHydration = () => {
      if (hydrationScheduled) return;
      hydrationScheduled = true;
      window.setTimeout(() => hydrateFromSheet(), 250);
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startPublishedHydration, { once: true });
    } else {
      startPublishedHydration();
    }
    window.setTimeout(startPublishedHydration, 250);
  }

  window.setInterval(renderCountdown, 1000);
})();
