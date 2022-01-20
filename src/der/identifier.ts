import { Tag, TagNumber } from 'asn1/tag';
import { converRadix } from 'utility';
import { DERMethod } from './method';

export type IdentifierOctets = Uint8Array & { _brand: 'IdentifierOctets' };

export const DERIdentifierOctets = {
  encode,
  decode,
};

function encode(tag: Tag, method: DERMethod): IdentifierOctets {
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
  const numlistBasedOnRasix = converRadix(tag.n, 128);
  return new Uint8Array([first_octet, ...numlistBasedOnRasix]) as IdentifierOctets;
}

function decode(octets: IdentifierOctets): { tag: Tag; method: DERMethod; entireLen: number } {
  if (octets[0] == null) throw new TypeError('与えられた IdentifierOctets は 0byte目すらない');
  let c: Tag['c'];
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
    return { tag: { c, n: bits5_1 as TagNumber }, method, entireLen: 1 };
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
  return { tag: { c, n: num as TagNumber }, method, entireLen: last + 1 };
}
