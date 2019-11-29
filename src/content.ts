import browser from 'webextension-polyfill';

// The content script can listen to events from the webpage but is not allowed
// to access the tabs API. This content script is used as a broker between the
// webpage and the extension's background script. The background script can
// access the tabs API.

/**
 * Forward spe:open events to the background script
 */
document.addEventListener('spe:open', event => {
  const { url, id, action } = (event as CustomEvent).detail;
  browser.runtime.sendMessage({
    type: 'spe:open',
    data: { url: id ? location.origin + url : url, id, name: action }
  });
});

/**
 * Forward spe:close events to the background script
 */
document.addEventListener('spe:close', event => {
  const { id, ...rest } = (event as CustomEvent).detail;
  browser.runtime.sendMessage({
    type: 'spe:close',
    data: { id, rest }
  });
});

/**
 * Forward spe:update events to the background script
 */
document.addEventListener('spe:update', event => {
  const { prevId, nextId } = (event as CustomEvent).detail;
  browser.runtime.sendMessage({
    type: 'spe:update',
    data: { prevId, nextId }
  });
});

/**
 * Forward spe:ping events to the background script
 */
document.addEventListener('spe:ping', event => {
  const { target, interval } = (event as CustomEvent).detail;
  browser.runtime.sendMessage({
    type: 'spe:ping',
    data: { target, interval }
  });
});

/**
 * Forward spe:send events to the background script
 */
document.addEventListener('spe:send', event => {
  const { target, data } = (event as CustomEvent).detail;
  browser.runtime.sendMessage({
    type: 'spe:send',
    data: { target, data }
  });
});

/**
 * Forward messages from the background script
 */
browser.runtime.onMessage.addListener((request: any) => {
  const { type, data } = request;

  switch (type) {
    case 'spe:closed':
      dispatch('spe:closed', { ...data });
      break;
    case 'spe:opened':
      dispatch('spe:opened', { ...data });
      break;
    case 'spe:select':
      dispatch('spe:select', { ...data });
      break;
    case 'spe:send':
      dispatch('spe:receive', data);
      break;
  }
});

/**
 * Dispatches a custom event in the context of the webpage.
 * @param name Event name
 * @param detail Event data
 */
function dispatch(name: string, detail: any) {
  // Webpages are not allowed to access properties of an event dispatched from a
  // content script. We need to dispatch the event from the same context as the
  // webpage by injecting a script into the page.
  const script = document.createElement('script');
  script.innerText = `
    (function () {
      const data = { detail: ${JSON.stringify(detail)} };
      const event = new CustomEvent('${name}', data);
      document.dispatchEvent(event);
    })();
  `;

  // Attach script and cleanup after 1 second.
  document.body.appendChild(script);
  setTimeout(() => document.body.removeChild(script), 1000);
}
