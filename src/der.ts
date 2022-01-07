import { CONCAT, isObject } from 'utility';
import {
  ASN1Tag,
  ASN1TagNumber,
  ASN1Type,
  ASN1Type_to_ASN1Tag,
  ASN1Value,
  eqASN1Tag,
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

function ASN1Type_to_DERMethod(t: ASN1Type): DERMethod {
  if (t === 'ANY') throw new TypeError('ANY  は DER encode できません');
  if (
    t === 'BOOLEAN' ||
    t === 'INTEGER' ||
    t === 'BIT STRING' ||
    t === 'OCTET STRING' ||
    t === 'NULL' ||
    t === 'OBJECT IDENTIFIER' ||
    t === 'UTCTime'
  )
    return 'Primitive';
  if ('EXPLICIT' in t || 'SEQUENCE' in t || 'SEQUENCEOF' in t || 'SETOF' in t) return 'Constructed';
  if ('IMPLICIT' in t) return ASN1Type_to_DERMethod(t.t);
  if ('CHOICE' in t) throw new TypeError(`${JSON.stringify(t)} は DER encode できない`);
  throw new TypeError(`ASN1Type_to_DERMethod(${JSON.stringify(t)}) has not been implmented`);
}

type IdentifierOctets = Uint8Array & { _brand: 'IdentifierOctets' };
type LengthOctets = Uint8Array & { _brand: 'LengthOctets' };
type ContentsOctets = Uint8Array & { _brand: 'ContentsOctets' };

const DER = {
  encode: (asn1: ASN1Value): Uint8Array => serialize(encodeDER(asn1)),
  decode: <T extends ASN1Type>(der: Uint8Array, t: T): ASN1Value<T> => {
    const x = decodeDER(der, t);
    // 乱暴な型キャスト
    return x.asn1 as ASN1Value<T>;
  },
};

const serialize = (x: {
  id: IdentifierOctets;
  len: LengthOctets;
  contents: ContentsOctets;
}): Uint8Array => CONCAT(CONCAT(x.id, x.len), x.contents);

function encodeDER(asn1: ASN1Value): {
  id: IdentifierOctets;
  len: LengthOctets;
  contents: ContentsOctets;
} {
  const id = DERIdentifierOctets.encode(ASN1Type_to_ASN1Tag(asn1.t), ASN1Type_to_DERMethod(asn1.t));
  const ans = (contents: ContentsOctets) => ({
    id,
    len: DERLengthOctets.encode(contents.length),
    contents,
  });
  if (isASN1Value(asn1, 'NULL')) {
    const contents = DERContentsOctets_NULL.encode(asn1.v);
    return ans(contents);
  }
  if (isASN1Value(asn1, 'INTEGER')) {
    const contents = DERContentsOctets_INTEGER.encode(asn1.v);
    return ans(contents);
  }
  if (isASN1Value(asn1, 'IMPLICIT')) {
    const der = encodeDER({ v: asn1.v.v, t: asn1.t.t });
    return { id, len: der.len, contents: der.contents };
  }
  if (isASN1Value(asn1, 'EXPLICIT')) {
    const component = encodeDER({ v: asn1.v.v, t: asn1.t.t });
    const contents = serialize(component) as ContentsOctets;
    return ans(contents);
  }
  if (isASN1Value(asn1, 'SEQUENCE')) {
    const contents = asn1.t.order.reduce((prev, id) => {
      let t = asn1.t.SEQUENCE[id];
      if (t == null) throw new TypeError(`Unexpected null`);
      if (isObject(t) && 'OPTIONAL' in t) {
        if (asn1.v[id] == null) {
          return prev;
        }
        t = t.OPTIONAL;
      }
      const component = encodeDER({ v: asn1.v[id], t });
      return CONCAT(prev, serialize(component));
    }, new Uint8Array()) as ContentsOctets;
    return ans(contents);
  }
  if (isASN1Value(asn1, 'SEQUENCEOF')) {
    const contents = asn1.v.reduce<ContentsOctets>((prev, v) => {
      const component = encodeDER({ t: asn1.t.SEQUENCEOF, v });
      return CONCAT(prev, serialize(component)) as ContentsOctets;
    }, new Uint8Array() as ContentsOctets);
    return ans(contents);
  }
  throw new TypeError('not implemented');
}

function decodeDER(der: Uint8Array, t: ASN1Type): { asn1: ASN1Value; entireLen: number } {
  const { tag, method, entireLen: leni } = DERIdentifierOctets.decode(der as IdentifierOctets);
  if (!eqASN1Tag(ASN1Type_to_ASN1Tag(t), tag)) {
    console.log(tag);
    throw new TypeError(`パースエラー。 ${JSON.stringify(t)} としてバイナリを解析できない`);
  }
  const der_len = der.slice(leni) as LengthOctets;
  const { contentsLength, entireLen: lenl } = DERLengthOctets.decode(der_len);
  const entireLen = leni + lenl + contentsLength;
  const der_contents = der.slice(leni + lenl, entireLen) as ContentsOctets;
  if (isASN1Type(t, 'NULL')) {
    const v = DERContentsOctets_NULL.decode(der_contents);
    const asn1: ASN1Value<typeof t> = { t, v };
    return { asn1, entireLen };
  }
  if (isASN1Type(t, 'INTEGER')) {
    const v = DERContentsOctets_INTEGER.decode(der_contents);
    const asn1: ASN1Value<typeof t> = { t, v };
    return { asn1, entireLen };
  }
  if (isASN1Type(t, 'IMPLICIT')) {
    const identifierOctets = DERIdentifierOctets.encode(ASN1Type_to_ASN1Tag(t.t), method);
    const { asn1: component } = decodeDER(CONCAT(identifierOctets, der_len), t.t);
    const asn1: ASN1Value<typeof t> = { t, v: { v: component.v } };
    return { asn1, entireLen };
  }
  if (isASN1Type(t, 'EXPLICIT')) {
    const { asn1: component } = decodeDER(der_contents, t.t);
    const asn1: ASN1Value<typeof t> = { t, v: { v: component.v } };
    return { asn1, entireLen };
  }
  if (isASN1Type(t, 'SEQUENCE')) {
    let v: Partial<ASN1Value<typeof t>['v']> = {};
    let start = 0;
    for (const id of t.order) {
      let tt = t.SEQUENCE[id];
      if (tt == null) throw new TypeError(`Unexpected null`);
      if (isObject(tt) && 'OPTIONAL' in tt) {
        const { tag: ttag } = DERIdentifierOctets.decode(
          der_contents.slice(start) as IdentifierOctets
        );
        if (!eqASN1Tag(ASN1Type_to_ASN1Tag(tt.OPTIONAL), ttag)) {
          continue;
        }
        tt = tt.OPTIONAL;
      }
      const { asn1: component, entireLen: tlen } = decodeDER(der_contents.slice(start), tt);
      v = { ...v, [id]: component.v };
      start += tlen;
    }
    const asn1: ASN1Value<typeof t> = { v, t };
    if (!isASN1Value(asn1, t)) {
      throw new TypeError('SEQUENCE のデコードに失敗');
    }
    return { asn1, entireLen };
  }
  if (isASN1Type(t, 'SEQUENCEOF')) {
    const v: unknown[] = [];
    for (let start = 0; start < contentsLength; ) {
      console.log(der_contents, start);
      const { asn1: component, entireLen: tlen } = decodeDER(
        der_contents.slice(start),
        t.SEQUENCEOF
      );
      v.push(component.v);
      start += tlen;
    }
    const asn1: ASN1Value<typeof t> = { v, t };
    if (!isASN1Value(asn1, t)) {
      throw new TypeError('SEQUENCEOF のデコードに失敗');
    }
    return { asn1, entireLen };
  }
  throw new TypeError(`decodeDER(asn1type: ${JSON.stringify(t)}) has been not implemented`);
}

const DERIdentifierOctets = {
  encode: (tag: ASN1Tag, method: DERMethod): IdentifierOctets => {
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
      return new Uint8Array([first_octet]) as IdentifierOctets;
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
    return new Uint8Array([first_octet, ...numlistBasedOnRasix.reverse()]) as IdentifierOctets;
  },
  decode: (octets: IdentifierOctets): { tag: ASN1Tag; method: DERMethod; entireLen: number } => {
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
      return { tag: { c, n: bits5_1 as ASN1TagNumber }, method, entireLen: 1 };
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
    return { tag: { c, n: num as ASN1TagNumber }, method, entireLen: last + 1 };
  },
};

const DERLengthOctets = {
  encode: (contentsOctetLength: number): LengthOctets => {
    if (contentsOctetLength < 128) {
      return new Uint8Array([contentsOctetLength]) as LengthOctets;
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
    return new Uint8Array([first_octet, ...lenList.reverse()]) as LengthOctets;
  },
  decode: (octets: LengthOctets): { contentsLength: number; entireLen: number } => {
    if (octets[0] == null) throw new TypeError('正しい DER Length Octets を与えてください。');
    if (octets[0] < 128) {
      return { contentsLength: octets[0], entireLen: 1 };
    }
    const lenOctetsLength = octets[0] & 0x7f;
    let len = 0;
    for (let idx = 0; idx < lenOctetsLength; idx++) {
      const oct = octets[idx + 1];
      if (oct == null) throw new TypeError('DER Length Octets の encoding で long format error');
      len = (len << 8) + oct;
    }
    return { contentsLength: len, entireLen: lenOctetsLength + 1 };
  },
};

const DERContentsOctets_INTEGER = {
  encode: (v: bigint): ContentsOctets => {
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
    return new Uint8Array(octets) as ContentsOctets;
  },
  decode: (octets: ContentsOctets): bigint => {
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  encode: (_v: undefined): ContentsOctets => new Uint8Array() as ContentsOctets,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  decode: (_octets: ContentsOctets): undefined => undefined,
};
