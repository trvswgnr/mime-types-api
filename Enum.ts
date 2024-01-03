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

const x = Match(dtype as DataTypes, {
    SERIAL: () => 1,
    VARCHAR: (x) => Number(x),
    TEXT: () => 3,
    BOOLEAN: () => 4,
    INTEGER: () => 5,
    DECIMAL: () => 6,
    // _: () => 6,
});

type Cases<T extends PropertyKey, R, C> = NoParensInKeys<{
    [key in T]: (C)[keyof C] extends (arg: string) => any
        ? (arg: string) => any
        : () => C;
}>
export function Match<T extends PropertyKey, R, C>(
    value: T,
    cases: Cases<T, R, C>
        // | (Partial<
        //       NoParensInKeys<{
        //           [key in T]: (typeof cases)[keyof typeof cases] extends (arg: string) => infer B
        //               ? (arg: string) => B
        //               : () => C;
        //       }>
        //   > & { _: () => R })
): R {
    const fn = (cases as any)[value];
    // if ("_" in cases) {
    //     return fn ? fn() : cases._();
    // }
    if (fn) {
        return fn();
    }
    throw new Error(`Match failed for value ${String(value)}`);
}

type NoParensInKeys<T> = {
    [key in keyof T as key extends `${infer U}(${infer _}` ? U : key]: T[key];
};
