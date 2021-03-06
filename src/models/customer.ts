import browser from 'webextension-polyfill';

import { TabMap } from '../utils/tab-map';
import { Action } from './action';
import { ActionWindow } from './action-window';

export class Customer {
  public readonly id: string;
  public readonly tab: number;
  public readonly tabs: TabMap;

  private readonly _actions = new Map<number, Action>();

  public get actions() {
    return Array.from(this._actions.values());
  }

  constructor(id: string, tid: number, tabs: TabMap) {
    this.id = id;
    this.tab = tid;
    this.tabs = tabs;
  }

  /**
   * Register action for this customer.
   * @param aid Action id
   * @param wid Window id
   * @param tid Tab id
   */
  public register(aid: string, wid: number, tid: number) {
    const action = new Action(aid, this, wid, tid);
    this._actions.set(tid, action);
    return action;
  }

  /**
   * Deregister action of this customer.
   * @param tid Tab id
   */
  public deregister(tid: number) {
    const action = this._actions.get(tid);
    if (action) this._actions.delete(action.tab);
  }

  /**
   * Closes the customer tab and all of its actions. When the tab id of an
   * action is provided only that tab will be closed.
   * @param tid Tab id
   * @param metadata Extra data passed to close event
   */
  public close(tid?: number, metadata?: any) {
    const action = tid && this._actions.get(tid);
    if (action) return action.close(metadata);

    const tabs = this.actions.map(action => {
      action.metadata = metadata;
      return action.tab;
    });
    return browser.tabs.remove([...tabs, this.tab]);
  }

  /**
   * Sets focus to this customers tab and synchronizes focus with the action
   * window.
   */
  public async focus() {
    // No action window, no need to switch focus
    if (!ActionWindow.id) return;

    const current = (await ActionWindow.getCurrent())!;
    const action = this.tabs.getAction(current.id!);

    // Current tab is not an action tab, no need to switch
    if (!action) return;

    // This customer has no open actions, minimize the action window
    if (!this._actions.size) return ActionWindow.minimize();

    // At this point we know this customer has open actions, set focus to the
    // action window to ensure it isn't minimized.
    const minimized = await browser.windows
      .get(ActionWindow.id)
      .then(window => window.state === 'minimized');

    if (minimized)
      await browser.windows.update(ActionWindow.id, { focused: true });

    // Current active action does not belong to this customer, switch focus to
    // the first available action which does belong to this customer.
    if (action.customer.id !== this.id) {
      const aid = Array.from(this._actions.keys())[0];
      if (aid) await browser.tabs.update(aid, { active: true });
    }

    // Return focus to customer tab
    await browser.tabs.update(this.tab, { active: true });
  }

  /**
   * Opens the provided url in the action window. When no url or action is
   * provided focus will be set to this customer.
   * @param url The url to open
   * @param aid The action id
   */
  public async open(url?: string, aid?: string) {
    // Only requested to open this customer, set focus to it.
    if (!url || !aid) {
      await browser.tabs.update(this.tab, { active: true });
      return;
    }

    // Tab already exists, set focus to it
    const existing = this.actions.find(a => a.id === aid);
    if (existing) {
      await browser.tabs.update(existing.tab, { active: true });
      return existing;
    }

    // Create new tab in action window
    const tab = await ActionWindow.open(url);
    const action = this.register(aid, tab.windowId, tab.id!);
    await action.focus();
    return action;
  }
}
