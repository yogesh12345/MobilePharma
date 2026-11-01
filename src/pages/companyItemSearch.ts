type SearchableCompanyItem = { ItemName: string; Packing: string };

export function searchCompanyItems<T extends SearchableCompanyItem>(items: T[], query: string): T[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return items;

  return items.filter((item) => {
    const text = `${item.ItemName} ${item.Packing}`.toLocaleLowerCase();
    return terms.every((term) => text.includes(term));
  });
}
