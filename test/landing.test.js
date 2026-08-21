import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  APPS_SCRIPT_EXEC_URL,
  buildAppsScriptUrl,
  getInvitationToken,
  isCanonicalUuid,
  startLanding,
} from '../landing.js';

const projectRoot = new URL('../', import.meta.url);
const validToken = '123e4567-e89b-42d3-a456-426614174000';

async function readProjectFile(relativePath) {
  return readFile(new URL(relativePath, projectRoot), 'utf8');
}

test('accepts canonical UUID tokens without altering their value', () => {
  const uppercaseToken = validToken.toUpperCase();

  assert.equal(isCanonicalUuid(validToken), true);
  assert.equal(isCanonicalUuid(uppercaseToken), true);
  assert.equal(getInvitationToken(`https://example.test/?token=${uppercaseToken}`), uppercaseToken);
});

test('rejects malformed, missing, duplicated, and non-canonical tokens', () => {
  assert.equal(isCanonicalUuid('not-a-token'), false);
  assert.equal(isCanonicalUuid('{123e4567-e89b-42d3-a456-426614174000}'), false);
  assert.equal(getInvitationToken('https://example.test/'), null);
  assert.equal(getInvitationToken('https://example.test/?token='), null);
  assert.equal(
    getInvitationToken(`https://example.test/?token=${validToken}&token=${validToken}`),
    null,
  );
});

test('builds a redirect that preserves only the validated token', () => {
  const redirect = buildAppsScriptUrl(
    'https://script.google.com/macros/s/example/exec?ignored=true#section',
    validToken,
  );

  assert.equal(
    redirect,
    `https://script.google.com/macros/s/example/exec?token=${validToken}`,
  );
});

test('rejects unsafe or unconfigured redirect destinations', () => {
  assert.match(APPS_SCRIPT_EXEC_URL, /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/);
  assert.throws(() => buildAppsScriptUrl('__APPS_SCRIPT_EXEC_URL__', validToken), /configurad/i);
  assert.throws(() => buildAppsScriptUrl('http://example.test/exec', validToken), /HTTPS/i);
  assert.throws(() => buildAppsScriptUrl('javascript:alert(1)', validToken), /HTTPS/i);
  assert.throws(
    () => buildAppsScriptUrl('https://script.google.com/macros/s/example/exec', 'bad-token'),
    /UUID/i,
  );
});

test('publishes complete generic Open Graph and Twitter metadata', async () => {
  const html = await readProjectFile('index.html');

  assert.match(html, /<meta\s+name="robots"\s+content="noindex,\s*nofollow"/i);
  assert.match(html, /property="og:type"\s+content="website"/i);
  assert.match(html, /property="og:title"\s+content="Los XV de Scarlett Montserrath"/i);
  assert.match(html, /property="og:description"\s+content="Acompáñanos a celebrar sus XV años el 24 de octubre de 2026\."/i);
  assert.match(
    html,
    /property="og:image"\s+content="https:\/\/hgalvezb-sketch\.github\.io\/scarlett-xv-2026\/assets\/whatsapp-preview\.jpg"/i,
  );
  assert.match(html, /name="twitter:card"\s+content="summary_large_image"/i);
  assert.match(html, /name="twitter:image"\s+content="https:\/\/hgalvezb-sketch\.github\.io\/scarlett-xv-2026\/assets\/whatsapp-preview\.jpg"/i);
});

test('contains no embedded guest PII or invitation UUID', async () => {
  const files = await Promise.all([
    readProjectFile('index.html'),
    readProjectFile('landing.js'),
    readProjectFile('styles.css'),
  ]);
  const source = files.join('\n');

  assert.doesNotMatch(source, /Familia Invitada/i);
  assert.doesNotMatch(source, /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i);
});

test('provides accessible progress and invalid-link states without exposing the token', async () => {
  const html = await readProjectFile('index.html');
  const script = await readProjectFile('landing.js');

  const status = { dataset: {} };
  const statusTitle = { textContent: '' };
  const statusMessage = { textContent: '' };
  const documentObject = {
    getElementById(id) {
      return { status, statusTitle, statusMessage }[id] ?? null;
    },
  };
  const invalidLocation = {
    href: 'https://example.test/',
    replace() {
      assert.fail('An invalid invitation must not redirect.');
    },
  };

  assert.equal(startLanding(documentObject, invalidLocation), false);
  assert.equal(status.dataset.state, 'invalid');
  assert.equal(statusTitle.textContent, 'Enlace de invitación no válido');

  let redirectedTo = null;
  const validLocation = {
    href: `https://example.test/?token=${validToken}`,
    replace(url) {
      redirectedTo = url;
    },
  };

  assert.equal(
    startLanding(
      documentObject,
      validLocation,
      'https://script.google.com/macros/s/example/exec',
    ),
    true,
  );
  assert.equal(
    redirectedTo,
    `https://script.google.com/macros/s/example/exec?token=${validToken}`,
  );

  assert.match(html, /id="status"[^>]+role="status"[^>]+aria-live="polite"/i);
  assert.match(html, /Enlace de invitación no válido/i);
  assert.doesNotMatch(script, /innerHTML/);
  assert.doesNotMatch(script, /textContent\s*=\s*token/);
});

test('uses a responsive burgundy/rose design with reduced-motion support', async () => {
  const css = await readProjectFile('styles.css');

  assert.match(css, /--color-burgundy\s*:/);
  assert.match(css, /--color-rose\s*:/);
  assert.match(css, /@media\s*\(max-width:\s*30rem\)/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b(?![^{}]*--color-)/i);
});
