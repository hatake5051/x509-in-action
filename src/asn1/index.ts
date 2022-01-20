import { isObject } from 'utility';
import {
  checkOtherType,
  eqOtherType,
  isOtherType,
  isOtherTypeName,
  isOtherValue,
  OtherNameFromType,
  OtherType,
  OtherTypeFromName,
  OtherTypeName,
  OtherValue,
} from './other';
import {
  checkSimpleType,
  isSimpleType,
  isSimpleTypeName,
  isSimpleValue,
  SimpleType,
  SimpleTypeFromName,
  SimpleTypeName,
  SimpleValue,
} from './simple';
import {
  checkStructuredType,
  eqStructuredType,
  isStructuredType,
  isStructuredTypeName,
  isStructuredValue,
  StructuredNameFromType,
  StructuredType,
  StructuredTypeFromName,
  StructuredTypeName,
  StructuredValue,
} from './structured';
import {
  checkTaggedType,
  eqTaggedType,
  isTaggedType,
  isTaggedTypeName,
  isTaggedValue,
  TaggedNameFromType,
  TaggedType,
  TaggedTypeFromName,
  TaggedTypeName,
  TaggedValue,
} from './tagged';

export {
  Type,
  isType,
  checkType,
  eqType,
  TypeName,
  isTypeName,
  TypeFromName,
  NameFromType,
  Value,
  isValue,
};

export type ASN1Value<T extends Type = Type> = T extends Type
  ? {
      type: T;
      value: Value<T>;
    }
  : never;

export const isASN1Value = (arg: unknown): arg is ASN1Value =>
  isObject<ASN1Value>(arg) && isType(arg.type) && isValue(arg.value, arg.type);

export function checkASN1Value<N extends TypeName>(
  asn1: ASN1Value,
  n: N
): asn1 is ASN1Value<TypeFromName<N>> {
  return checkType(asn1.type, n);
}

/**
 * ASN.1 は４つの種類の type がある。
 * - simple types: "atomic" であり、構成要素を持たない
 * - structed types: 構成要素を持つ
 * - tagged types: 他の types から派生したもの
 * - other types: CHOICE type と the ANY type を含むもの
 */
type Type = SimpleType | StructuredType | TaggedType | OtherType;

const isType = (arg: unknown): arg is Type =>
  isSimpleType(arg) || isStructuredType(arg) || isTaggedType(arg) || isOtherType(arg);

function checkType<N extends TypeName>(t: Type, n?: N): t is TypeFromName<N> {
  if (n == null)
    return checkSimpleType(t) || checkStructuredType(t) || checkTaggedType(t) || checkOtherType(t);
  if (isSimpleTypeName(n)) return checkSimpleType(t, n);
  if (isStructuredTypeName(n)) return checkStructuredType(t, n);
  if (isTaggedTypeName(n)) return checkTaggedType(t, n);
  if (isOtherTypeName(n)) return checkOtherType(t, n);
  return false;
}

function eqType(l?: Type, r?: Type): boolean {
  if (l == null && r == null) return true;
  if (l == null || r == null) return false;
  if (checkOtherType(l, 'ANY') || checkOtherType(r, 'ANY')) return true;
  if (checkSimpleType(l)) return checkSimpleType(r) && l === r;
  if (checkTaggedType(l)) return checkTaggedType(r) && eqTaggedType(l, r);
  if (checkStructuredType(l)) return checkStructuredType(r) && eqStructuredType(l, r);
  if (checkOtherType(l, 'CHOICE')) return checkOtherType(r, 'CHOICE') && eqOtherType(l, r);
  return false;
}

type TypeName = SimpleTypeName | StructuredTypeName | TaggedTypeName | OtherTypeName;

const isTypeName = (arg: unknown): arg is TypeName =>
  isSimpleTypeName(arg) ||
  isStructuredTypeName(arg) ||
  isTaggedTypeName(arg) ||
  isOtherTypeName(arg);

type TypeFromName<N extends TypeName> = N extends SimpleTypeName
  ? SimpleTypeFromName<N>
  : N extends StructuredTypeName
  ? StructuredTypeFromName<N>
  : N extends TaggedTypeName
  ? TaggedTypeFromName<N>
  : N extends OtherTypeName
  ? OtherTypeFromName<N>
  : never;

const NameFromType = <N extends TypeName>(t: TypeFromName<N>): N => {
  if (checkSimpleType(t)) return t as N;
  if (checkStructuredType(t)) return StructuredNameFromType(t) as N;
  if (checkTaggedType(t)) return TaggedNameFromType(t) as N;
  if (checkOtherType(t)) return OtherNameFromType(t) as N;
  throw new TypeError(`${JSON.stringify(t)} は ASN1 Type ではない`);
};

type Value<T extends Type = Type> = T extends SimpleType
  ? SimpleValue<T>
  : T extends StructuredType
  ? StructuredValue<T>
  : T extends TaggedType
  ? TaggedValue<T>
  : T extends OtherType
  ? OtherValue<T>
  : never;

function isValue<T extends Type>(arg: unknown, t: T): arg is Value<T> {
  if (checkSimpleType(t)) return isSimpleValue(arg, t);
  if (checkStructuredType(t)) return isStructuredValue(arg, t);
  if (checkTaggedType(t)) return isTaggedValue(arg, t);
  if (checkOtherType(t)) return isOtherValue(arg, t);
  return false;
}
