import { ASN1Value, checkASN1Value, checkType, Type } from 'asn1';
import { CONCAT, converRadix, UTF8, UTF8_DECODE } from 'utility';

export type ContentsOctets = Uint8Array & { _brand: 'ContentsOctets' };

export const DERContentsOctets = {
  encode: (asn1: ASN1Value): ContentsOctets => {
    if (checkASN1Value(asn1, 'BOOLEAN')) {
      return DERContentsOctets_BOOLEAN.encode(asn1.value);
    }
    if (checkASN1Value(asn1, 'INTEGER')) {
      return DERContentsOctets_INTEGER.encode(asn1.value);
    }
    if (checkASN1Value(asn1, 'BIT STRING')) {
      return DERContentsOctets_BIT_STRING.encode(asn1.value);
    }
    if (checkASN1Value(asn1, 'OCTET STRING')) {
      return DERContentsOctets_OCTET_STRING.encode(asn1.value);
    }
    if (checkASN1Value(asn1, 'NULL')) {
      return DERContentsOctets_NULL.encode(asn1.value);
    }
    if (checkASN1Value(asn1, 'OBJECT IDENTIFIER')) {
      return DERContentsOctets_OBJECT_IDENTIFIER.encode(asn1.value);
    }
    if (checkASN1Value(asn1, 'UTCTime')) {
      return DERContentsOctets_UTCTIME.encode(asn1.value);
    }
    throw new TypeError(`${asn1} のエンコードには対応していない`);
  },
  decode: (octets: ContentsOctets, t: Type): ASN1Value => {
    if (checkType(t, 'BOOLEAN')) {
      return { type: t, value: DERContentsOctets_BOOLEAN.decode(octets) };
    }
    if (checkType(t, 'INTEGER')) {
      return { type: t, value: DERContentsOctets_INTEGER.decode(octets) };
    }
    if (checkType(t, 'BIT STRING')) {
      return { type: t, value: DERContentsOctets_BIT_STRING.decode(octets) };
    }
    if (checkType(t, 'OCTET STRING')) {
      return { type: t, value: DERContentsOctets_OCTET_STRING.decode(octets) };
    }
    if (checkType(t, 'NULL')) {
      return { type: t, value: DERContentsOctets_NULL.decode(octets) };
    }
    if (checkType(t, 'OBJECT IDENTIFIER')) {
      return { type: t, value: DERContentsOctets_OBJECT_IDENTIFIER.decode(octets) };
    }
    if (checkType(t, 'UTCTime')) {
      return { type: t, value: DERContentsOctets_UTCTIME.decode(octets) };
    }
    throw new TypeError(`${t} のエンコードに対応していない`);
  },
};

const DERContentsOctets_BOOLEAN = {
  encode: (v: boolean): ContentsOctets => {
    return new Uint8Array([v ? 255 : 0]) as ContentsOctets;
  },
  decode: (octets: ContentsOctets): boolean => {
    return octets[0] === 255;
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

const DERContentsOctets_BIT_STRING = {
  encode: (v: Uint8Array): ContentsOctets => {
    return CONCAT(new Uint8Array([0]), v) as ContentsOctets;
  },
  decode: (octets: ContentsOctets): Uint8Array => {
    if (octets[0] == null) throw new TypeError('Unexpected Error');
    if (octets[0] === 0) return octets.slice(1);
    const contentWithPadEnd = octets
      .slice(1)
      .reduce((sum, i) => sum + i.toString(2).padStart(8, '0'), '');
    const content = contentWithPadEnd.slice(0, contentWithPadEnd.length - octets[0]);
    const contentWithPadStart = '0'.repeat(octets[0]) + content;
    const ans = new Uint8Array(contentWithPadStart.length / 8);
    for (let i = 0; i < ans.length; i++) {
      ans[i] = parseInt(contentWithPadStart.substring(i * 8, (i + 1) * 8), 2);
    }
    return ans;
  },
};

const DERContentsOctets_OCTET_STRING = {
  encode: (v: Uint8Array): ContentsOctets => v as ContentsOctets,
  decode: (octets: ContentsOctets): Uint8Array => octets,
};

const DERContentsOctets_NULL = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  encode: (v: undefined): ContentsOctets => new Uint8Array() as ContentsOctets,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  decode: (octets: ContentsOctets): undefined => undefined,
};

const DERContentsOctets_OBJECT_IDENTIFIER = {
  encode: (v: number[]): ContentsOctets => {
    let ans: Uint8Array;
    {
      if (v[0] == null) throw new TypeError('Unexpected Null');
      if (v[1] == null) {
        return new Uint8Array([v[0] * 40]) as ContentsOctets;
      }
      ans = new Uint8Array([40 * v[0] + v[1]]);
    }
    v.slice(2).forEach((vi) => {
      ans = CONCAT(
        ans,
        new Uint8Array(
          converRadix(vi, 128).map((x, i, arr) => (i === arr.length - 1 ? x : x + 0x80))
        )
      );
    });
    return ans as ContentsOctets;
  },
  decode: (octets: ContentsOctets): number[] => {
    if (octets[0] == null) throw new TypeError('Unexpected Null');
    const ans: number[] = [];
    // the first octet has 40 * value1 + value2
    ans.push(Math.floor(octets[0] / 40));
    ans.push(octets[0] % 40);
    const covertToNumber = (octets: Uint8Array): { vi: number; entireLen: number } => {
      let ans = 0;
      for (let i = 0; i < octets.length; i++) {
        const oi = octets[i];
        if (oi == null) return { vi: ans, entireLen: i };
        if (oi < 0x80) return { vi: ans * 0x80 + oi, entireLen: i + 1 };
        ans = ans * 0x80 + (oi - 0x80);
      }
      return { vi: ans, entireLen: octets.length };
    };
    let start = 1;
    do {
      const { vi, entireLen } = covertToNumber(octets.slice(start));
      ans.push(vi);
      start += entireLen;
    } while (start < octets.length);
    return ans;
  },
};

const DERContentsOctets_UTCTIME = {
  encode: (v: Date): ContentsOctets => {
    if (v.getFullYear() > 2049) throw new TypeError('Generalized Time を使用してください');
    const ans =
      `${v.getUTCFullYear() % 100}`.padStart(2, '0') +
      `${v.getUTCMonth() + 1}`.padStart(2, '0') +
      `${v.getUTCDate()}`.padStart(2, '0') +
      `${v.getUTCHours()}`.padStart(2, '0') +
      `${v.getUTCMinutes()}`.padStart(2, '0') +
      `${v.getUTCSeconds()}`.padStart(2, '0') +
      'Z';
    return UTF8(ans) as ContentsOctets;
  },
  decode: (octets: ContentsOctets): Date => {
    const utcstr = UTF8_DECODE(octets);
    const y = parseInt(utcstr.slice(0, 2));
    if (isNaN(y)) throw new TypeError('UTCTime の year パースに失敗');
    const m = parseInt(utcstr.slice(2, 4));
    if (isNaN(m)) throw new TypeError('UTCTime の month パースに失敗');
    const d = parseInt(utcstr.slice(4, 6));
    if (isNaN(d)) throw new TypeError('UTCTime の date パースに失敗');
    const h = parseInt(utcstr.slice(6, 8));
    if (isNaN(h)) throw new TypeError('UTCTime の hours パースに失敗');
    const min = parseInt(utcstr.slice(8, 10));
    if (isNaN(min)) throw new TypeError('UTCTime の minutie パースに失敗');
    const sec = parseInt(utcstr.slice(10, 12));
    if (isNaN(sec)) throw new TypeError('UTCTime の seconds パースに失敗');
    if (!utcstr.slice(12).startsWith('Z')) throw new TypeError('UTCTime パースに失敗');
    return new Date(Date.UTC(y > 49 ? y + 1900 : y + 2000, m - 1, d, h, min, sec));
  },
};
