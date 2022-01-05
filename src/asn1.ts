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
  ASN1Type,
  isASN1Type,
  equalsASN1Type,
  ASN1Tag,
  equalsASN1Tag,
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

function isASN1Type<T extends ASN1Type = ASN1Type>(arg: unknown, t?: T): arg is T {
  if (t == null) {
    return (
      isASN1SimpleType(arg) ||
      isASN1StructuredType(arg) ||
      isASN1TaggedType(arg) ||
      isASN1OtherType(arg)
    );
  }
  return isASN1Type(arg) && equalsASN1Type(arg, t);
}

function equalsASN1Type(l?: ASN1Type, r?: ASN1Type): boolean {
  if (l == null && r == null) return true;
  if (l == null || r == null) return false;
  if (l === 'ANY' || r === 'ANY') return true;
  if (isASN1SimpleType(l)) return isASN1SimpleType(r) && l == r;
  if (isASN1TaggedType(l)) return isASN1TaggedType(r) && equalsASN1TaggedType(l, r);
  if (isASN1StructuredType(l)) return isASN1StructuredType(r) && equalsASN1StructuredType(l, r);
  if (isASN1OtherType(l)) return isASN1OtherType(r) && equalsASN1OtherType(l, r);
  return false;
}

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

function isASN1Value<T extends ASN1Type>(arg: unknown, t: T): arg is ASN1Value<T> {
  if (!(isObject<ASN1Value>(arg) && isASN1Type(arg.t) && equalsASN1Type(arg.t, t))) return false;
  if (isASN1SimpleType(t)) {
    return isASN1SimpleValue(arg.v, t);
  }
  if (isASN1TaggedType(t)) {
    return isASN1TaggedValue(arg.v, t);
  }
  if (isASN1StructuredType(t)) {
    return isASN1StructuredValue(arg.v, t);
  }
  if (isASN1OtherType(t)) {
    return isASN1OtheValue(arg.v, t);
  }
  return false;
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

function isASN1SimpleValue<T extends ASN1SimpleType>(
  value: unknown,
  t: T
): value is ASN1SimpleType_to_TSType<T> {
  // if (t == null) {
  //   return (
  //     typeof value === 'bigint' ||
  //     value instanceof Uint8Array ||
  //     value == null ||
  //     (Array.isArray(value) && value.every((x) => typeof x === 'number')) ||
  //     typeof value === 'string'
  //   );
  // }
  switch (t) {
    case 'INTEGER':
      return typeof value === 'bigint';
    case 'BIT STRING':
      return value instanceof Uint8Array;
    case 'NULL':
      return value == null;
    case 'OBJECT IDENTIFIER':
      return Array.isArray(value) && value.every((x) => typeof x === 'number');
    case 'UTCTime':
      return typeof value === 'string';
    default:
      return false;
  }
}

/**
 * Structured type は構成要素を持つ型で、ASN.1 では４つ定義されている
 * - SEQUENCE: 一つ以上の type の順序付きコレクション
 */
type ASN1StructuredType = ASN1SEQUENCEType | ASN1SEQUENCEOFType | ASN1SETOFType;

const isASN1StructuredType = (arg: unknown): arg is ASN1StructuredType =>
  (isObject<ASN1SEQUENCEType>(arg) &&
    typeof arg.SEQUENCE === 'object' &&
    arg.SEQUENCE != null &&
    Object.values(arg.SEQUENCE).every((t) => isASN1Type(t))) ||
  (isObject<ASN1SEQUENCEOFType>(arg) && isASN1Type(arg.SEQUENCEOF)) ||
  (isObject<ASN1SETOFType>(arg) && isASN1Type(arg.SETOF));

function equalsASN1StructuredType(l?: ASN1StructuredType, r?: ASN1StructuredType): boolean {
  if (l == null && r == null) return true;
  if (l == null || r == null) return false;
  if ('SEQUENCE' in l) {
    return (
      'SEQUENCE' in r &&
      Object.entries(l.SEQUENCE).every(([tk, tv]) => {
        const tl = isASN1Type(tv) ? tv : tv.OPTIONAL;
        const x = r.SEQUENCE[tk];
        const tr = isASN1Type(x) ? x : x?.OPTIONAL;
        return equalsASN1Type(tr, tl);
      }) &&
      Object.entries(r.SEQUENCE).every(([tk, tv]) => {
        const tr = isASN1Type(tv) ? tv : tv.OPTIONAL;
        const x = l.SEQUENCE[tk];
        const tl = isASN1Type(x) ? x : x?.OPTIONAL;
        return equalsASN1Type(tr, tl);
      })
    );
  }
  if ('SEQUENCEOF' in l) {
    return 'SEQUENCEOF' in r && equalsASN1Type(l.SEQUENCEOF, r.SEQUENCEOF);
  }
  if ('SETOF' in l) {
    return 'SETOF' in r && equalsASN1Type(l.SETOF, r.SETOF);
  }
  return false;
}

type FilteredKey<T, U> = { [P in keyof T]: T[P] extends U ? P : never }[keyof T];

type ASN1StructuredType_to_TSType<T extends ASN1StructuredType> = T extends ASN1SEQUENCEType
  ? {
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

function isASN1StructuredValue<T extends ASN1StructuredType>(
  value: unknown,
  t: T
): value is ASN1StructuredType_to_TSType<T> {
  if ('SEQUENCE' in t) {
    if (!(typeof value === 'object' && value != null)) return false;
    return Object.entries(value).every(([k, v]) => {
      const x = t.SEQUENCE[k];
      const tt = isASN1Type(x) ? x : x?.OPTIONAL;
      return tt != null && isASN1Value(v, tt);
    });
  }
  if ('SEQUENCEOF' in t) {
    return Array.isArray(value) && value.every((v) => isASN1Value(v, t.SEQUENCEOF));
  }
  if ('SETOF' in t) {
    if (!(value instanceof Set)) return false;
    value.forEach((v) => {
      if (!isASN1Value(v, t.SETOF)) return false;
    });
    return true;
  }
  return false;
}

type ASN1SEQUENCEType = { SEQUENCE: Record<string, ASN1Type | { OPTIONAL: ASN1Type }> };

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

const isASN1TaggedType = (arg: unknown): arg is ASN1TaggedType =>
  (isObject<ASN1ImplicitlyTaggedType>(arg) &&
    (arg.IMPLICIT === 'unknown' || isASN1Tag(arg.IMPLICIT)) &&
    isASN1Type(arg.t)) ||
  (isObject<ASN1ExplicitlyTaggedType>(arg) &&
    (arg.EXPLICIT === 'unknown' || isASN1Tag(arg.EXPLICIT)) &&
    isASN1Type(arg.t));

function equalsASN1TaggedType(l?: ASN1TaggedType, r?: ASN1TaggedType): boolean {
  if (l == null && r == null) return true;
  if (l == null || r == null) return false;
  if ('IMPLICIT' in l) {
    return (
      'IMPLICIT' in r &&
      (l.IMPLICIT === 'unknown' ||
        r.IMPLICIT === 'unknown' ||
        equalsASN1Tag(l.IMPLICIT, r.IMPLICIT)) &&
      equalsASN1Type(r.t, l.t)
    );
  }
  return (
    'EXPLICIT' in r &&
    (l.EXPLICIT === 'unknown' ||
      r.EXPLICIT === 'unknown' ||
      equalsASN1Tag(l.EXPLICIT, r.EXPLICIT)) &&
    equalsASN1Type(l.t, r.t)
  );
}

type ASN1TaggedType_to_TSType<T extends ASN1TaggedType> = T extends ASN1ImplicitlyTaggedType
  ? { v: ASN1Type_to_TSType<T['t']> }
  : T extends ASN1ExplicitlyTaggedType
  ? { v: ASN1Type_to_TSType<T['t']> }
  : never;

function isASN1TaggedValue<T extends ASN1TaggedType>(
  value: unknown,
  t: T
): value is ASN1TaggedType_to_TSType<T> {
  return isObject<{ v: unknown }>(value) && isASN1Value({ v: value.v, t: t.t }, t.t);
}

type ASN1ImplicitlyTaggedType = { IMPLICIT: ASN1Tag | 'unknown'; t: ASN1Type };
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

type ASN1ExplicitlyTaggedType = { EXPLICIT: ASN1Tag | 'unknown'; t: ASN1Type };
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

type ASN1OtherType = ASN1AnyType | ASN1CHOICEType;

const isASN1OtherType = (arg: unknown): arg is ASN1OtherType =>
  arg === 'ANY' ||
  (isObject<ASN1CHOICEType>(arg) &&
    typeof arg.CHOICE === 'object' &&
    arg.CHOICE != null &&
    Object.values(arg.CHOICE).every((t) => isASN1Type(t)));

function equalsASN1OtherType(l?: ASN1OtherType, r?: ASN1OtherType): boolean {
  if (l == null && r == null) return true;
  if (l == null || r == null) return false;
  if ('ANY' === l) return 'ANY' === r;
  return (
    typeof r === 'object' &&
    'CHOICE' in r &&
    Object.entries(l.CHOICE).every(([tk, tv]) => {
      const tl = isASN1Type(tv) ? tv : undefined;
      const x = r.CHOICE[tk];
      const tr = isASN1Type(x) ? x : undefined;
      return equalsASN1Type(tl, tr);
    }) &&
    Object.entries(r.CHOICE).every(([tk, tv]) => {
      const tr = isASN1Type(tv) ? tv : undefined;
      const x = l.CHOICE[tk];
      const tl = isASN1Type(x) ? x : undefined;
      return equalsASN1Type(tl, tr);
    })
  );
}

type ASN1OtherType_to_TSType<T extends ASN1OtherType> = T extends ASN1AnyType
  ? unknown
  : T extends ASN1CHOICEType
  ? T extends { CHOICE: Record<infer S, ASN1Type> }
    ? { v: ASN1Type_to_TSType<T['CHOICE'][S]> }
    : never
  : never;

function isASN1OtheValue<T extends ASN1OtherType>(
  value: unknown,
  t: T
): value is ASN1OtherType_to_TSType<T> {
  if (t === 'ANY') {
    return true;
  }
  return (
    isObject<{ v: unknown }>(value) &&
    Object.values(t.CHOICE).some((tt) => isASN1Value(value.v, tt))
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

function equalsASN1Tag(l?: ASN1Tag, r?: ASN1Tag): boolean {
  if (l == null && r == null) return true;
  if (l == null || r == null) return false;
  return l.c === r.c && l.n === r.n;
}

type ASN1TagNumber = number & { _brand: 'ASN1TagNumber' };

const isASN1TagNumber = (arg: unknown): arg is ASN1TagNumber => typeof arg === 'number' && arg >= 0;

function ASN1Type_to_ASN1Tag(t: ASN1Type): ASN1Tag {
  if (t === 'INTEGER') return { c: 'Universal', n: 2 as ASN1TagNumber };
  if (t === 'BIT STRING') return { c: 'Universal', n: 3 as ASN1TagNumber };
  if (t === 'NULL') return { c: 'Universal', n: 5 as ASN1TagNumber };
  if (t === 'OBJECT IDENTIFIER') return { c: 'Universal', n: 6 as ASN1TagNumber };
  if (isASN1Type(t, { IMPLICIT: 'unknown', t: 'ANY' })) {
    return t.IMPLICIT as unknown as ASN1Tag;
  }
  if (isASN1Type(t, { EXPLICIT: 'unknown', t: 'ANY' })) {
    return t.EXPLICIT as unknown as ASN1Tag;
  }
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
