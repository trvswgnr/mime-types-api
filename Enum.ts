export type Enum<T> = {
    [key in keyof T]: T[key] extends (...args: any[]) => any ? ReturnType<T[key]> : T[key];
}[keyof T];
export const Enum = <const T>(obj: T) => obj;
export function EnumVariant<const F extends (...args: any[]) => T, const T>(fn: F): F;
export function EnumVariant<const T>(arg: T): T;
export function EnumVariant(arg: unknown) {
    return arg;
}
const DataTypes = Enum({
    SERIAL: EnumVariant("SERIAL"),
    VARCHAR: EnumVariant((x: number) => `VARCHAR(${x})`),
    TEXT: EnumVariant("TEXT"),
    BOOLEAN: EnumVariant("BOOLEAN"),
    INTEGER: EnumVariant("INTEGER"),
    DECIMAL: EnumVariant("DECIMAL"),
});
type DataTypesObj = typeof DataTypes;
type DataTypes = Enum<typeof DataTypes>;
const dtype: DataTypes = Math.random() > 0.5 ? DataTypes.SERIAL : DataTypes.VARCHAR(10);

const keys = Keys(dtype);
const x = Match<Keys<DataTypes>, DataTypesObj, number>(keys, {
    SERIAL: () => 1,
    VARCHAR: (x) => Number(x),
    TEXT: () => 3,
    BOOLEAN: () => 4,
    INTEGER: () => 5,
    DECIMAL: () => 6,
});

function Keys<T extends PropertyKey>(x: T): NoParensInUnion<T> {
    return x as any;
}
type Keys<T extends PropertyKey> = NoParensInUnion<T>;

type NoParensInUnion<T> = T extends `${infer U}(${infer _}` ? U : T;
const testNoParensInUnion: NoParensInUnion<"SERIAL" | "VARCHAR(10)"> = "SERIAL";

type Cases<T extends keyof U, U, Z> = {
    [key in T]: U[key] extends (arg: infer X) => any ? (x: X) => Z : (x: U[key]) => Z;
};

type ReturnTypes<T> = {
    [key in keyof T]: T[key] extends (...args: any[]) => infer U ? U : never;
};
function Match<T extends keyof ReturnTypes<U>, const U, const Z>(
    x: T,
    cases: NoParensInKeys<Cases<T, U, Z>>
): Z {
    return (cases as any)[x](x as any);
}

type NoParensInKeys<T> = {
    [key in keyof T as key extends `${infer U}(${infer _}` ? U : key]: T[key];
};
