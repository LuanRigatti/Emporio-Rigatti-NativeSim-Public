export type DatedItem = {
  date: string;
};

export type DatedItemGroup<T extends DatedItem> = {
  date: string;
  items: T[];
};

export function groupItemsByDate<T extends DatedItem>(items: readonly T[]): DatedItemGroup<T>[] {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const group = groups.get(item.date);
    if (group) {
      group.push(item);
    } else {
      groups.set(item.date, [item]);
    }
  }

  return Array.from(groups, ([date, groupedItems]) => ({ date, items: groupedItems }));
}

export function formatDateAsDayMonthYear(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}
