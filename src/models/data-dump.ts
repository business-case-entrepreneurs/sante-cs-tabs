export type DataDump = CustomerDump[];

export type CustomerDump = {
  readonly id: string;
  readonly tab: number;
  readonly actions: ActionDump[];
};

export type ActionDump = {
  readonly id: string;
  readonly window: number;
  readonly tab: number;
};
