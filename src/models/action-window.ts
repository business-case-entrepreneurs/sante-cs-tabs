import browser from 'webextension-polyfill';

export class ActionWindow {
  private static _window?: browser.windows.Window;

  public static get id() {
    return this._window && this._window.id;
  }

  public static async getCurrent(): Promise<browser.tabs.Tab | undefined> {
    if (!this.id) return undefined;

    return browser.tabs
      .query({ active: true, windowId: ActionWindow.id })
      .then(results => results[0]);
  }

  public static async minimize() {
    if (!this.id) return;
    await new Promise(r => setTimeout(r, 200));
    await browser.windows.update(this.id, { state: 'minimized' });
  }

  public static async open(url: string) {
    // Create tab in existing action window
    if (this._window) {
      const tab = await browser.tabs.create({ url, windowId: this._window.id });
      await browser.windows.update(tab.windowId, { focused: true });
      return tab;
    }

    // Creates an window with the same size and position as the main window
    // except for it opening on the secondary monitor. Opens 1 tab if an url is
    // specified.
    const { width, height } = window.screen;
    const createOptions = { url, left: width, width: width * 2, height };
    this._window = await browser.windows.create(createOptions);
    await browser.windows.update(this._window.id!, { state: 'maximized' });

    // Query the new window for tab information
    return browser.tabs
      .query({ windowId: this._window.id })
      .then(tabs => tabs[0]);
  }

  public static clear() {
    this._window = undefined;
  }
}
