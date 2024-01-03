import { neon } from "@neondatabase/serverless";
import type { FieldDef } from "@vercel/postgres";

if (!process.env.POSTGRES_URL) {
    throw new Error("POSTGRES_URL environment variable not set");
}
export const sql = neon(process.env.POSTGRES_URL, {
    fullResults: true,
}) as unknown as SQLFn;

export async function createTable(name: string, columns: Columns) {
    let columnDefinitions = Object.entries(columns).map(([columnName, column]) => {
        if ("key" in column) {
            return `${columnName} ${column.type} PRIMARY KEY`;
        }
        const unique = column.unique ? "UNIQUE" : "";
        const references = column.ref ? `REFERENCES ${column.ref.table}(${column.ref.column})` : "";
        if (column.required) {
            return `${columnName} ${column.type} NOT NULL ${unique} ${references}`;
        }
        const defaultValue = column.default ? `DEFAULT ${column.default}` : "";
        return `${columnName} ${column.type} ${unique} ${references} ${defaultValue}`;
    });
    columnDefinitions = columnDefinitions.map(
        (definition) => `    ${definition.split(/\s+/).join(" ").trim()}`
    );
    const q = `CREATE TABLE ${name} (\n${columnDefinitions.join(",\n")}\n);`;
    return await sql(`${q}`);
}

export const ColumnType = {
    SERIAL: "SERIAL",
    VARCHAR: (x: number) => `VARCHAR(${x})` as const,
    TEXT: "TEXT",
    BOOLEAN: "BOOLEAN",
    INTEGER: "INTEGER",
    DECIMAL: "DECIMAL",
} as const;

export type Column =
    | {
          key: true;
          type: ColumnType;
      }
    | {
          required: true;
          type: ColumnType;
          unique: boolean;
          ref?: {
              table: string;
              column: string;
          };
      }
    | {
          required: false;
          default: "FALSE" | "TRUE" | number | (string & {}) | null;
          type: ColumnType;
          unique: boolean;
          ref?: {
              table: string;
              column: string;
          };
      };

export type Columns = {
    [name: string]: Column;
};

export type ColumnType = {
    [key in keyof typeof ColumnType]: (typeof ColumnType)[key] extends (...args: any[]) => any
        ? ReturnType<(typeof ColumnType)[key]>
        : (typeof ColumnType)[key];
}[keyof typeof ColumnType];

export interface QueryResults<T> {
    fields: FieldDef[];
    command: string;
    rowCount: number;
    rows: T[];
    rowAsArray: boolean;
}

export type SQLFn = {
    <T>(str: string, values?: any[]): Promise<QueryResults<T>>;
    <T>(strings: TemplateStringsArray, ...values: any[]): Promise<QueryResults<T>>;
};
