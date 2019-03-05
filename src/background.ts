import browser from 'webextension-polyfill';

window.onload = function main() {
  let mainTab: browser.tabs.Tab | null = null;
  let actionWin: browser.windows.Window | null = null;
  const actions = new Map<string, number>();
  const actionData = new Map<string, any>();

  async function openProcessWindow(url: string, id: string) {
    // Don't do anything if no id is provided.
    if (!id) return;

    // Get all id-keys of current client
    const [client, action] = id.split(':');
    const keys = [...actions.keys()].filter(k => k.startsWith(client + ':'));

    if (action && (!mainTab || !actionWin)) {
      // Store reference to the main tab
      const query = { currentWindow: true, active: true };
      mainTab = (await browser.tabs.query(query))[0];

      // No existing act window/tabs, create new window with 1 tab, uses same
      // size and position as main windows except for it opening on a secondary
      // monitor.
      const { width, height } = window.screen;
      const createParams = { url, left: width, width: width * 2, height };
      actionWin = await browser.windows.create(createParams);

      // Get tab from new window and store it
      const windowId = actionWin.id;
      const tabs = await browser.tabs.query({ windowId, index: 0 });
      actions.set(id, tabs[0].id!);
      return;
    }

    const existing = actions.get(id);
    if (action && !existing) {
      // Create tab if it doesn't exist
      const tab = await browser.tabs.create({ url, windowId: actionWin!.id });
      actions.set(id, tab.id!);

      // Set focus to the new window, this is to maximize the action window if
      // required.
      await browser.windows.update(tab.windowId, { focused: true });
      return;
    }

    // Skip if the client to select is already selected
    if (!action && actionWin) {
      const query = { active: true, windowId: actionWin!.id };
      const [tab] = await browser.tabs.query(query);
      const [currentClient] = getByValue(actions, tab.id)!.split(':');
      if (currentClient === client) return;
    }

    // Select tab if requested
    const select = action ? existing! : keys.length && actions.get(keys[0]);
    if (select) {
      const tab = await browser.tabs.get(select);
      const window = await browser.windows.getCurrent();

      await browser.windows.update(tab.windowId, { focused: true });
      await browser.tabs.update(tab.id, { active: true });
      await browser.windows.update(window.id!, { focused: true });
    }

    // Minimize window if switching to a client that has no active actions
    if (keys.length <= 0 && actionWin)
      await browser.windows.update(actionWin.id!, { state: 'minimized' });
  }

  async function closeProcessWindow(id: string, rest: any) {
    const [client, action] = id.split(':');

    if (!action) {
      // Remove all the client's tabs
      const keys = [...actions.keys()].filter(k => k.startsWith(client + ':'));
      const ids = keys.map(key => actions.get(key)!);

      keys.forEach(key => actionData.set(key, rest));
      await Promise.all(ids.map(id => browser.tabs.remove(id)));
    } else {
      // Remove one tab
      const tabId = actions.get(id);
      actionData.set(id, rest);
      if (tabId) await browser.tabs.remove(tabId);
    }
  }

  // Listen to messages from the content script.
  browser.runtime.onMessage.addListener((request: any) => {
    const { type, data } = request;

    switch (type) {
      case 'spe:open':
        openProcessWindow(data.url, data.id);
        break;
      case 'spe:close':
        closeProcessWindow(data.id, data.rest);
        break;
    }
  });

  // Window is closed, remove reference
  browser.windows.onRemoved.addListener(id => {
    if (actionWin && actionWin.id === id) actionWin = null;
  });

  // Tab is closed, notify webpage, and remove reference
  browser.tabs.onRemoved.addListener(id => {
    const key = getByValue(actions, id);
    if (!key) return;

    // Remove reference
    actions.delete(key);

    // Fetch and clean extra data
    const rest = actionData.get(key);
    actionData.delete(key);

    if (mainTab && mainTab.id != undefined) {
      // Notify content script
      browser.tabs.sendMessage(mainTab.id, {
        type: 'spe:closed',
        data: { id: key, ...rest }
      });
    }
  });

  browser.tabs.onActivated.addListener(event => {
    const key = getByValue(actions, event.tabId);
    if (!key || !mainTab || mainTab.id == undefined) return;

    // Notify content script
    const [actionId, taskId] = key.split(':');
    browser.tabs.sendMessage(mainTab.id, {
      type: 'spe:select',
      data: { actionId, taskId }
    });
  });

  browser.windows.onFocusChanged.addListener(async windowId => {
    if (!actionWin || actionWin.id !== windowId) return;

    const [tab] = await browser.tabs.query({ active: true, windowId });
    const key = tab && getByValue(actions, tab.id);
    if (!key || !mainTab || mainTab.id == undefined) return;

    // Notify content script
    const [actionId, taskId] = key.split(':');
    browser.tabs.sendMessage(mainTab.id, {
      type: 'spe:select',
      data: { actionId, taskId }
    });
  });
};

function getByValue<T = any>(map: Map<string, T>, value: T) {
  const entries = [...map.entries()];
  const index = entries.findIndex(([_, v]) => v === value);
  return index >= 0 ? entries[index][0] : undefined;
}
