export type CurrentStock = { ClosingQty1: number; ClosingQty2: number };

const quantity = (value: number) =>
  Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

export const formatStock = (qty1: number, qty2: number) =>
  Number(qty2) === 0
    ? quantity(qty1)
    : `${quantity(qty1)}+${quantity(qty2)}`;

export const stockDate = (value: string | null, monthOnly = false) => {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  return monthOnly ? `${match[2]}/${match[1].slice(-2)}` : `${match[3]}/${match[2]}/${match[1]}`;
};
