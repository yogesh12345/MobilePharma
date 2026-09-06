export interface AutoCompleteItem {
  id: number | string;
  label1: string;
  label2?: string;
  label3?: string;
  label4?: string;
  label5?: string;
}

export interface ItemDetails {
  id: number;
  ItCode?: string;
  ItemName: string;
  Packing: string;
  BoxPack: string;
  CompName: string;
  CompShort: string;
  RackNumber: string;
  vCompanyID?: number;
}
