import { eqType, isType, isValue, Type, Value } from 'asn1';
import { isObject } from 'utility';
import { eqTag, isTag, isTagNumber, Tag, TagNumber } from './tag';

/**
 * Implicitly tagged types は基となる type の tag を変更することで他の types から派生する。
 * ASN.1 キーワードで "[class number] IMPLICIT" として表記される。
 * おおよその場合で、 "[class number]" のみの場合は implicitly tagged type の表記。
 */
export const ImplicitTag = <T extends Type>(
  tag: Tag | TagNumber,
  t: T
): { IMPLICIT: Tag; t: T } => {
  if (isTagNumber(tag)) return { IMPLICIT: { c: 'Context Specific', n: tag }, t };
  if (isTag(tag)) return { IMPLICIT: tag, t };
  throw new TypeError('不適切な引数です');
};
export type ImplicitlyTaggedType = { IMPLICIT: Tag; t: Type };
type ImplicitlyTaggedValue<T extends Type> = { IMPLICIT: Value<T> };

/**
 * Explicitly tagged types は基となる type に an outer tag を付加することで他の types から派生する。
 * 実質的に、 explicitly tagged types は基となる types を要素に持つ structured types である。
 * ASN.1 キーワードで "[class number] EXPLICIT" として表記される。
 */
export const ExplicitTag = <T extends Type>(
  tag: Tag | TagNumber,
  t: T
): { EXPLICIT: Tag; t: T } => {
  if (isTagNumber(tag)) return { EXPLICIT: { c: 'Context Specific', n: tag }, t };
  if (isTag(tag)) return { EXPLICIT: tag, t };
  throw new TypeError('不適切な引数です');
};
export type ExplicitlyTaggedType = { EXPLICIT: Tag; t: Type };
type ExplicitlyTaggedValue<T extends Type> = { EXPLICIT: Value<T> };

/**
 * Implicitly and explicitly tagged types はタグ付きの型。
 * タグ付けはアプリケーションや a structured type で component types を区別するために便利。
 * タグ付けには暗黙的なものと明示的なものがある。
 *
 * encoding の観点から、
 * an implicitly tagged type はタグが異なるということを除いて基となる型と同じと見なすことができる。
 * an explicitly tagged type は基となる型のみを要素として持つ structured type とみなせる。
 */
export type TaggedType = ImplicitlyTaggedType | ExplicitlyTaggedType;

export const isTaggedType = (arg: unknown): arg is TaggedType =>
  (isObject<ImplicitlyTaggedType>(arg) && isTag(arg.IMPLICIT) && isType(arg.t)) ||
  (isObject<ExplicitlyTaggedType>(arg) && isTag(arg.EXPLICIT) && isType(arg.t));

export const checkTaggedType = <N extends TaggedTypeName>(
  t: Type,
  n?: N
): t is TaggedTypeFromName<N> => {
  if (n == null) return typeof t === 'object' && ('IMPLICIT' in t || 'EXPLICIT' in t);
  return typeof t === 'object' && n in t;
};

export function eqTaggedType(l?: TaggedType, r?: TaggedType): boolean {
  if (l == null && r == null) return true;
  if (l == null || r == null) return false;
  if ('IMPLICIT' in l) {
    return 'IMPLICIT' in r && eqTag(l.IMPLICIT, r.IMPLICIT) && eqType(l.t, r.t);
  }
  if ('EXPLICIT' in l) {
    return 'EXPLICIT' in r && eqTag(l.EXPLICIT, r.EXPLICIT) && eqType(l.t, r.t);
  }
  return false;
}

export type TaggedTypeName = 'IMPLICIT' | 'EXPLICIT';
export const isTaggedTypeName = (arg: unknown): arg is TaggedTypeName =>
  ['IMPLICIT', 'EXPLICIT'].some((x) => x === arg);

export type TaggedTypeFromName<N extends TaggedTypeName> = N extends 'IMPLICIT'
  ? ImplicitlyTaggedType
  : N extends 'EXPLICIT'
  ? ExplicitlyTaggedType
  : never;
export const TaggedNameFromType = (t: TaggedType): TaggedTypeName => {
  if ('EXPLICIT' in t) return 'EXPLICIT';
  if ('IMPLICIT' in t) return 'IMPLICIT';
  throw new TypeError('Unexpected flow');
};

export type TaggedValue<T extends TaggedType> = T extends ImplicitlyTaggedType
  ? ImplicitlyTaggedValue<T['t']>
  : T extends ExplicitlyTaggedType
  ? ExplicitlyTaggedValue<T['t']>
  : never;

export function isTaggedValue<T extends TaggedType>(arg: unknown, t: T): arg is TaggedValue<T> {
  if ('IMPLICIT' in t) {
    return isObject<{ IMPLICIT: unknown }>(arg) && isValue(arg.IMPLICIT, t.t);
  }
  if ('EXPLICIT' in t) {
    return isObject<{ EXPLICIT: unknown }>(arg) && isValue(arg.EXPLICIT, t.t);
  }
  return false;
}
