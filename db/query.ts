/* eslint-disable @typescript-eslint/no-explicit-any -- This adapter deliberately preserves the dynamic row shape of the retired Drizzle API while routes migrate unchanged. */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Column } from "./table";

type RuntimeTable = {
  readonly __meta: {
    readonly name: string;
    readonly columns: Record<string, Column>;
    readonly columnOptions?: Record<string, { primaryKey: boolean }>;
  };
};

type Primitive = string | number | boolean | null;

export type Condition =
  | { kind: "eq"; column: Column; value: Primitive }
  | { kind: "ne"; column: Column; value: Primitive }
  | { kind: "in"; column: Column; values: Primitive[] }
  | { kind: "and"; conditions: Condition[] }
  | { kind: "or"; conditions: Condition[] };

type Order = { column: Column; ascending: boolean };
type Selection = Record<string, Column> | undefined;

export function eq(column: Column, value: Primitive): Condition {
  return { kind: "eq", column, value };
}

export function ne(column: Column, value: Primitive): Condition {
  return { kind: "ne", column, value };
}

export function inArray(column: Column, values: Primitive[]): Condition {
  return { kind: "in", column, values };
}

export function and(...conditions: Condition[]): Condition {
  return { kind: "and", conditions };
}

export function or(...conditions: Condition[]): Condition {
  return { kind: "or", conditions };
}

export function asc(column: Column): Order {
  return { column, ascending: true };
}

export function desc(column: Column): Order {
  return { column, ascending: false };
}

export function sql(
  strings: TemplateStringsArray,
  ...values: unknown[]
) {
  return { kind: "sql", strings: [...strings], values } as const;
}

export class SupabaseDatabase {
  constructor(private readonly client: SupabaseClient) {}

  select(selection?: Selection) {
    return {
      from: (table: RuntimeTable) =>
        new SelectQuery(this.client, table, selection),
    };
  }

  insert(table: RuntimeTable) {
    return new InsertQuery(this.client, table);
  }

  update(table: RuntimeTable) {
    return new UpdateQuery(this.client, table);
  }

  delete(table: RuntimeTable) {
    return new DeleteQuery(this.client, table);
  }
}

class SelectQuery implements PromiseLike<any[]> {
  private condition?: Condition;
  private orders: Order[] = [];
  private rowLimit?: number;

  constructor(
    private readonly client: SupabaseClient,
    private readonly table: RuntimeTable,
    private readonly selection?: Selection,
  ) {}

  where(condition: Condition) {
    this.condition = condition;
    return this;
  }

  orderBy(...orders: Array<Order | Column>) {
    this.orders.push(
      ...orders.map((order) =>
        "ascending" in order ? order : { column: order, ascending: true },
      ),
    );
    return this;
  }

  limit(value: number) {
    this.rowLimit = value;
    return this;
  }

  then<TResult1 = any[], TResult2 = never>(
    onfulfilled?:
      | ((value: any[]) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute() {
    const select = selectionString(this.selection);
    const primaryKey = Object.entries(this.table.__meta.columnOptions ?? {}).find(([, options]) => options.primaryKey)?.[0];
    const stableColumn = primaryKey ? this.table.__meta.columns[primaryKey] : this.table.__meta.columns.id;
    const orders = [...this.orders];
    if (stableColumn && !orders.some((order) => order.column.name === stableColumn.name)) orders.push({ column: stableColumn, ascending: true });
    const rows: any[] = [];
    const pageSize = 500;
    for (let offset = 0; this.rowLimit === undefined || offset < this.rowLimit;) {
      const size = Math.min(pageSize, this.rowLimit === undefined ? pageSize : this.rowLimit - offset);
      let query = this.client.from(this.table.__meta.name).select(select);
      query = applyCondition(query, this.condition);
      for (const order of orders) query = query.order(order.column.name, { ascending: order.ascending });
      const { data, error } = await query.range(offset, offset + size - 1);
      if (error) throw new Error(error.message);
      const page = data ?? [];
      rows.push(...page.map((row) => fromDatabaseRow(this.table, row as unknown as Record<string, unknown>, this.selection)));
      if (page.length < size) break;
      offset += page.length;
    }
    return rows;
  }
}

class InsertQuery implements PromiseLike<void> {
  private rows: Record<string, unknown>[] = [];
  private conflict?: {
    columns: Column[];
    set?: Record<string, unknown>;
    ignoreDuplicates: boolean;
  };

  constructor(
    private readonly client: SupabaseClient,
    private readonly table: RuntimeTable,
  ) {}

  values(value: Record<string, unknown> | Record<string, unknown>[]) {
    this.rows = Array.isArray(value) ? value : [value];
    return this;
  }

  onConflictDoUpdate(options: {
    target: Column | Column[];
    set: Record<string, unknown>;
  }) {
    this.conflict = {
      columns: Array.isArray(options.target) ? options.target : [options.target],
      set: options.set,
      ignoreDuplicates: false,
    };
    return this;
  }

  onConflictDoNothing(options: { target: Column | Column[] }) {
    this.conflict = {
      columns: Array.isArray(options.target) ? options.target : [options.target],
      ignoreDuplicates: true,
    };
    return this;
  }

  then<TResult1 = void, TResult2 = never>(
    onfulfilled?: ((value: void) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute() {
    const rows = this.rows.map((row) => toDatabaseRow(this.table, row));
    if (!this.conflict) {
      const result = await this.client.from(this.table.__meta.name).insert(rows);
      if (result.error) throw new Error(result.error.message);
      return;
    }

    for (const row of rows) {
      const match = (query: any) => {
        for (const column of this.conflict!.columns) {
          const value = row[column.name];
          query = value === null ? query.is(column.name, null) : query.eq(column.name, value as Primitive);
        }
        return query;
      };
      const find = () => match(this.client.from(this.table.__meta.name).select("*").limit(1));
      const update = async () => {
        if (this.conflict!.ignoreDuplicates) return;
        const result = await match(this.client.from(this.table.__meta.name).update(toDatabaseRow(this.table, this.conflict!.set ?? {})));
        if (result.error) throw new Error(result.error.message);
      };
      const existing = await find();
      if (existing.error) throw new Error(existing.error.message);
      if (existing.data?.length) {
        await update();
        continue;
      }
      const inserted = await this.client.from(this.table.__meta.name).insert(row);
      if (!inserted.error) continue;
      // A concurrent request may have inserted the same natural key after our
      // lookup. Re-read that exact key; unrelated unique violations still fail.
      if (inserted.error.code === "23505") {
        const concurrent = await find();
        if (concurrent.error) throw new Error(concurrent.error.message);
        if (concurrent.data?.length) {
          await update();
          continue;
        }
      }
      throw new Error(inserted.error.message);
    }
  }
}

class UpdateQuery implements PromiseLike<void> {
  private values: Record<string, unknown> = {};
  private condition?: Condition;

  constructor(
    private readonly client: SupabaseClient,
    private readonly table: RuntimeTable,
  ) {}

  set(values: Record<string, unknown>) {
    this.values = values;
    return this;
  }

  where(condition: Condition) {
    this.condition = condition;
    return this;
  }

  then<TResult1 = void, TResult2 = never>(
    onfulfilled?: ((value: void) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute() {
    let query = this.client
      .from(this.table.__meta.name)
      .update(toDatabaseRow(this.table, this.values));
    query = applyCondition(query, this.condition);
    const { error } = await query;
    if (error) throw new Error(error.message);
  }
}

class DeleteQuery implements PromiseLike<void> {
  private condition?: Condition;

  constructor(
    private readonly client: SupabaseClient,
    private readonly table: RuntimeTable,
  ) {}

  where(condition: Condition) {
    this.condition = condition;
    return this;
  }

  then<TResult1 = void, TResult2 = never>(
    onfulfilled?: ((value: void) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute() {
    let query = this.client.from(this.table.__meta.name).delete();
    query = applyCondition(query, this.condition);
    const { error } = await query;
    if (error) throw new Error(error.message);
  }
}

function selectionString(selection?: Selection) {
  if (!selection) return "*";
  return Object.entries(selection)
    .map(([alias, column]) => (alias === column.name ? column.name : `${alias}:${column.name}`))
    .join(",");
}

function fromDatabaseRow(
  table: RuntimeTable,
  row: Record<string, unknown>,
  selection?: Selection,
) {
  if (selection) return row;
  return Object.fromEntries(
    Object.entries(table.__meta.columns).map(([key, column]) => [key, row[column.name]]),
  );
}

function toDatabaseRow(table: RuntimeTable, row: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [table.__meta.columns[key]?.name ?? key, value]),
  );
}

function applyCondition<TQuery>(query: TQuery, condition?: Condition): TQuery {
  if (!condition) return query;
  const target = query as TQuery & {
    eq(column: string, value: Primitive): TQuery;
    neq(column: string, value: Primitive): TQuery;
    in(column: string, values: Primitive[]): TQuery;
    or(filters: string): TQuery;
  };
  if (condition.kind === "eq") return target.eq(condition.column.name, condition.value);
  if (condition.kind === "ne") return target.neq(condition.column.name, condition.value);
  if (condition.kind === "in") return target.in(condition.column.name, condition.values);
  if (condition.kind === "and") {
    return condition.conditions.reduce((next, item) => applyCondition(next, item), query);
  }
  return target.or(condition.conditions.map(postgrestCondition).join(","));
}

function postgrestCondition(condition: Condition): string {
  if (condition.kind === "eq" || condition.kind === "ne") {
    const operator = condition.kind === "eq" ? "eq" : "neq";
    return `${condition.column.name}.${operator}.${postgrestValue(condition.value)}`;
  }
  if (condition.kind === "in") {
    return `${condition.column.name}.in.(${condition.values.map(postgrestValue).join(",")})`;
  }
  const operator = condition.kind;
  return `${operator}(${condition.conditions.map(postgrestCondition).join(",")})`;
}

function postgrestValue(value: Primitive) {
  if (value === null) return "null";
  if (typeof value !== "string") return String(value);
  return `\"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}\"`;
}
