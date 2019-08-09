import browser from 'webextension-polyfill';

import { ActionWindow } from './models/action-window';
import { Action } from './models/action';
import { Customer } from './models/customer';
import { TabMap } from './utils/tab-map';
import manifest from '../manifest.json';

window.onload = function main() {
  // Keep track of all important tabs, exposed on the window object for
  // debugging purposes.
  const tabs = new TabMap();
  (window as any).tabs = tabs;

  /**
   * Listen to URL changes. When manually navigating to a customer or action
   * page we need to register the tab.
   */
  browser.tabs.onUpdated.addListener(async (tid, info) => {
    // Check whether the tab update occurred on one of the predefined pages.
    const matches = manifest.content_scripts[0].matches.map(match => {
      const adjusted = match.replace('.', '\\.').replace('*', '.*');
      return new RegExp(adjusted);
    });
    if (!info.url || !matches.some(regex => info.url!.match(regex))) return;

    // Parse URL
    const { pathname, searchParams } = new URL(info.url);
    const cid = searchParams.get('CustomerId');
    const aid = searchParams.get('ActionId');

    // Customer screen
    const cOptions = [
      '/CustomerScreenEntry.aspx',
      '/sante-cs-tabs-test/client'
    ];
    if (cid && startsWith(pathname, cOptions)) {
      const customer = new Customer(cid, tid);
      tabs.set(customer.id, customer.tab, customer);
    }

    // Action screen
    const aOptions = [
      '/CustomerService/ActionScreen.aspx',
      '/sante-cs-tabs-test/action'
    ];
    if (cid && aid && startsWith(pathname, aOptions)) {
      const customer = tabs.getCustomer(cid);
      if (!customer) return;

      // Retrieve corresponding window id
      const wid = await browser.tabs.get(tid).then(t => t.windowId);

      const action = customer.register(aid, wid, tid);
      tabs.set(action.id, action.tab, action);
    }
  });

  /**
   * Forward focus events to ensure that the customer and action window are in
   * sync.
   */
  browser.tabs.onActivated.addListener(info => {
    const tab = tabs.get(info.tabId);
    if (!tab) return;

    tab.focus();

    // Notify content script
    if (tab instanceof Action) {
      const actionId = tab.customer.id;
      const taskId = tab.id;

      browser.tabs.sendMessage(tab.customer.tab, {
        type: 'spe:select',
        data: { actionId, taskId }
      });
    }
  });

  /**
   * Forward focus events to ensure that the customer and action window are in
   * sync.
   */
  browser.windows.onFocusChanged.addListener(async wid => {
    if (wid < 0) return;

    const customer = await browser.tabs
      .query({ active: true, windowId: wid })
      .then(results => results[0] && tabs.getCustomer(results[0].id!));
    if (customer) customer.focus();
  });

  /**
   * Deregister a tab when it is removed/closed.
   */
  browser.tabs.onRemoved.addListener(async tid => {
    if (!tabs.has(tid)) return;

    // Action closed
    const action = tabs.getAction(tid);
    if (action && action.customer) action.customer.deregister(action.tab);

    // Customer closed
    const customer = tabs.getCustomer(tid);
    if (customer) {
      for (const action of customer.actions) await action.close();
    }

    // Remove tab reference in any case
    tabs.delete(tid);

    // Check if action window is still in sync
    if (action) {
      const currentTab = await ActionWindow.getCurrent().then(c => c && c.id);
      const currentAction = tabs.getAction(currentTab || -1);

      // Focus switched to action of other customer, should minimize the action
      // window.
      if (currentAction && currentAction.customer.id !== action.customer.id)
        await ActionWindow.minimize();

      // Notify content script
      const id = `${action.customer.id}:${action.id}`;
      browser.tabs.sendMessage(action.customer.tab, {
        type: 'spe:closed',
        data: { ...action.metadata, id }
      });
    }
  });

  /**
   * Deregister action window when it is closed.
   */
  browser.windows.onRemoved.addListener(wid => {
    // Action window is closed, remove reference
    if (ActionWindow.id === wid) ActionWindow.clear();
  });

  /**
   * Listen to messages from the content script.
   */
  browser.runtime.onMessage.addListener((request: any) => {
    const { type, data } = request;

    switch (type) {
      case 'spe:open': {
        // No id provided, open external url on action window
        if (!data.id) {
          ActionWindow.open(data.url);
          break;
        }

        // Parse id and open action
        const { cid, aid } = parseId(data.id);
        const customer = tabs.getCustomer(cid);
        if (customer) customer.open(data.url, aid);

        break;
      }
      case 'spe:close': {
        const { cid, aid } = parseId(data.id);

        // Close the customer / action
        const customer = tabs.getCustomer(cid);
        const action = aid ? tabs.getAction(aid) : undefined;
        if (customer) customer.close(action && action.tab, data.rest);

        break;
      }
      case 'spe:ping': {
        break;
      }
    }
  });
};

const startsWith = (text: string, options: string[]) => {
  return options.some(option => text.startsWith(option));
};

const parseId = (id: string): { cid: string; aid?: string } => {
  const [cid, aid] = id.split(':');
  return { cid, aid };
};
