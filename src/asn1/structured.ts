import { eqType, isType, isValue, Type, Value } from 'asn1';
import { isObject } from 'utility';

export const SEQUENCE = <S extends string, T extends Record<S, Type | { OPTIONAL: Type }>>(
  s: T,
  order: S[]
) => ({ SEQUENCE: s, order });
type SEQUENCEType<S extends string = string> = {
  SEQUENCE: Record<S, Type | { OPTIONAL: Type }>;
  order: S[];
};

type FilteredKey<T, U> = { [P in keyof T]: T[P] extends U ? P : never }[keyof T];

type SEQUENCEValue<S extends SEQUENCEType['SEQUENCE']> = FilteredKey<
  S,
  { OPTIONAL: Type }
> extends never
  ? FilteredKey<S, Type> extends never
    ? { [P in keyof S]: Value }
    : { [P in FilteredKey<S, Type>]: S[P] extends Type ? Value<S[P]> : never }
  : { [P in FilteredKey<S, Type>]: S[P] extends Type ? Value<S[P]> : never } & {
      [P in FilteredKey<S, { OPTIONAL: Type }>]?: S[P] extends { OPTIONAL: Type }
        ? Value<S[P]['OPTIONAL']>
        : never;
    };

export const SEQUENCEOF = <T extends Type>(s: T) => ({ SEQUENCEOF: s });
type SEQUENCEOFType = { SEQUENCEOF: Type };
type SEQUENCEOFValue<T extends Type> = Value<T>[];

export const SETOF = <T extends Type>(s: T) => ({ SETOF: s });
type SETOFType = { SETOF: Type };
type SETOFValue<T extends Type> = Set<Value<T>>;

/**
 * Structured type は構成要素を持つ型で、ASN.1 では４つ定義されている
 * - SEQUENCE: 一つ以上の type の順序付きコレクション
 */
export type StructuredType = SEQUENCEType | SEQUENCEOFType | SETOFType;

export function isStructuredType(arg: unknown): arg is StructuredType {
  if (isObject<SEQUENCEType>(arg) && 'SEQUENCE' in arg) {
    return (
      Array.isArray(arg.order) &&
      arg.order.every((k) => typeof k === 'string') &&
      isObject<SEQUENCEType['SEQUENCE']>(arg.SEQUENCE) &&
      Object.entries(arg.SEQUENCE).every(
        ([k, v]) =>
          (arg.order as string[]).includes(k) &&
          ((isObject<{ OPTIONAL: unknown }>(v) && 'OPTIONAL' in v && isType(v.OPTIONAL)) ||
            isType(v))
      )
    );
  }
  if (isObject<SEQUENCEOFType>(arg) && 'SEQUENCEOF' in arg) {
    return isType(arg.SEQUENCEOF);
  }
  if (isObject<SETOFType>(arg) && 'SETOF' in arg) {
    return isType(arg.SETOF);
  }
  return false;
}

export function checkStructuredType<N extends StructuredTypeName>(
  t: Type,
  n?: N
): t is StructuredTypeFromName<N> {
  if (n == null)
    return typeof t === 'object' && ('SEQUENCE' in t || 'SEQUENCEOF' in t || 'SETOF' in t);
  return typeof t === 'object' && n in t;
}

export function eqStructuredType(l?: StructuredType, r?: StructuredType): boolean {
  if (l == null && r == null) return true;
  if (l == null || r == null) return false;
  if ('SEQUENCE' in l) {
    return (
      'SEQUENCE' in r &&
      new Set(l.order).size === new Set(r.order).size &&
      l.order.every((li) => {
        const lv = l.SEQUENCE[li];
        const rv = l.SEQUENCE[li];
        return (
          r.order.includes(li) &&
          eqType(
            isObject(lv) && 'OPTIONAL' in lv ? lv.OPTIONAL : lv,
            isObject(rv) && 'OPTIONAL' in rv ? rv.OPTIONAL : rv
          )
        );
      })
    );
  }
  if ('SEQUENCEOF' in l) {
    return 'SEQUENCEOF' in r && eqType(l.SEQUENCEOF, r.SEQUENCEOF);
  }
  if ('SETOF' in l) {
    return 'SETOF' in r && eqType(l.SETOF, r.SETOF);
  }
  return false;
}

export type StructuredTypeName = 'SEQUENCE' | 'SEQUENCEOF' | 'SETOF';

export const isStructuredTypeName = (arg: unknown): arg is StructuredTypeName =>
  ['SEQUENCE', 'SEQUENCEOF', 'SETOF'].some((x) => x === arg);

export type StructuredTypeFromName<N extends StructuredTypeName> = N extends 'SEQUENCE'
  ? SEQUENCEType
  : N extends 'SEQUENCEOF'
  ? SEQUENCEOFType
  : N extends 'SETOF'
  ? SETOFType
  : never;
export const StructuredNameFromType = (t: StructuredType): StructuredTypeName => {
  if ('SEQUENCE' in t) return 'SEQUENCE';
  if ('SEQUENCEOF' in t) return 'SEQUENCEOF';
  if ('SETOF' in t) return 'SETOF';
  throw new TypeError('Unexpected Flow');
};

export type StructuredValue<T extends StructuredType> = T extends SEQUENCEOFType
  ? SEQUENCEOFValue<T['SEQUENCEOF']>
  : T extends SETOFType
  ? SETOFValue<T['SETOF']>
  : T extends SEQUENCEType
  ? SEQUENCEValue<T['SEQUENCE']>
  : never;

export function isStructuredValue<T extends StructuredType>(
  arg: unknown,
  t: T
): arg is StructuredValue<T> {
  if ('SEQUENCE' in t) {
    return (
      isObject(arg) &&
      Object.entries(arg).every(([k, v]) => {
        if (!t.order.includes(k)) return false;
        const componentType = t.SEQUENCE[k];
        if (componentType == null) return false;
        if (isObject(componentType) && 'OPTIONAL' in componentType) {
          return isValue(v, componentType.OPTIONAL);
        }
        return isValue(v, componentType);
      })
    );
  }
  if ('SEQUENCEOF' in t) {
    return Array.isArray(arg) && arg.every((v) => isValue(v, t.SEQUENCEOF));
  }
  if ('SETOF' in t) {
    return arg instanceof Set && [...arg].every((v) => isValue(v, t.SETOF));
  }
  return false;
}

// export function checkStructuredValue<N extends StructuredTypeName>(v: StructuredValue, n?: N): v is StructuredValue<StructuredTypeFromName<N>> {
//   if (n == null) {
//     return
//   }

// }
