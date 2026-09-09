export type Column<T = unknown> = {
  readonly key: string;
  readonly name: string;
  readonly tableName: string;
  readonly value?: T;
};

type ColumnOptions = {
  primaryKey: boolean;
  notNull: boolean;
  hasDefault: boolean;
  defaultValue?: unknown;
};

export class ColumnBuilder<T = unknown> {
  declare readonly __valueType?: T;
  readonly options: ColumnOptions = {
    primaryKey: false,
    notNull: false,
    hasDefault: false,
  };

  constructor(readonly declaredName?: string) {}

  primaryKey() {
    this.options.primaryKey = true;
    this.options.notNull = true;
    return this;
  }

  notNull() {
    this.options.notNull = true;
    return this;
  }

  default(value: unknown) {
    this.options.hasDefault = true;
    this.options.defaultValue = value;
    return this;
  }
}

export type IndexDefinition = {
  readonly name: string;
  readonly unique: boolean;
  readonly columns: readonly Column[];
};

type TableMeta = {
  readonly name: string;
  readonly columns: Record<string, Column>;
  readonly columnOptions: Record<string, ColumnOptions>;
  indexes: IndexDefinition[];
};

export type TableDefinition<
  TColumns extends Record<string, ColumnBuilder> = Record<string, ColumnBuilder>,
> = {
  readonly $inferSelect: {
    [K in keyof TColumns]: TColumns[K] extends ColumnBuilder<infer TValue>
      ? TValue
      : unknown;
  };
  readonly $inferInsert: {
    [K in keyof TColumns]?: TColumns[K] extends ColumnBuilder<infer TValue>
      ? TValue
      : unknown;
  };
  readonly __meta: TableMeta;
} & {
  readonly [K in keyof TColumns]: TColumns[K] extends ColumnBuilder<infer TValue>
    ? Column<TValue>
    : Column;
};

export function text(name?: string) {
  return new ColumnBuilder<string>(name);
}

export function integer(
  name?: string,
  options?: { mode?: "boolean" | "number" },
) {
  return new ColumnBuilder<boolean | number>(name ?? options?.mode);
}

function indexBuilder(name: string, unique: boolean) {
  return {
    on(...columns: Column[]): IndexDefinition {
      return { name, unique, columns };
    },
  };
}

export function index(name: string) {
  return indexBuilder(name, false);
}

export function uniqueIndex(name: string) {
  return indexBuilder(name, true);
}

export function sqliteTable<
  TColumns extends Record<string, ColumnBuilder>,
>(
  name: string,
  builders: TColumns,
  configure?: (table: TableDefinition<TColumns>) => IndexDefinition[],
): TableDefinition<TColumns> {
  const columns: Record<string, Column> = {};
  const columnOptions: Record<string, ColumnOptions> = {};
  const table = {} as TableDefinition<TColumns>;

  for (const [key, builder] of Object.entries(builders)) {
    const column = {
      key,
      name: builder.declaredName ?? snakeCase(key),
      tableName: name,
    } as Column;
    columns[key] = column;
    columnOptions[key] = { ...builder.options };
    Object.defineProperty(table, key, {
      value: column,
      enumerable: true,
    });
  }

  const meta: TableMeta = { name, columns, columnOptions, indexes: [] };
  Object.defineProperty(table, "__meta", { value: meta });
  Object.defineProperty(table, "$inferSelect", { value: undefined });
  Object.defineProperty(table, "$inferInsert", { value: undefined });
  meta.indexes = configure?.(table) ?? [];
  return table;
}

function snakeCase(value: string) {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}
