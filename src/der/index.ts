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

import { ASN1Value, Type } from 'asn1';
import { CONCAT } from 'utility';
import { decode } from './decode';
import { encode } from './encode';

export const DER = {
  encode: (asn1: ASN1Value): Uint8Array => {
    const der = encode(asn1);
    return CONCAT(der.id, der.len, der.contents);
  },
  decode: <T extends Type>(der: Uint8Array, t: T): ASN1Value<T> =>
    decode(der, t).asn1 as ASN1Value<T>,
};
