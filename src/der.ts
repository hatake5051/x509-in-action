import { CONCAT } from 'utility';
import {
  ASN1Tag,
  ASN1TagNumber,
  ASN1Type,
  ASN1Type_to_ASN1Tag,
  ASN1Value,
  equalsASN1Tag,
  isASN1Type,
  isASN1Value,
} from './asn1';

export { DER };

/**
 * @file
 * Distinguished Encoding Rules for ASN.1 (DER) は BER のサブセットで、
 * オクテット文字列として任意の ASN.1 value を一意に表現する方法を与える。
 * BER に次の制約を課す
 * - length が 0~127 なら short form を使う
 * - length が 128~ なら long form で最小オクテット数で表現
 * - simple string types とそれに派生する implicitly tagged types では the primitive, definite-length method
 * - structured types とそれに派生する tagged type は constructed では constructed, definite-length method
 * - あとは type ごとにいくつか
 *
 * Basic Encoding Rules for ASN.1 (BER) はオクテット文字列として任意の ASN.1 values を表現する方法を与える。
 * BER では ASN.1 values をエンコードするために３つの methods があり、 どれを選ぶかは value の型と、
 * value の長さが既知かどうかによって決まる。
 * - primitive, definite-length encoding
 * - constructed, definite-length encoding
 * - constructed, indefinite-length encoding
 *
 * BER encoding は3,4 つのパートを持つ
 * - Identifier octets: その ASN.1 value の the class and tag number を識別し、
 * そのメソッドが primitive か constructed かどうか示す
 * - Length octets: definite-length method ならコンテンツのオクテット長を表現し、
 * infinite-length method では length が idefinite であることを示す
 * - Contents octets: primiteve method では the value の具体的な表現を与え、
 * constructed method では the value の要素の BER encoding を連結したものを与える
 * - End-of-contents octets: indefinite-length method ではコンテンツの終わりを表し、
 * それ以外では使わない
 *
 * Primitive, difinite-length method
 * - simple types と implicit tagging で simple types から派生した types に適用する
 * - the value の長さが既知であることが必要
 * - Identifier octets: ２つの形式がある
 *   - low tag number (0 ~ 30) form
 *     - 1 octet で表現。 bit 8 と 7 で class を表現し、 bit 6 が "0" で primitive encoding であることを表す。
 *     - class の表現 00: universal, 01: application, 10: context-specific, 11: primitive
 *     - bits 5-1 で tag number を表現
 *   - high tag number (31 ~ ) form
 *     - ２つ以上の octets で表現。 1st octet は low-tag-number と同じ感じだけど、bits 5-1 が "11111" 。
 *     - 後続の octets で tag number を表現、 128 進数で。可能な限り少ない桁で
 * - Length octets: ２つの形式がある
 *   - short (0~127 の長さ) form:1 octet で表現。 bit 8 が "0" で残りが長さ
 *   - long definite (0 ~ 2^1008 -1 の長さ) form: 2 ~ 127 octet で表現。
 *     - 1st octet の bit 8 が "1" で bits 7-1 が additional length octets の数を表す
 *     - 256 進数で表現していく、可能な限り少ない桁で。
 * - Contents octets: value の具体的な表現
 *
 * Constructed, definite-length method
 * - simple string types と structured types 、 implicit tagging で simple string types と
 * structured types から派生した types と、 explicit tagging で派生した types に適用する
 * - the value の長さが既知であることが必要
 * - Identifier octets: 前と一緒で、 bit 6 が "1" で constructed encoding であることを示す。
 * - Length octets: 前と一緒。
 *
 * Constructed, indefinite-length method
 * - 上と同じだけど the value の値が既知ではない時
 * - Length octets: one octet 80
 * - end of contents octets: two octets 00 00
 *
 *
 * [実装]DER に必要なものだけ実装していく。
 */
type DERMethod = 'Primitive' | 'Constructed';

const DER = {
  encode: (
    asn1: ASN1Value
  ): {
    identifier: Uint8Array;
    length: Uint8Array;
    contents: Uint8Array;
  } => {
    if (isASN1Value(asn1, 'NULL')) {
      const contentsOctets = DERContentsOctets_NULL.encode(asn1.v);
      const identifierOctets = DERIdentifierOctets.encode(ASN1Type_to_ASN1Tag(asn1.t), 'Primitive');
      const lengthOctets = DERLengthOctets.encode(contentsOctets.length);
      return {
        identifier: identifierOctets,
        length: lengthOctets,
        contents: contentsOctets,
      };
    }
    if (isASN1Value(asn1, 'INTEGER')) {
      const contentsOctets = DERContentsOctets_INTEGER.encode(asn1.v);
      console.log(contentsOctets, asn1);
      const identifierOctets = DERIdentifierOctets.encode(ASN1Type_to_ASN1Tag(asn1.t), 'Primitive');
      const lengthOctets = DERLengthOctets.encode(contentsOctets.length);
      return {
        identifier: identifierOctets,
        length: lengthOctets,
        contents: contentsOctets,
      };
    }
    if (isASN1Value(asn1, { IMPLICIT: 'unknown', t: 'ANY' })) {
      const der = DER.encode({ v: asn1.v.v, t: asn1.t.t });
      const { method } = DERIdentifierOctets.decode(der.identifier);
      const identifier = DERIdentifierOctets.encode(ASN1Type_to_ASN1Tag(asn1.t), method);
      return {
        identifier,
        length: der.length,
        contents: der.contents,
      };
    }
    if (isASN1Value(asn1, { EXPLICIT: 'unknown', t: 'ANY' })) {
      const contents = DER.encode({ v: asn1.v.v, t: asn1.t.t });
      const contentsOctets = CONCAT(
        contents.identifier,
        CONCAT(contents.length, contents.contents)
      );
      const identifierOctets = DERIdentifierOctets.encode(
        ASN1Type_to_ASN1Tag(asn1.t),
        'Constructed'
      );
      const lengthOctets = DERLengthOctets.encode(contentsOctets.length);
      return {
        identifier: identifierOctets,
        length: lengthOctets,
        contents: contentsOctets,
      };
    }
    throw new TypeError('not implemented');
  },
  decode: <T extends ASN1Type>(der: Uint8Array, t: T): ASN1Value<T> => {
    const { tag, method, last: lasti } = DERIdentifierOctets.decode(der);
    let start = lasti + 1;
    const { len, last: lastl } = DERLengthOctets.decode(der.slice(lasti + 1));
    start += lastl + 1;
    if (isASN1Type(t, 'NULL')) {
      if (!equalsASN1Tag(ASN1Type_to_ASN1Tag(t), tag)) {
        console.log(tag);
        throw new TypeError(`パースエラー。 ${JSON.stringify(t)} としてバイナリを解析できない`);
      }
      const v = DERContentsOctets_NULL.decode(der.slice(start, start + len));
      return { t, v } as ASN1Value<T>;
    }
    if (isASN1Type(t, 'INTEGER')) {
      if (!equalsASN1Tag(ASN1Type_to_ASN1Tag(t), tag)) {
        console.log(tag);
        throw new TypeError(`パースエラー。 ${JSON.stringify(t)} としてバイナリを解析できない`);
      }
      const v = DERContentsOctets_INTEGER.decode(der.slice(start, start + len));
      return { t, v } as ASN1Value<T>;
    }
    if (isASN1Type(t, { IMPLICIT: 'unknown', t: 'ANY' })) {
      const implicitTag = ASN1Type_to_ASN1Tag(t);
      if (!equalsASN1Tag(implicitTag, tag)) {
        throw new TypeError(`パースエラー。 ${JSON.stringify(t)} としてバイナリを解析できない`);
      }
      const identifierOctets = DERIdentifierOctets.encode(ASN1Type_to_ASN1Tag(t.t), method);
      const asn1 = DER.decode(CONCAT(identifierOctets, der.slice(lasti + 1)), t.t);
      return { t, v: { v: asn1.v } } as ASN1Value<T>;
    }
    if (isASN1Type(t, { EXPLICIT: 'unknown', t: 'ANY' })) {
      const explicitTag = ASN1Type_to_ASN1Tag(t);
      if (!equalsASN1Tag(explicitTag, tag)) {
        throw new TypeError(`パースエラー。 ${JSON.stringify(t)} としてバイナリを解析できない`);
      }
      const asn1 = DER.decode(der.slice(start, start + len), t.t);
      return { t, v: { v: asn1.v } } as ASN1Value<T>;
    }
    throw new TypeError('not implemented');
  },
};

const DERIdentifierOctets = {
  encode: (tag: ASN1Tag, method: DERMethod): Uint8Array => {
    let bits8_7: number;
    switch (tag.c) {
      case 'Universal':
        bits8_7 = 0b00;
        break;
      case 'Application':
        bits8_7 = 0b01;
        break;
      case 'Context Specific':
        bits8_7 = 0b10;
        break;
      case 'Private':
        bits8_7 = 0b11;
        break;
    }
    const bit6 = method === 'Primitive' ? 0b0 : 0b1;
    if (tag.n < 0x1f) {
      const bits5_1 = tag.n;
      const first_octet = (bits8_7 << 6) + (bit6 << 5) + bits5_1;
      return new Uint8Array([first_octet]);
    }
    const first_octet = (bits8_7 << 6) + (bit6 << 5) + 0x1f;
    let num = tag.n as number;
    const numlistBasedOnRasix = [];
    const radix = 128;
    while (num >= radix) {
      numlistBasedOnRasix.push(num % radix);
      num = Math.floor(num / radix);
    }
    numlistBasedOnRasix.push(num);
    return new Uint8Array([first_octet, ...numlistBasedOnRasix.reverse()]);
  },
  decode: (octets: Uint8Array): { tag: ASN1Tag; method: DERMethod; last: number } => {
    if (octets[0] == null) throw new TypeError('正しい DER Identifier Octets を与えてください。');
    let c: ASN1Tag['c'];
    const bits8_7 = (octets[0] & 0xc0) >> 6;
    switch (bits8_7) {
      case 0x0:
        c = 'Universal';
        break;
      case 0x1:
        c = 'Application';
        break;
      case 0x2:
        c = 'Context Specific';
        break;
      case 0x3:
        c = 'Private';
        break;
      default:
        throw new TypeError('DER Identifier Octets の tag class encoding は 00 ~ 11 の範囲のみ');
    }
    const bit6 = (octets[0] & 0x20) >> 5;
    const method: DERMethod = bit6 === 0 ? 'Primitive' : 'Constructed';
    const bits5_1 = octets[0] & 0x1f;
    if (bits5_1 < 0x1f) {
      return { tag: { c, n: bits5_1 as ASN1TagNumber }, method, last: 0 };
    }
    let last = 0;
    let num = 0;
    for (let idx = 1; idx < octets.length; idx++) {
      last++;
      const oct = octets[idx];
      if (oct == null)
        throw new TypeError(
          'DER Identifier Octets の tag number encoding で high-tag-number format error'
        );
      num = (num << 7) + (oct & 0x7f);
      if ((oct & 0x80) >> 7 === 0) {
        break;
      }
    }
    return { tag: { c, n: num as ASN1TagNumber }, method, last };
  },
};

const DERLengthOctets = {
  encode: (contentsOctetLength: number): Uint8Array => {
    if (contentsOctetLength < 128) {
      return new Uint8Array([contentsOctetLength]);
    }
    let len = contentsOctetLength;
    const lenList = [];
    const radix = 256;
    while (len >= radix) {
      lenList.push(len % radix);
      len = Math.floor(len / radix);
    }
    lenList.push(len);
    const lenListLength = lenList.length;
    const first_octet = (1 << 7) + lenListLength;
    return new Uint8Array([first_octet, ...lenList.reverse()]);
  },
  decode: (octets: Uint8Array): { len: number; last: number } => {
    if (octets[0] == null) throw new TypeError('正しい DER Length Octets を与えてください。');
    if (octets[0] < 128) {
      return { len: octets[0], last: 0 };
    }
    const lenOctetsLength = octets[0] & 0x7f;
    let len = 0;
    for (let idx = 0; idx < lenOctetsLength; idx++) {
      const oct = octets[idx + 1];
      if (oct == null) throw new TypeError('DER Length Octets の encoding で long format error');
      len = (len << 8) + oct;
    }
    return { len, last: lenOctetsLength };
  },
};

const DERContentsOctets_INTEGER = {
  encode: (v: bigint): Uint8Array => {
    // 整数の値を２の補数表現で表す。
    let str: string;
    if (v < 0n) {
      str = ((1n << BigInt((-v).toString(2).length)) + v).toString(16);
      if (str.length % 2 === 1) {
        str = 'f' + str;
      } else if (['0', '1', '2', '3', '4', '5', '6', '7'].some((s) => str.startsWith(s))) {
        // 正の数と区別するため
        str = 'ff' + str;
      }
    } else {
      str = v.toString(16);
      if (str.length % 2 === 1) {
        str = '0' + str;
      } else if (['8', '9', 'a', 'b', 'c', 'd', 'f'].some((s) => str.startsWith(s))) {
        // 負の数と区別するため
        str = '00' + str;
      }
    }
    const octets = [];
    for (let i = 0; i < str.length / 2; i++) {
      const oct = parseInt(str.substring(i * 2, i * 2 + 2), 16);
      octets.push(oct);
    }
    return new Uint8Array(octets);
  },
  decode: (octets: Uint8Array): bigint => {
    let isNonNegative = true;
    const hexStr = Array.from(octets)
      .map((e, i) => {
        if (i === 0 && e > 127) {
          isNonNegative = false;
          e = e & 0x7f;
        }
        let hexchar = e.toString(16);
        if (hexchar.length == 1) {
          hexchar = '0' + hexchar;
        }
        return hexchar;
      })
      .join('');
    if (isNonNegative) {
      return BigInt('0x' + hexStr);
    }
    const hexStr1 = Array.from(octets)
      .map((e, i) => {
        if (i !== 0) {
          return '00';
        }
        e = e & 0x80;
        return e.toString(16);
      })
      .join('');
    return BigInt('0x' + hexStr) - BigInt('0x' + hexStr1);
  },
};

const DERContentsOctets_NULL = {
  encode: (v: undefined): Uint8Array => {
    return new Uint8Array();
  },
  decode: (octets: Uint8Array): undefined => {
    return undefined;
  },
};
