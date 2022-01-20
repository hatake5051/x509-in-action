import { NameFromType, Type } from 'asn1/index';
import { isObject } from 'utility';
import { ExplicitlyTaggedType, ImplicitlyTaggedType } from './tagged';

/**
 * CHOICE and ANY 以外の全ての type には tag があり、 tag は class と非負整数の tag number からなる。
 * ASN.1 type は実質的に名前とかどうでもよく、 tag numbers が同じ時に、またその時に限り等しい。
 */
export type Tag = { c: TagClass; n: TagNumber };

export const isTag = (arg: unknown): arg is Type =>
  isObject<Tag>(arg) && isTagClass(arg.c) && isTagNumber(arg.n);

export function eqTag(l?: Tag, r?: Tag): boolean {
  if (l == null && r == null) return true;
  if (l == null || r == null) return false;
  return l.c === r.c && l.n === r.n;
}

export function TagFromType(t: Type): Tag {
  switch (NameFromType(t)) {
    case 'BOOLEAN':
      return { c: 'Universal', n: 1 as TagNumber };
    case 'INTEGER':
      return { c: 'Universal', n: 2 as TagNumber };
    case 'BIT STRING':
      return { c: 'Universal', n: 3 as TagNumber };
    case 'OCTET STRING':
      return { c: 'Universal', n: 4 as TagNumber };
    case 'NULL':
      return { c: 'Universal', n: 5 as TagNumber };
    case 'OBJECT IDENTIFIER':
      return { c: 'Universal', n: 6 as TagNumber };
    case 'UTCTime':
      return { c: 'Universal', n: 23 as TagNumber };
    case 'EXPLICIT':
      return (t as ExplicitlyTaggedType).EXPLICIT;
    case 'IMPLICIT':
      return (t as ImplicitlyTaggedType).IMPLICIT;
    case 'SEQUENCE':
    case 'SEQUENCEOF':
      return { c: 'Universal', n: 16 as TagNumber };
    case 'SETOF':
      return { c: 'Universal', n: 17 as TagNumber };
    default:
      throw new TypeError(`Type_toTag(${JSON.stringify(t)}) has not been implmented`);
  }
}

export type TagNumber = number & { _brand: 'TagNumber' };

export const isTagNumber = (arg: unknown): arg is TagNumber => typeof arg === 'number' && arg >= 0;

/**
 * tag には４つのクラスがある
 * - Universal: 全てのアプリケーションで等しい意味を持つ。 X.208 に定義される
 * - Application: アプリケーションごとに固有の意味を持つ。 X.500 などで使われる
 * - Private: 特定の企業に固有の意味を持つ
 * - Context-specific: ある structured type に固有の意味を持つ。
 * ある structured type の文脈で同じ tag を持つ component types を区別するために用いる。
 */
type TagClass = typeof TagClassList[number];

const isTagClass = (arg: unknown): arg is TagClass => TagClassList.some((x) => x === arg);

const TagClassList = ['Universal', 'Application', 'Context Specific', 'Private'] as const;
