import { type Columns, ColumnType } from "../orm";

export const MimeTypeTable = Schema({
    id: {
        key: true,
        type: ColumnType.SERIAL,
    },
    name: {
        required: true,
        type: ColumnType.VARCHAR(500),
        unique: true,
    },
    description: {
        required: true,
        type: ColumnType.TEXT,
        unique: false,
    },
    deprecated: {
        required: false,
        default: "FALSE",
        type: ColumnType.BOOLEAN,
        unique: false,
    },
    use_instead: {
        required: false,
        default: null,
        type: ColumnType.VARCHAR(500),
        unique: false,
    },
});

export function Schema<const T extends Columns>(schema: T): T {
    return schema;
}

export type InferRowsFromSchema<T> = {
    [key in keyof T]: T[key] extends { type: infer U }
        ? U extends string
            ? UntilParen<U> extends keyof TypeMap
                ? TypeMap[UntilParen<U>]
                : never
            : never
        : never;
};

type TypeMap = {
    SERIAL: number;
    VARCHAR: string;
    TEXT: string;
    BOOLEAN: boolean;
    INTEGER: number;
    DECIMAL: number;
};

export type MimeTypeSchema = InferRowsFromSchema<typeof MimeTypeTable>;

// matches until parenthesis
type UntilParen<T extends string> = T extends `${infer U}(` ? U : T;
