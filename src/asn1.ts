/**
 * @file Abstract Syntax Notation One (ASN.1)
 * 参考文献: http://websites.umich.edu/~x509/ssleay/layman.html
 *
 * ASN.1 は抽象的な types and values を説明するための記法である。
 * type は values の集合であり、ある ASN.1 type の a value はその type が表す集合の要素である。
 * types と values は ASN.1 assignment operator (:==) を使って名づけることができ、他の types 定義にも使える。
 *
 * ASN.1 の表現規則
 * - Comment は pairs of hyphens (--) もしくは a pair of hyphens and a line break で区切る
 * - Identifier (values and fileds の名前) は lower-case letters から始まる
 * - Type references (name of types) は upper-case letters から始まる
 */

import { isObject } from 'utility';

export {
  ASN1Value,
  isASN1Value,
  checkASN1Value,
  ASN1Type,
  isASN1Type,
  eqASN1Type,
  ASN1Tag,
  eqASN1Tag,
  ASN1TagNumber,
  ASN1Type_to_ASN1Tag,
  ASN1CHOICE,
  ASN1SEQUENCE,
  ASN1SEQUENCEOF,
  ASN1SETOF,
  ASN1ImplicitTag,
  ASN1ExplicitTag,
};

/**
 * ASN.1 は４つの種類の type がある。
 * - simple types: "atomic" であり、構成要素を持たない
 * - structed types: 構成要素を持つ
 * - tagged types: 他の types から派生したもの
 * - other types: CHOICE type と the ANY type を含むもの
 */
type ASN1Type = ASN1SimpleType | ASN1StructuredType | ASN1TaggedType | ASN1OtherType;

function isASN1Type<T extends ASN1Type | ASN1TypeName>(
  arg: unknown,
  t?: T
): arg is T extends ASN1TypeName ? ASN1TypeFromName<T> : T extends ASN1Type ? T : never {
  if (t == null) {
    return (
      isASN1SimpleType(arg) ||
      isASN1StructuredType(arg) ||
      isASN1TaggedType(arg) ||
      isASN1OtherType(arg)
    );
  }
  if (isASN1TypeName(t)) return isASN1Type(arg) && t === asn1TypeNameFromType(arg);
  return isASN1Type(arg) && eqASN1Type(t, arg);
}

function eqASN1Type(l?: ASN1Type, r?: ASN1Type): boolean {
  if (l == null && r == null) return true;
  if (l == null || r == null) return false;
  if (l === 'ANY' || r === 'ANY') return true;
  if (isASN1SimpleType(l)) return isASN1SimpleType(r) && l === r;
  if ('IMPLICIT' in l) {
    return (
      isObject(r) && 'IMPLICIT' in r && eqASN1Tag(l.IMPLICIT, r.IMPLICIT) && eqASN1Type(l.t, r.t)
    );
  }
  if ('EXPLICIT' in l) {
    return (
      isObject(r) && 'EXPLICIT' in r && eqASN1Tag(l.EXPLICIT, r.EXPLICIT) && eqASN1Type(l.t, r.t)
    );
  }
  if ('SEQUENCE' in l) {
    return (
      isObject(r) &&
      'SEQUENCE' in r &&
      new Set(l.order).size === new Set(r.order).size &&
      l.order.every((li) => {
        const lv = l.SEQUENCE[li];
        const rv = l.SEQUENCE[li];
        return (
          r.order.includes(li) &&
          eqASN1Type(
            isObject(lv) && 'OPTIONAL' in lv ? lv.OPTIONAL : lv,
            isObject(rv) && 'OPTIONAL' in rv ? rv.OPTIONAL : rv
          )
        );
      })
    );
  }
  if ('SEQUENCEOF' in l) {
    return isObject(r) && 'SEQUENCEOF' in r && eqASN1Type(l.SEQUENCEOF, r.SEQUENCEOF);
  }
  if ('SETOF' in l) {
    return isObject(r) && 'SETOF' in r && eqASN1Type(l.SETOF, r.SETOF);
  }
  if ('CHOICE' in l) {
    return (
      isObject(r) &&
      'CHOICE' in r &&
      Object.entries(l.CHOICE).every(([li, lt]) => eqASN1Type(lt, r.CHOICE[li])) &&
      Object.entries(r.CHOICE).every(([ri, rt]) => eqASN1Type(l.CHOICE[ri], rt))
    );
  }
  return false;
}

type ASN1TypeName =
  | ASN1SimpleTypeName
  | ASN1StructuredTypeName
  | ASN1TaggedTypeName
  | ASN1OtherTypeName;

const isASN1TypeName = (arg: unknown): arg is ASN1TypeName =>
  isASN1SimpleTypeName(arg) ||
  isASN1StructuredTypeName(arg) ||
  isASN1TaggedTypeName(arg) ||
  isASN1OtherTypeName(arg);

type ASN1TypeFromName<N extends ASN1TypeName> = N extends ASN1SimpleTypeName
  ? ASN1SimpleTypeFromName<N>
  : N extends ASN1StructuredTypeName
  ? ASN1StructuredTypeFromName<N>
  : N extends ASN1TaggedTypeName
  ? ASN1TaggedTypeFromName<N>
  : N extends ASN1OtherTypeName
  ? ASN1OtherTypeFromName<N>
  : never;

const asn1TypeNameFromType = <N extends ASN1TypeName>(t: ASN1TypeFromName<N>): N => {
  if (isASN1SimpleType(t)) return t as N;
  if ('SEQUENCE' in t) return 'SEQUENCE' as N;
  if ('SEQUENCEOF' in t) return 'SEQUENCEOF' as N;
  if ('SETOF' in t) return 'SETOF' as N;
  if ('IMPLICIT' in t) return 'IMPLICIT' as N;
  if ('EXPLICIT' in t) return 'EXPLICIT' as N;
  if (t === 'ANY') return 'ANY' as N;
  if ('CHOICE' in t) return 'CHOICE' as N;
  throw new TypeError(`${JSON.stringify(t)} は ASN1 Type ではない`);
};

/**
 * ASN1Type を、その値を Typescript で持つ場合の型に変換する
 */
type ASN1Type_to_TSType<T extends ASN1Type> = T extends ASN1SimpleType
  ? ASN1SimpleType_to_TSType<T>
  : T extends ASN1StructuredType
  ? ASN1StructuredType_to_TSType<T>
  : T extends ASN1TaggedType
  ? ASN1TaggedType_to_TSType<T>
  : T extends ASN1OtherType
  ? ASN1OtherType_to_TSType<T>
  : never;

type ASN1Value<T extends ASN1Type = ASN1Type> = {
  t: T;
  v: ASN1Type_to_TSType<T>;
};

function isASN1Value(arg: unknown): arg is ASN1Value {
  if (!isObject<ASN1Value>(arg)) return false;
  if (isASN1SimpleType(arg.t)) return isASN1SimpleType_to_TSType(arg.v, arg.t);
  if (isASN1StructuredType(arg.t)) return isASN1StructuredType_to_TSType(arg.v, arg.t);
  if (isASN1TaggedType(arg.t)) return isASN1TaggedType_to_TSType(arg.v, arg.t);
  if (isASN1OtherType(arg.t)) return isASN1OtherType_to_TSType(arg.v, arg.t);
  return false;
}

function checkASN1Value<T extends ASN1Type | ASN1TypeName>(
  value: ASN1Value,
  t?: T
): value is ASN1Value<
  T extends ASN1TypeName ? ASN1TypeFromName<T> : T extends ASN1Type ? T : never
> {
  if (isASN1TypeName(t)) return t === asn1TypeNameFromType(value.t);
  return eqASN1Type(t, value.t);
}

/**
 * Simple types は構成要素を持たない型で、ASN.1 では次のようなものが定義されている。
 * - BIT STRING: 任意のビット文字列
 * - INTEGER: 任意の整数
 * - OBJECT IDENTIFIER: オブジェクトを識別する、整数列
 *
 * simple types は string types か non-string types かに2分できる。
 *
 * encoding の観点から、string types は構成要素(部分文字列)からなると考えることができる。
 */
type ASN1SimpleType = typeof ASN1SimpleTypeList[number];
const ASN1SimpleTypeList = [
  'INTEGER',
  'BIT STRING',
  'NULL',
  'OBJECT IDENTIFIER',
  'UTCTime',
  'BOOLEAN',
  'OCTET STRING',
] as const;

const isASN1SimpleType = (arg: unknown): arg is ASN1SimpleType =>
  ASN1SimpleTypeList.some((t) => arg === t);

type ASN1SimpleTypeName = ASN1SimpleType;

type ASN1SimpleTypeFromName<N extends ASN1SimpleTypeName> = N extends ASN1SimpleTypeName
  ? N
  : never;

const isASN1SimpleTypeName = isASN1SimpleType;

type ASN1SimpleType_to_TSType<T extends ASN1SimpleType> = T extends 'INTEGER'
  ? bigint
  : T extends 'BIT STRING'
  ? Uint8Array
  : T extends 'NULL'
  ? undefined
  : T extends 'OBJECT IDENTIFIER'
  ? number[]
  : T extends 'UTCTime'
  ? string
  : T extends 'BOOLEAN'
  ? boolean
  : T extends 'OCTET STRING'
  ? Uint8Array
  : never;

function isASN1SimpleType_to_TSType<T extends ASN1SimpleType>(
  arg: unknown,
  t: T
): arg is ASN1SimpleType_to_TSType<T> {
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
      return typeof arg === 'string';
    case 'BOOLEAN':
      return typeof arg === 'boolean';
    case 'OCTET STRING':
      return arg instanceof Uint8Array;
    default:
      return false;
  }
}

/**
 * Structured type は構成要素を持つ型で、ASN.1 では４つ定義されている
 * - SEQUENCE: 一つ以上の type の順序付きコレクション
 */
type ASN1StructuredType = ASN1SEQUENCEType | ASN1SEQUENCEOFType | ASN1SETOFType;

type ASN1StructuredTypeName = 'SEQUENCE' | 'SEQUENCEOF' | 'SETOF';
const isASN1StructuredTypeName = (arg: unknown): arg is ASN1StructuredTypeName =>
  ['SEQUENCE', 'SEQUENCEOF', 'SETOF'].some((x) => x === arg);

type ASN1StructuredTypeFromName<N extends ASN1StructuredTypeName> = N extends 'SEQUENCE'
  ? ASN1SEQUENCEType
  : N extends 'SEQUENCEOF'
  ? ASN1SEQUENCEOFType
  : N extends 'SETOF'
  ? ASN1SETOFType
  : never;

function isASN1StructuredType(arg: unknown): arg is ASN1StructuredType {
  if (isObject<ASN1SEQUENCEType>(arg) && 'SEQUENCE' in arg) {
    return (
      Array.isArray(arg.order) &&
      arg.order.every((k) => typeof k === 'string') &&
      isObject<ASN1SEQUENCEType['SEQUENCE']>(arg.SEQUENCE) &&
      Object.entries(arg.SEQUENCE).every(
        ([k, v]) =>
          (arg.order as string[]).includes(k) &&
          ((isObject<{ OPTIONAL: unknown }>(v) && 'OPTIONAL' in v && isASN1Type(v.OPTIONAL)) ||
            isASN1Type(v))
      )
    );
  }
  if (isObject<ASN1SEQUENCEOFType>(arg) && 'SEQUENCEOF' in arg) {
    return isASN1Type(arg.SEQUENCEOF);
  }
  if (isObject<ASN1SETOFType>(arg) && 'SETOF' in arg) {
    return isASN1Type(arg.SETOF);
  }
  return false;
}

type FilteredKey<T, U> = { [P in keyof T]: T[P] extends U ? P : never }[keyof T];

type ASN1StructuredType_to_TSType<T extends ASN1StructuredType> = T extends ASN1SEQUENCEType
  ? FilteredKey<T['SEQUENCE'], { OPTIONAL: ASN1Type }> extends never
    ? FilteredKey<T['SEQUENCE'], ASN1Type> extends never
      ? { [P in keyof T['SEQUENCE']]: unknown }
      : {
          [P in FilteredKey<T['SEQUENCE'], ASN1Type>]: T['SEQUENCE'][P] extends ASN1Type
            ? ASN1Type_to_TSType<T['SEQUENCE'][P]>
            : never;
        }
    : {
        [P in FilteredKey<T['SEQUENCE'], ASN1Type>]: T['SEQUENCE'][P] extends ASN1Type
          ? ASN1Type_to_TSType<T['SEQUENCE'][P]>
          : never;
      } & {
        [P in FilteredKey<T['SEQUENCE'], { OPTIONAL: ASN1Type }>]?: T['SEQUENCE'][P] extends {
          OPTIONAL: ASN1Type;
        }
          ? ASN1Type_to_TSType<T['SEQUENCE'][P]['OPTIONAL']>
          : never;
      }
  : T extends ASN1SEQUENCEOFType
  ? Array<ASN1Type_to_TSType<T['SEQUENCEOF']>>
  : T extends ASN1SETOFType
  ? Set<ASN1Type_to_TSType<T['SETOF']>>
  : never;

function isASN1StructuredType_to_TSType<T extends ASN1StructuredType>(
  arg: unknown,
  t: T
): arg is ASN1StructuredType_to_TSType<T> {
  if ('SEQUENCE' in t) {
    return (
      isObject(arg) &&
      Object.entries(arg).every(
        ([k, v]) => t.order.some((x) => x === k) && isASN1Value({ v, t: t.SEQUENCE[k] })
      )
    );
  }
  if ('SEQUENCEOF' in t) {
    return Array.isArray(arg) && arg.every((v) => isASN1Value({ v, t: t.SEQUENCEOF }));
  }
  if ('SETOF' in t) {
    return arg instanceof Set && [...arg].every((v) => isASN1Value({ v, t: t.SETOF }));
  }
  return false;
}

type ASN1SEQUENCEType<S extends string = string> = {
  SEQUENCE: Record<S, ASN1Type | { OPTIONAL: ASN1Type }>;
  order: S[];
};
const ASN1SEQUENCE = <S extends string, T extends Record<S, ASN1Type | { OPTIONAL: ASN1Type }>>(
  s: T,
  order: S[]
) => ({
  SEQUENCE: s,
  order,
});

type ASN1SEQUENCEOFType = { SEQUENCEOF: ASN1Type };
const ASN1SEQUENCEOF = <T extends ASN1Type>(s: T) => ({ SEQUENCEOF: s });

type ASN1SETOFType = { SETOF: ASN1Type };
const ASN1SETOF = <T extends ASN1Type>(s: T) => ({ SETOF: s });

/**
 * Implicitly and explicitly tagged types はタグ付きの型。
 * タグ付けはアプリケーションや a structured type で component types を区別するために便利。
 * タグ付けには暗黙的なものと明示的なものがある。
 *
 * encoding の観点から、
 * an implicitly tagged type はタグが異なるということを除いて基となる型と同じと見なすことができる。
 * an explicitly tagged type は基となる型のみを要素として持つ structured type とみなせる。
 */
type ASN1TaggedType = ASN1ImplicitlyTaggedType | ASN1ExplicitlyTaggedType;

type ASN1TaggedTypeName = 'IMPLICIT' | 'EXPLICIT';
const isASN1TaggedTypeName = (arg: unknown): arg is ASN1TaggedTypeName =>
  ['IMPLICIT', 'EXPLICIT'].some((x) => x === arg);

type ASN1TaggedTypeFromName<N extends ASN1TaggedTypeName> = N extends 'IMPLICIT'
  ? ASN1ImplicitlyTaggedType
  : N extends 'EXPLICIT'
  ? ASN1ExplicitlyTaggedType
  : never;

const isASN1TaggedType = (arg: unknown): arg is ASN1TaggedType =>
  (isObject<ASN1ImplicitlyTaggedType>(arg) && isASN1Tag(arg.IMPLICIT) && isASN1Type(arg.t)) ||
  (isObject<ASN1ExplicitlyTaggedType>(arg) && isASN1Tag(arg.EXPLICIT) && isASN1Type(arg.t));

type ASN1TaggedType_to_TSType<T extends ASN1TaggedType> = T extends ASN1ImplicitlyTaggedType
  ? { v: ASN1Type_to_TSType<T['t']> }
  : T extends ASN1ExplicitlyTaggedType
  ? { v: ASN1Type_to_TSType<T['t']> }
  : never;

function isASN1TaggedType_to_TSType<T extends ASN1TaggedType>(
  arg: unknown,
  t: T
): arg is ASN1TaggedType_to_TSType<T> {
  return isObject<ASN1TaggedType_to_TSType<T>>(arg) && isASN1Value({ v: arg.v, t: t.t });
}

/**
 * Implicitly tagged types は基となる type の tag を変更することで他の types から派生する。
 * ASN.1 キーワードで "[class number] IMPLICIT" として表記される。
 * おおよその場合で、 "[class number]" のみの場合は implicitly tagged type の表記。
 */
const ASN1ImplicitTag = <T extends ASN1Type>(
  tag: ASN1Tag | ASN1TagNumber,
  t: T
): { IMPLICIT: ASN1Tag; t: T } => {
  if (isASN1TagNumber(tag)) return { IMPLICIT: { c: 'Context Specific', n: tag }, t };
  if (isASN1Tag(tag)) return { IMPLICIT: tag, t };
  throw new TypeError('不適切な引数です');
};
type ASN1ImplicitlyTaggedType = { IMPLICIT: ASN1Tag; t: ASN1Type };

/**
 * Explicitly tagged types は基となる type に an outer tag を付加することで他の types から派生する。
 * 実質的に、 explicitly tagged types は基となる types を要素に持つ structured types である。
 * ASN.1 キーワードで "[class number] EXPLICIT" として表記される。
 */
const ASN1ExplicitTag = <T extends ASN1Type>(
  tag: ASN1Tag | ASN1TagNumber,
  t: T
): { EXPLICIT: ASN1Tag; t: T } => {
  if (isASN1TagNumber(tag)) return { EXPLICIT: { c: 'Context Specific', n: tag }, t };
  if (isASN1Tag(tag)) return { EXPLICIT: tag, t };
  throw new TypeError('不適切な引数です');
};
type ASN1ExplicitlyTaggedType = { EXPLICIT: ASN1Tag; t: ASN1Type };

type ASN1OtherType = ASN1AnyType | ASN1CHOICEType;

type ASN1OtherTypeName = 'ANY' | 'CHOICE';
const isASN1OtherTypeName = (arg: unknown): arg is ASN1OtherTypeName =>
  ['ANY', 'CHOICE'].some((x) => x === arg);

type ASN1OtherTypeFromName<N extends ASN1OtherTypeName> = N extends 'ANY'
  ? ASN1AnyType
  : N extends 'CHOICE'
  ? ASN1CHOICEType
  : never;

const isASN1OtherType = (arg: unknown): arg is ASN1OtherType =>
  arg === 'ANY' ||
  (isObject<ASN1CHOICEType>(arg) &&
    typeof arg.CHOICE === 'object' &&
    arg.CHOICE != null &&
    Object.values(arg.CHOICE).every((t) => isASN1Type(t)));

type ASN1OtherType_to_TSType<T extends ASN1OtherType> = T extends ASN1AnyType
  ? unknown
  : T extends ASN1CHOICEType
  ? T extends { CHOICE: Record<infer S, ASN1Type> }
    ? { v: ASN1Type_to_TSType<T['CHOICE'][S]> }
    : never
  : never;

function isASN1OtherType_to_TSType<T extends ASN1OtherType>(
  arg: unknown,
  t: T
): arg is ASN1OtherType_to_TSType<T> {
  if (t === 'ANY') return true;
  return (
    isObject<{ v: unknown }>(arg) &&
    Object.values(t.CHOICE).some((t) => isASN1Value({ v: arg.v, t }))
  );
}

type ASN1AnyType = typeof ASN1Any;
const ASN1Any = 'ANY';

type ASN1CHOICEType = { CHOICE: Record<string, ASN1Type> };
const ASN1CHOICE = <T extends Record<string, ASN1Type>>(s: T) => ({ CHOICE: s });

/**
 * CHOICE and ANY 以外の全ての type には tag があり、 tag は class と非負整数の tag number からなる。
 * ASN.1 type は実質的に名前とかどうでもよく、 tag numbers が同じ時に、またその時に限り等しい。
 */
type ASN1Tag = { c: ASN1TagClass; n: ASN1TagNumber };

const isASN1Tag = (arg: unknown): arg is ASN1Type =>
  isObject<ASN1Tag>(arg) && isASN1TagClass(arg.c) && isASN1TagNumber(arg.n);

function eqASN1Tag(l?: ASN1Tag, r?: ASN1Tag): boolean {
  if (l == null && r == null) return true;
  if (l == null || r == null) return false;
  return l.c === r.c && l.n === r.n;
}

type ASN1TagNumber = number & { _brand: 'ASN1TagNumber' };

const isASN1TagNumber = (arg: unknown): arg is ASN1TagNumber => typeof arg === 'number' && arg >= 0;

function ASN1Type_to_ASN1Tag(t: ASN1Type): ASN1Tag {
  if (t === 'ANY') throw new TypeError(`Any の ASN1Tag はない`);
  if (t === 'BOOLEAN') return { c: 'Universal', n: 1 as ASN1TagNumber };
  if (t === 'INTEGER') return { c: 'Universal', n: 2 as ASN1TagNumber };
  if (t === 'BIT STRING') return { c: 'Universal', n: 3 as ASN1TagNumber };
  if (t === 'OCTET STRING') return { c: 'Universal', n: 4 as ASN1TagNumber };
  if (t === 'NULL') return { c: 'Universal', n: 5 as ASN1TagNumber };
  if (t === 'OBJECT IDENTIFIER') return { c: 'Universal', n: 6 as ASN1TagNumber };
  if (t === 'UTCTime') return { c: 'Universal', n: 23 as ASN1TagNumber };
  if ('EXPLICIT' in t) return t.EXPLICIT;
  if ('IMPLICIT' in t) return t.IMPLICIT;
  if ('SEQUENCE' in t || 'SEQUENCEOF' in t) return { c: 'Universal', n: 16 as ASN1TagNumber };
  if ('SETOF' in t) return { c: 'Universal', n: 17 as ASN1TagNumber };
  if ('CHOICE' in t) throw new TypeError(`${JSON.stringify(t)} の ASN1Tag は選べない`);
  throw new TypeError(`ASN1Type_toASN1Tag(${JSON.stringify(t)}) has not been implmented`);
}

/**
 * tag には４つのクラスがある
 * - Universal: 全てのアプリケーションで等しい意味を持つ。 X.208 に定義される
 * - Application: アプリケーションごとに固有の意味を持つ。 X.500 などで使われる
 * - Private: 特定の企業に固有の意味を持つ
 * - Context-specific: ある structured type に固有の意味を持つ。
 * ある structured type の文脈で同じ tag を持つ component types を区別するために用いる。
 */
type ASN1TagClass = typeof ASN1TagClassList[number];

const isASN1TagClass = (arg: unknown): arg is ASN1TagClass =>
  ASN1TagClassList.some((x) => x === arg);

const ASN1TagClassList = ['Universal', 'Application', 'Context Specific', 'Private'] as const;
