import { Type } from 'asn1';

/**
 * Simple types は構成要素を持たない型で、ASN.1 では次のようなものが定義されている。
 */
export type SimpleType = typeof SimpleTypeList[number];

const SimpleTypeList = [
  'BOOLEAN',
  'INTEGER',
  'BIT STRING',
  'OCTET STRING',
  'NULL',
  'OBJECT IDENTIFIER',
  'UTCTime',
] as const;

export const isSimpleType = (arg: unknown): arg is SimpleType =>
  SimpleTypeList.some((t) => arg === t);

export const checkSimpleType = <N extends SimpleTypeName>(
  t: Type,
  n?: N
): t is SimpleTypeFromName<N> => {
  if (n == null) return isSimpleType(t);
  return t === n;
};
export type SimpleTypeName = SimpleType;

export type SimpleTypeFromName<N extends SimpleTypeName> = N extends SimpleTypeName ? N : never;

export const isSimpleTypeName = isSimpleType;

export type SimpleValue<T extends SimpleType = SimpleType> = T extends 'INTEGER'
  ? bigint
  : T extends 'BIT STRING'
  ? Uint8Array
  : T extends 'NULL'
  ? undefined
  : T extends 'OBJECT IDENTIFIER'
  ? number[]
  : T extends 'UTCTime'
  ? Date
  : T extends 'BOOLEAN'
  ? boolean
  : T extends 'OCTET STRING'
  ? Uint8Array
  : never;

export function isSimpleValue<T extends SimpleType>(arg: unknown, t?: T): arg is SimpleValue<T> {
  if (t == null) {
    return (
      typeof arg === 'bigint' ||
      arg instanceof Uint8Array ||
      arg == null ||
      (Array.isArray(arg) && arg.every((x) => typeof x === 'number')) ||
      arg instanceof Date ||
      typeof arg === 'boolean' ||
      arg instanceof Uint8Array
    );
  }
  switch (t) {
    case 'INTEGER':
      return typeof arg === 'bigint';
    case 'BIT STRING':
      return arg instanceof Uint8Array;
    case 'NULL':
      return arg == null;
    case 'OBJECT IDENTIFIER':
      return Array.isArray(arg) && arg.every((x) => typeof x === 'number');
    case 'UTCTime':
      return arg instanceof Date;
    case 'BOOLEAN':
      return typeof arg === 'boolean';
    case 'OCTET STRING':
      return arg instanceof Uint8Array;
    default:
      return false;
  }
}

export function checkSimpleValue<N extends SimpleTypeName>(
  v: SimpleValue,
  n?: N
): v is SimpleValue<SimpleTypeFromName<N>> {
  return isSimpleValue(v, n);
}
