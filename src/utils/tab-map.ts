import { Action } from '../models/action';
import { Customer } from '../models/customer';
import { DataDump, ActionDump } from '../models/data-dump';

type Key = string | number;
type Value = Customer | Action;

export class TabMap {
  private _data = new Map<Key, Value>();

  public get keys() {
    const keys = Array.from(this._data.keys());
    return keys.filter(key => typeof key === 'number') as number[];
  }

  public get actions() {
    return this.keys
      .map(k => this._data.get(k)!)
      .filter(v => v instanceof Action) as Action[];
  }

  public get customers() {
    return this.keys
      .map(k => this._data.get(k)!)
      .filter(v => v instanceof Customer) as Customer[];
  }

  public get(key: Key) {
    return this._data.get(key);
  }

  public getAction(key: Key): Action | undefined {
    const value = this.get(key);
    return value instanceof Action ? value : undefined;
  }

  public getCustomer(key: Key): Customer | undefined {
    const value = this.get(key);
    return value instanceof Customer ? value : undefined;
  }

  public set(id: string, tid: number, value: Value) {
    this._data.set(id, value);
    this._data.set(tid, value);
    console.log('[tab-created]', value);
  }

  public delete(key: Key) {
    const value = this._data.get(key);
    if (!value) return;

    this._data.delete(value.id);
    this._data.delete(value.tab);
    console.log('[tab-deleted]', value);
  }

  public has(key: Key): boolean {
    return this._data.has(key);
  }

  public dump() {
    const data: DataDump = [];

    for (const customer of this.customers) {
      const actions: ActionDump[] = customer.actions.map(a => ({
        id: a.id,
        window: a.window,
        tab: a.tab
      }));

      data.push({
        id: customer.id,
        tab: customer.tab,
        actions
      });
    }

    for (const customer of data) {
      console.groupCollapsed('Customer ' + customer.id);
      console.log('tab', customer.tab);

      for (const action of customer.actions) {
        const { id, window, tab } = action;
        console.log(`action[${id}]`, 'window', window, 'tab', tab);
      }

      console.groupEnd();
    }

    return data;
  }
}
