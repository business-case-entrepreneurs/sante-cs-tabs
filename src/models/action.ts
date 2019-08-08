import browser from 'webextension-polyfill';

import { Customer } from './customer';

export class Action {
  public readonly id: string;
  public readonly customer: Customer;
  public readonly window: number;
  public readonly tab: number;
  public metadata?: any;

  constructor(id: string, customer: Customer, wid: number, tid: number) {
    this.id = id;
    this.customer = customer;
    this.window = wid;
    this.tab = tid;
  }

  public async focus() {
    await browser.tabs.update(this.customer.tab, { active: true });
    await browser.tabs.update(this.tab, { active: true });
  }

  public close(metadata?: any) {
    this.metadata = metadata;
    return browser.tabs.remove(this.tab);
  }
}
