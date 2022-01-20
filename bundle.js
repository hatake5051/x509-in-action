'use strict';

function converRadix(num, radix) {
    const ans = [];
    while (num >= radix) {
        ans.push(num % radix);
        num = Math.floor(num / radix);
    }
    ans.push(num);
    ans.reverse();
    return ans;
}
/**
 * 複数のバイト列を結合する
 * @param arrays
 * @returns arrays を平滑化する
 */
function CONCAT(...arrays) {
    return arrays.reduce((A, B) => {
        const ans = new Uint8Array(A.length + B.length);
        ans.set(A);
        ans.set(B, A.length);
        return ans;
    }, new Uint8Array());
}
/**
 * 文字列を UTF8 バイトエンコードする。(string to Uint8Array)
 * @param {string} STRING - 文字列
 * @return {Uint8Array} UTF8 バイト列
 */
function UTF8(STRING) {
    const encoder = new TextEncoder();
    return encoder.encode(STRING);
}
/**
 * 文字列に UTF8 バイトデコードする (Uint8Array to string)
 * @param {Uint8Array} OCTETS - UTF8 バイト列
 * @return {string} 文字列
 */
function UTF8_DECODE(OCTETS) {
    const decoder = new TextDecoder();
    return decoder.decode(OCTETS);
}
/**
 * value を WouldBE<T> かどうか判定する。
 * T のプロパティを持つかもしれないところまで。
 * ref: https://qiita.com/suin/items/e0f7b7add75092196cd8
 * @template T
 * @param {unknown} value - 型ガード対象の値
 * @return {value is WouldBe<T>} value が WouldBe<T> なら true
 */
const isObject = (value) => typeof value === 'object' && value !== null;

const CHOICE = (s) => ({ CHOICE: s });
const isOtherType = (arg) => (isObject(arg) &&
    isObject(arg.ANY) &&
    (arg.ANY.DEFIEND_BY == null || typeof arg.ANY.DEFIEND_BY === 'string') &&
    (arg.ANY.typeDerive == null || typeof arg.ANY.typeDerive === 'function')) ||
    (isObject(arg) &&
        isObject(arg.CHOICE) &&
        Object.values(arg.CHOICE).every((t) => isType(t)));
function checkOtherType(t, n) {
    if (n == null)
        return typeof t === 'object' && ('ANY' in t || 'CHOICE' in t);
    return typeof t === 'object' && n in t;
}
function eqOtherType(l, r) {
    if (l == null && r == null)
        return true;
    if (l == null || r == null)
        return false;
    if ('ANY' in l || 'ANY' in r)
        return true;
    if ('CHOICE' in l) {
        return ('CHOICE' in r &&
            Object.entries(l.CHOICE).every(([li, lt]) => eqType(lt, r.CHOICE[li])) &&
            Object.entries(r.CHOICE).every(([ri, rt]) => eqType(l.CHOICE[ri], rt)));
    }
    return false;
}
const isOtherTypeName = (arg) => ['ANY', 'CHOICE'].some((x) => x === arg);
const OtherNameFromType = (t) => {
    if ('ANY' in t)
        return 'ANY';
    if ('CHOICE' in t)
        return 'CHOICE';
    throw new TypeError('Unexpected flow');
};
function isOtherValue(arg, t) {
    if ('CHOICE' in t) {
        return (isObject(arg) &&
            Object.values(t.CHOICE).some((t) => isValue(arg.CHOICE, t)));
    }
    if ('ANY' in t) {
        return isObject(arg);
    }
    return false;
}

const SimpleTypeList = [
    'BOOLEAN',
    'INTEGER',
    'BIT STRING',
    'OCTET STRING',
    'NULL',
    'OBJECT IDENTIFIER',
    'UTCTime',
];
const isSimpleType = (arg) => SimpleTypeList.some((t) => arg === t);
const checkSimpleType = (t, n) => {
    if (n == null)
        return isSimpleType(t);
    return t === n;
};
const isSimpleTypeName = isSimpleType;
function isSimpleValue(arg, t) {
    if (t == null) {
        return (typeof arg === 'bigint' ||
            arg instanceof Uint8Array ||
            arg == null ||
            (Array.isArray(arg) && arg.every((x) => typeof x === 'number')) ||
            arg instanceof Date ||
            typeof arg === 'boolean' ||
            arg instanceof Uint8Array);
    }
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
            return arg instanceof Date;
        case 'BOOLEAN':
            return typeof arg === 'boolean';
        case 'OCTET STRING':
            return arg instanceof Uint8Array;
        default:
            return false;
    }
}

const SEQUENCE = (s, order) => ({ SEQUENCE: s, order });
const SEQUENCEOF = (s) => ({ SEQUENCEOF: s });
const SETOF = (s) => ({ SETOF: s });
function isStructuredType(arg) {
    if (isObject(arg) && 'SEQUENCE' in arg) {
        return (Array.isArray(arg.order) &&
            arg.order.every((k) => typeof k === 'string') &&
            isObject(arg.SEQUENCE) &&
            Object.entries(arg.SEQUENCE).every(([k, v]) => arg.order.includes(k) &&
                ((isObject(v) && 'OPTIONAL' in v && isType(v.OPTIONAL)) ||
                    isType(v))));
    }
    if (isObject(arg) && 'SEQUENCEOF' in arg) {
        return isType(arg.SEQUENCEOF);
    }
    if (isObject(arg) && 'SETOF' in arg) {
        return isType(arg.SETOF);
    }
    return false;
}
function checkStructuredType(t, n) {
    if (n == null)
        return typeof t === 'object' && ('SEQUENCE' in t || 'SEQUENCEOF' in t || 'SETOF' in t);
    return typeof t === 'object' && n in t;
}
function eqStructuredType(l, r) {
    if (l == null && r == null)
        return true;
    if (l == null || r == null)
        return false;
    if ('SEQUENCE' in l) {
        return ('SEQUENCE' in r &&
            new Set(l.order).size === new Set(r.order).size &&
            l.order.every((li) => {
                const lv = l.SEQUENCE[li];
                const rv = l.SEQUENCE[li];
                return (r.order.includes(li) &&
                    eqType(isObject(lv) && 'OPTIONAL' in lv ? lv.OPTIONAL : lv, isObject(rv) && 'OPTIONAL' in rv ? rv.OPTIONAL : rv));
            }));
    }
    if ('SEQUENCEOF' in l) {
        return 'SEQUENCEOF' in r && eqType(l.SEQUENCEOF, r.SEQUENCEOF);
    }
    if ('SETOF' in l) {
        return 'SETOF' in r && eqType(l.SETOF, r.SETOF);
    }
    return false;
}
const isStructuredTypeName = (arg) => ['SEQUENCE', 'SEQUENCEOF', 'SETOF'].some((x) => x === arg);
const StructuredNameFromType = (t) => {
    if ('SEQUENCE' in t)
        return 'SEQUENCE';
    if ('SEQUENCEOF' in t)
        return 'SEQUENCEOF';
    if ('SETOF' in t)
        return 'SETOF';
    throw new TypeError('Unexpected Flow');
};
function isStructuredValue(arg, t) {
    if ('SEQUENCE' in t) {
        return (isObject(arg) &&
            Object.entries(arg).every(([k, v]) => {
                if (!t.order.includes(k))
                    return false;
                const componentType = t.SEQUENCE[k];
                if (componentType == null)
                    return false;
                if (isObject(componentType) && 'OPTIONAL' in componentType) {
                    return isValue(v, componentType.OPTIONAL);
                }
                return isValue(v, componentType);
            }));
    }
    if ('SEQUENCEOF' in t) {
        return Array.isArray(arg) && arg.every((v) => isValue(v, t.SEQUENCEOF));
    }
    if ('SETOF' in t) {
        return arg instanceof Set && [...arg].every((v) => isValue(v, t.SETOF));
    }
    return false;
}
// export function checkStructuredValue<N extends StructuredTypeName>(v: StructuredValue, n?: N): v is StructuredValue<StructuredTypeFromName<N>> {
//   if (n == null) {
//     return
//   }
// }

const isTag = (arg) => isObject(arg) && isTagClass(arg.c) && isTagNumber(arg.n);
function eqTag(l, r) {
    if (l == null && r == null)
        return true;
    if (l == null || r == null)
        return false;
    return l.c === r.c && l.n === r.n;
}
function TagFromType(t) {
    switch (NameFromType(t)) {
        case 'BOOLEAN':
            return { c: 'Universal', n: 1 };
        case 'INTEGER':
            return { c: 'Universal', n: 2 };
        case 'BIT STRING':
            return { c: 'Universal', n: 3 };
        case 'OCTET STRING':
            return { c: 'Universal', n: 4 };
        case 'NULL':
            return { c: 'Universal', n: 5 };
        case 'OBJECT IDENTIFIER':
            return { c: 'Universal', n: 6 };
        case 'UTCTime':
            return { c: 'Universal', n: 23 };
        case 'EXPLICIT':
            return t.EXPLICIT;
        case 'IMPLICIT':
            return t.IMPLICIT;
        case 'SEQUENCE':
        case 'SEQUENCEOF':
            return { c: 'Universal', n: 16 };
        case 'SETOF':
            return { c: 'Universal', n: 17 };
        default:
            throw new TypeError(`Type_toTag(${JSON.stringify(t)}) has not been implmented`);
    }
}
const isTagNumber = (arg) => typeof arg === 'number' && arg >= 0;
const isTagClass = (arg) => TagClassList.some((x) => x === arg);
const TagClassList = ['Universal', 'Application', 'Context Specific', 'Private'];

/**
 * Implicitly tagged types は基となる type の tag を変更することで他の types から派生する。
 * ASN.1 キーワードで "[class number] IMPLICIT" として表記される。
 * おおよその場合で、 "[class number]" のみの場合は implicitly tagged type の表記。
 */
const ImplicitTag = (tag, t) => {
    if (isTagNumber(tag))
        return { IMPLICIT: { c: 'Context Specific', n: tag }, t };
    if (isTag(tag))
        return { IMPLICIT: tag, t };
    throw new TypeError('不適切な引数です');
};
/**
 * Explicitly tagged types は基となる type に an outer tag を付加することで他の types から派生する。
 * 実質的に、 explicitly tagged types は基となる types を要素に持つ structured types である。
 * ASN.1 キーワードで "[class number] EXPLICIT" として表記される。
 */
const ExplicitTag = (tag, t) => {
    if (isTagNumber(tag))
        return { EXPLICIT: { c: 'Context Specific', n: tag }, t };
    if (isTag(tag))
        return { EXPLICIT: tag, t };
    throw new TypeError('不適切な引数です');
};
const isTaggedType = (arg) => (isObject(arg) && isTag(arg.IMPLICIT) && isType(arg.t)) ||
    (isObject(arg) && isTag(arg.EXPLICIT) && isType(arg.t));
const checkTaggedType = (t, n) => {
    if (n == null)
        return typeof t === 'object' && ('IMPLICIT' in t || 'EXPLICIT' in t);
    return typeof t === 'object' && n in t;
};
function eqTaggedType(l, r) {
    if (l == null && r == null)
        return true;
    if (l == null || r == null)
        return false;
    if ('IMPLICIT' in l) {
        return 'IMPLICIT' in r && eqTag(l.IMPLICIT, r.IMPLICIT) && eqType(l.t, r.t);
    }
    if ('EXPLICIT' in l) {
        return 'EXPLICIT' in r && eqTag(l.EXPLICIT, r.EXPLICIT) && eqType(l.t, r.t);
    }
    return false;
}
const isTaggedTypeName = (arg) => ['IMPLICIT', 'EXPLICIT'].some((x) => x === arg);
const TaggedNameFromType = (t) => {
    if ('EXPLICIT' in t)
        return 'EXPLICIT';
    if ('IMPLICIT' in t)
        return 'IMPLICIT';
    throw new TypeError('Unexpected flow');
};
function isTaggedValue(arg, t) {
    if ('IMPLICIT' in t) {
        return isObject(arg) && isValue(arg.IMPLICIT, t.t);
    }
    if ('EXPLICIT' in t) {
        return isObject(arg) && isValue(arg.EXPLICIT, t.t);
    }
    return false;
}

const isASN1Value = (arg) => isObject(arg) && isType(arg.type) && isValue(arg.value, arg.type);
function checkASN1Value(asn1, n) {
    return checkType(asn1.type, n);
}
const isType = (arg) => isSimpleType(arg) || isStructuredType(arg) || isTaggedType(arg) || isOtherType(arg);
function checkType(t, n) {
    if (n == null)
        return checkSimpleType(t) || checkStructuredType(t) || checkTaggedType(t) || checkOtherType(t);
    if (isSimpleTypeName(n))
        return checkSimpleType(t, n);
    if (isStructuredTypeName(n))
        return checkStructuredType(t, n);
    if (isTaggedTypeName(n))
        return checkTaggedType(t, n);
    if (isOtherTypeName(n))
        return checkOtherType(t, n);
    return false;
}
function eqType(l, r) {
    if (l == null && r == null)
        return true;
    if (l == null || r == null)
        return false;
    if (checkOtherType(l, 'ANY') || checkOtherType(r, 'ANY'))
        return true;
    if (checkSimpleType(l))
        return checkSimpleType(r) && l === r;
    if (checkTaggedType(l))
        return checkTaggedType(r) && eqTaggedType(l, r);
    if (checkStructuredType(l))
        return checkStructuredType(r) && eqStructuredType(l, r);
    if (checkOtherType(l, 'CHOICE'))
        return checkOtherType(r, 'CHOICE') && eqOtherType(l, r);
    return false;
}
const NameFromType = (t) => {
    if (checkSimpleType(t))
        return t;
    if (checkStructuredType(t))
        return StructuredNameFromType(t);
    if (checkTaggedType(t))
        return TaggedNameFromType(t);
    if (checkOtherType(t))
        return OtherNameFromType(t);
    throw new TypeError(`${JSON.stringify(t)} は ASN1 Type ではない`);
};
function isValue(arg, t) {
    if (checkSimpleType(t))
        return isSimpleValue(arg, t);
    if (checkStructuredType(t))
        return isStructuredValue(arg, t);
    if (checkTaggedType(t))
        return isTaggedValue(arg, t);
    if (checkOtherType(t))
        return isOtherValue(arg, t);
    return false;
}

const DERContentsOctets = {
    encode: (asn1) => {
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
    decode: (octets, t) => {
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
    encode: (v) => {
        return new Uint8Array([v ? 255 : 0]);
    },
    decode: (octets) => {
        return octets[0] === 255;
    },
};
const DERContentsOctets_INTEGER = {
    encode: (v) => {
        // 整数の値を２の補数表現で表す。
        let str;
        if (v < 0n) {
            str = ((1n << BigInt((-v).toString(2).length)) + v).toString(16);
            if (str.length % 2 === 1) {
                str = 'f' + str;
            }
            else if (['0', '1', '2', '3', '4', '5', '6', '7'].some((s) => str.startsWith(s))) {
                // 正の数と区別するため
                str = 'ff' + str;
            }
        }
        else {
            str = v.toString(16);
            if (str.length % 2 === 1) {
                str = '0' + str;
            }
            else if (['8', '9', 'a', 'b', 'c', 'd', 'f'].some((s) => str.startsWith(s))) {
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
    decode: (octets) => {
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
    encode: (v) => {
        return CONCAT(new Uint8Array([0]), v);
    },
    decode: (octets) => {
        if (octets[0] == null)
            throw new TypeError('Unexpected Error');
        if (octets[0] === 0)
            return octets.slice(1);
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
    encode: (v) => v,
    decode: (octets) => octets,
};
const DERContentsOctets_NULL = {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    encode: (v) => new Uint8Array(),
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    decode: (octets) => undefined,
};
const DERContentsOctets_OBJECT_IDENTIFIER = {
    encode: (v) => {
        let ans;
        {
            if (v[0] == null)
                throw new TypeError('Unexpected Null');
            if (v[1] == null) {
                return new Uint8Array([v[0] * 40]);
            }
            ans = new Uint8Array([40 * v[0] + v[1]]);
        }
        v.slice(2).forEach((vi) => {
            ans = CONCAT(ans, new Uint8Array(converRadix(vi, 128).map((x, i, arr) => (i === arr.length - 1 ? x : x + 0x80))));
        });
        return ans;
    },
    decode: (octets) => {
        if (octets[0] == null)
            throw new TypeError('Unexpected Null');
        const ans = [];
        // the first octet has 40 * value1 + value2
        ans.push(Math.floor(octets[0] / 40));
        ans.push(octets[0] % 40);
        const covertToNumber = (octets) => {
            let ans = 0;
            for (let i = 0; i < octets.length; i++) {
                const oi = octets[i];
                if (oi == null)
                    return { vi: ans, entireLen: i };
                if (oi < 0x80)
                    return { vi: ans * 0x80 + oi, entireLen: i + 1 };
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
    encode: (v) => {
        if (v.getFullYear() > 2049)
            throw new TypeError('Generalized Time を使用してください');
        const ans = `${v.getUTCFullYear() % 100}`.padStart(2, '0') +
            `${v.getUTCMonth() + 1}`.padStart(2, '0') +
            `${v.getUTCDate()}`.padStart(2, '0') +
            `${v.getUTCHours()}`.padStart(2, '0') +
            `${v.getUTCMinutes()}`.padStart(2, '0') +
            `${v.getUTCSeconds()}`.padStart(2, '0') +
            'Z';
        return UTF8(ans);
    },
    decode: (octets) => {
        const utcstr = UTF8_DECODE(octets);
        const y = parseInt(utcstr.slice(0, 2));
        if (isNaN(y))
            throw new TypeError('UTCTime の year パースに失敗');
        const m = parseInt(utcstr.slice(2, 4));
        if (isNaN(m))
            throw new TypeError('UTCTime の month パースに失敗');
        const d = parseInt(utcstr.slice(4, 6));
        if (isNaN(d))
            throw new TypeError('UTCTime の date パースに失敗');
        const h = parseInt(utcstr.slice(6, 8));
        if (isNaN(h))
            throw new TypeError('UTCTime の hours パースに失敗');
        const min = parseInt(utcstr.slice(8, 10));
        if (isNaN(min))
            throw new TypeError('UTCTime の minutie パースに失敗');
        const sec = parseInt(utcstr.slice(10, 12));
        if (isNaN(sec))
            throw new TypeError('UTCTime の seconds パースに失敗');
        if (!utcstr.slice(12).startsWith('Z'))
            throw new TypeError('UTCTime パースに失敗');
        return new Date(Date.UTC(y > 49 ? y + 1900 : y + 2000, m - 1, d, h, min, sec));
    },
};

const DERIdentifierOctets = {
    encode: encode$2,
    decode: decode$2,
};
function encode$2(tag, method) {
    let bits8_7;
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
    const numlistBasedOnRasix = converRadix(tag.n, 128);
    return new Uint8Array([first_octet, ...numlistBasedOnRasix]);
}
function decode$2(octets) {
    if (octets[0] == null)
        throw new TypeError('与えられた IdentifierOctets は 0byte目すらない');
    let c;
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
    const method = bit6 === 0 ? 'Primitive' : 'Constructed';
    const bits5_1 = octets[0] & 0x1f;
    if (bits5_1 < 0x1f) {
        return { tag: { c, n: bits5_1 }, method, entireLen: 1 };
    }
    let last = 0;
    let num = 0;
    for (let idx = 1; idx < octets.length; idx++) {
        last++;
        const oct = octets[idx];
        if (oct == null)
            throw new TypeError('DER Identifier Octets の tag number encoding で high-tag-number format error');
        num = (num << 7) + (oct & 0x7f);
        if ((oct & 0x80) >> 7 === 0) {
            break;
        }
    }
    return { tag: { c, n: num }, method, entireLen: last + 1 };
}

const DERLengthOctets = {
    encode: encode$1,
    decode: decode$1,
};
function encode$1(contentsOctetLength) {
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
}
function decode$1(octets) {
    if (octets[0] == null)
        throw new TypeError('正しい DER Length Octets を与えてください。');
    if (octets[0] < 128) {
        return { contentsLength: octets[0], entireLen: 1 };
    }
    const lenOctetsLength = octets[0] & 0x7f;
    let len = 0;
    for (let idx = 0; idx < lenOctetsLength; idx++) {
        const oct = octets[idx + 1];
        if (oct == null)
            throw new TypeError('DER Length Octets の encoding で long format error');
        len = (len << 8) + oct;
    }
    return { contentsLength: len, entireLen: lenOctetsLength + 1 };
}

function decode(der, t, ctx) {
    if (checkType(t, 'ANY')) {
        if (t.ANY.typeDerive == null)
            throw new TypeError('ANY の actual Type を決定できない');
        const actualType = t.ANY.typeDerive(ctx?.parentSEQUENCE == null || t.ANY.DEFIEND_BY == null
            ? undefined
            : ctx.parentSEQUENCE[t.ANY.DEFIEND_BY]);
        return decode(der, actualType);
    }
    if (checkType(t, 'CHOICE')) {
        for (const innerType of Object.values(t.CHOICE)) {
            try {
                const { asn1: inner, entireLen } = decode(der, innerType, ctx);
                return {
                    asn1: { type: t, value: { CHOICE: inner.value } },
                    entireLen,
                };
            }
            catch (e) {
                continue;
            }
        }
        throw new TypeError(`パースエラー。 CHOICE のいずれの型を用いても解析できない`);
    }
    const { tag, method, entireLen: leni } = DERIdentifierOctets.decode(der);
    if (!eqTag(TagFromType(t), tag)) {
        throw new TypeError(`パースエラー。expected: tag of ${JSON.stringify(t)}, but actual: ${tag} `);
    }
    const der_len = der.slice(leni);
    const { contentsLength, entireLen: lenl } = DERLengthOctets.decode(der_len);
    const entireLen = leni + lenl + contentsLength;
    const der_contents = der.slice(leni + lenl, entireLen);
    if (checkType(t, 'IMPLICIT')) {
        const identifierOctets = DERIdentifierOctets.encode(TagFromType(t.t), method);
        const { asn1: component } = decode(CONCAT(identifierOctets, der_len), t.t, ctx);
        const asn1 = { type: t, value: { IMPLICIT: component.value } };
        return { asn1, entireLen };
    }
    if (checkType(t, 'EXPLICIT')) {
        const { asn1: component } = decode(der_contents, t.t, ctx);
        const asn1 = { type: t, value: { EXPLICIT: component.value } };
        return { asn1, entireLen };
    }
    if (checkType(t, 'SEQUENCE')) {
        let value = {};
        let start = 0;
        for (const id of t.order) {
            if (der_contents.length <= start) {
                break;
            }
            let tt = t.SEQUENCE[id];
            if (tt == null)
                throw new TypeError(`Unexpected null`);
            if (typeof tt === 'object' && 'OPTIONAL' in tt) {
                if (!checkType(tt.OPTIONAL, 'ANY')) {
                    const { tag: ttag } = DERIdentifierOctets.decode(der_contents.slice(start));
                    if (!eqTag(TagFromType(tt.OPTIONAL), ttag)) {
                        continue;
                    }
                }
                tt = tt.OPTIONAL;
            }
            try {
                const { asn1: component, entireLen: tlen } = decode(der_contents.slice(start), tt, {
                    parentSEQUENCE: value,
                });
                value = { ...value, [id]: component.value };
                start += tlen;
            }
            catch (e) {
                if (checkType(tt, 'ANY'))
                    continue;
                throw e;
            }
        }
        const asn1 = { type: t, value };
        return { asn1, entireLen };
    }
    if (checkType(t, 'SEQUENCEOF')) {
        const value = [];
        for (let start = 0; start < contentsLength;) {
            const { asn1: component, entireLen: tlen } = decode(der_contents.slice(start), t.SEQUENCEOF);
            value.push(component.value);
            start += tlen;
        }
        const asn1 = { type: t, value };
        return { asn1, entireLen };
    }
    if (checkType(t, 'SETOF')) {
        const value = new Set();
        for (let start = 0; start < contentsLength;) {
            const { asn1: component, entireLen: tlen } = decode(der_contents.slice(start), t.SETOF);
            value.add(component.value);
            start += tlen;
        }
        const asn1 = { type: t, value };
        return { asn1, entireLen };
    }
    try {
        const asn1 = DERContentsOctets.decode(der_contents, t);
        return { asn1, entireLen };
    }
    catch (e) {
        throw new TypeError(`${t} のデコードには対応していない`);
    }
    throw new TypeError(`decodeDER(asn1type: ${JSON.stringify(t)}) has been not implemented`);
}

function DERMethodFromType(t) {
    if (t === 'BOOLEAN' ||
        t === 'INTEGER' ||
        t === 'BIT STRING' ||
        t === 'OCTET STRING' ||
        t === 'NULL' ||
        t === 'OBJECT IDENTIFIER' ||
        t === 'UTCTime')
        return 'Primitive';
    if ('EXPLICIT' in t || 'SEQUENCE' in t || 'SEQUENCEOF' in t || 'SETOF' in t)
        return 'Constructed';
    if ('IMPLICIT' in t)
        return DERMethodFromType(t.t);
    throw new TypeError(`DERMethodFromType(${JSON.stringify(t)}) に失敗`);
}

function encode(asn1, ctx) {
    if (checkASN1Value(asn1, 'ANY')) {
        const derive = asn1.type.ANY.typeDerive;
        if (derive == null)
            throw new TypeError('ANY の actual type を判断できません');
        const t = derive(asn1.type.ANY.DEFIEND_BY == null || ctx?.parentSEQUENCE == null
            ? undefined
            : ctx.parentSEQUENCE[asn1.type.ANY.DEFIEND_BY]);
        const actual = { type: t, value: asn1.value.ANY };
        if (!isASN1Value(actual))
            throw new TypeError('判断した actual type の actual value が一致しない');
        return encode(actual);
    }
    if (checkASN1Value(asn1, 'CHOICE')) {
        for (const t of Object.values(asn1.type.CHOICE)) {
            const actual = { type: t, value: asn1.value.CHOICE };
            if (!isASN1Value(actual)) {
                continue;
            }
            return encode(actual, ctx);
        }
        throw new TypeError('CHOICE のいずれの type も actual value と一致しなかった');
    }
    const id = DERIdentifierOctets.encode(TagFromType(asn1.type), DERMethodFromType(asn1.type));
    const ans = (contents) => ({
        id,
        len: DERLengthOctets.encode(contents.length),
        contents,
    });
    if (checkASN1Value(asn1, 'IMPLICIT')) {
        const inner = { type: asn1.type.t, value: asn1.value.IMPLICIT };
        if (!isASN1Value(inner))
            throw new TypeError('タグづけされた内部の value と type が一致しない');
        const der = encode(inner);
        return { id, len: der.len, contents: der.contents };
    }
    if (checkASN1Value(asn1, 'EXPLICIT')) {
        const inner = { type: asn1.type.t, value: asn1.value.EXPLICIT };
        if (!isASN1Value(inner))
            throw new TypeError('タグづけされた内部の value と type が一致しない');
        const der = serialize(encode(inner));
        return ans(der);
    }
    if (checkASN1Value(asn1, 'SEQUENCE')) {
        const contents = asn1.type.order.reduce((prev, id) => {
            let componentType = asn1.type.SEQUENCE[id];
            if (componentType == null)
                throw new TypeError(`Unexpected null`);
            if (typeof componentType === 'object' && 'OPTIONAL' in componentType) {
                if (asn1.value[id] == null) {
                    return prev;
                }
                componentType = componentType.OPTIONAL;
            }
            const component = { type: componentType, value: asn1.value[id] };
            if (!isASN1Value(component))
                throw new TypeError('SEQUENCE 内部の value と type が一致しない');
            const componentDER = serialize(encode(component, { parentSEQUENCE: asn1.value }));
            return CONCAT(prev, componentDER);
        }, new Uint8Array());
        return ans(contents);
    }
    if (checkASN1Value(asn1, 'SEQUENCEOF')) {
        const contents = asn1.value.reduce((prev, value) => {
            const component = { type: asn1.type.SEQUENCEOF, value };
            if (!isASN1Value(component))
                throw new TypeError('SEQUENCEOF 内部の value と type が一致しない');
            const componentDER = serialize(encode(component));
            return CONCAT(prev, componentDER);
        }, new Uint8Array());
        return ans(contents);
    }
    if (checkASN1Value(asn1, 'SETOF')) {
        const cmp = (l, r) => {
            for (let i = 0; i < l.length; i++) {
                const li = l[i];
                if (li == null)
                    break;
                const ri = r[i];
                if (ri == null)
                    return 'gt';
                if (li > ri)
                    return 'gt';
                if (li < ri)
                    return 'lt';
            }
            return 'eq';
        };
        const components = [];
        asn1.value.forEach((value) => {
            const component = { type: asn1.type.SETOF, value };
            if (!isASN1Value(component))
                throw new TypeError('SETOF 内部の value と type が一致しない');
            const componentDER = serialize(encode(component));
            let i = 0;
            for (; i < components.length; i++) {
                const ci = components[i];
                if (ci == null || cmp(componentDER, ci) === 'lt') {
                    break;
                }
            }
            components.splice(i, 0, componentDER);
        });
        return ans(CONCAT(...components));
    }
    try {
        return ans(DERContentsOctets.encode(asn1));
    }
    catch (e) {
        throw new TypeError(`${asn1} のエンコードには対応していない`);
    }
}
function serialize(x) {
    return CONCAT(x.id, x.len, x.contents);
}

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
const DER = {
    encode: (asn1) => {
        const der = encode(asn1);
        return CONCAT(der.id, der.len, der.contents);
    },
    decode: (der, t) => decode(der, t).asn1,
};

function BASE64(OCTETS) {
    // window 組み込みの base64 encode 関数
    // 組み込みの関数は引数としてバイナリ文字列を要求するため
    // Uint8Array をバイナリ文字列へと変換する
    const b_str = String.fromCharCode(...OCTETS);
    const base64_encode = window.btoa(b_str);
    return base64_encode;
}
const eq = (x, y) => {
    console.log(x, '===', y, '?', eqType(x, y));
    console.log(`${JSON.stringify(y)} === ${JSON.stringify(x)} ? ${eqType(y, x)}`);
};
console.group('NULL check');
eq('NULL', { ANY: {} });
const asn1_null = { type: 'NULL', value: undefined };
const der_null = DER.encode(asn1_null);
console.log(der_null, BASE64(der_null));
const decoded_null = DER.decode(der_null, 'NULL');
console.log(decoded_null);
console.groupEnd();
console.group('BOOLEAN check');
eq('BOOLEAN', { ANY: {} });
const asn1_boolean = { type: 'BOOLEAN', value: true };
const der_boolean = DER.encode(asn1_boolean);
console.log(der_boolean, BASE64(der_boolean));
const decoded_boolean = DER.decode(der_boolean, 'BOOLEAN');
console.log(decoded_boolean);
console.groupEnd();
console.group('INTEGER check');
eq('INTEGER', { ANY: {} });
const asn1_integer = { type: 'INTEGER', value: -129n };
const der_integer = DER.encode(asn1_integer);
console.log(der_integer, BASE64(der_integer));
const decoded_integer = DER.decode(der_integer, 'INTEGER');
console.log(decoded_integer);
console.groupEnd();
console.group('BIT STRING check');
eq('BIT STRING', { ANY: {} });
const asn1_bitstring = {
    type: 'BIT STRING',
    value: new Uint8Array([
        4, 41, 151, 167, 198, 65, 127, 192, 13, 155, 232, 1, 27, 86, 198, 242, 82, 165, 186, 45, 178,
        18, 232, 210, 46, 215, 250, 201, 197, 216, 170, 109, 31, 115, 129, 59, 59, 152, 107, 57, 124,
        51, 165, 197, 78, 134, 142, 128, 23, 104, 98, 69, 87, 125, 68, 88, 29, 179, 55, 229, 103, 8,
        235, 102, 222,
    ]),
};
const der_bitstring = DER.encode(asn1_bitstring);
console.log(der_bitstring, BASE64(der_bitstring));
const decoded_bitstring = DER.decode(der_bitstring, 'BIT STRING');
console.log(decoded_bitstring);
console.groupEnd();
console.group('OCTET STRING check');
const asn1_octetstring = {
    type: 'OCTET STRING',
    value: new Uint8Array([48, 3, 1, 1, 255]),
};
const der_octetstring = DER.encode(asn1_octetstring);
console.log(der_octetstring, BASE64(der_octetstring));
const decoded_octetstring = DER.decode(der_octetstring, 'OCTET STRING');
console.log(decoded_octetstring);
console.groupEnd();
console.group('OBJECT IDENTIFIER check');
const asn1_oid = {
    type: 'OBJECT IDENTIFIER',
    value: [1, 2, 840, 10045, 4, 3, 2],
};
const der_oid = DER.encode(asn1_oid);
console.log(der_oid, BASE64(der_oid));
const decoded_oid = DER.decode(der_oid, 'OBJECT IDENTIFIER');
console.log(decoded_oid);
console.groupEnd();
console.group('UTCTime check');
const asn1_utctime = {
    type: 'UTCTime',
    value: new Date(Date.UTC(2015, 5 - 1, 26)),
};
const der_utctime = DER.encode(asn1_utctime);
console.log(der_utctime, BASE64(der_utctime));
const decoded_utctime = DER.decode(der_utctime, 'UTCTime');
console.log(decoded_utctime);
console.groupEnd();
console.group('IMPLICIT check');
const implicitTagged = ImplicitTag(23, 'INTEGER');
const asn1_implicitTagged = {
    type: implicitTagged,
    value: { IMPLICIT: 65535n },
};
const der_implicitTagged = DER.encode(asn1_implicitTagged);
console.log(der_implicitTagged, BASE64(der_implicitTagged));
const decoded_implicitTagged = DER.decode(der_implicitTagged, implicitTagged);
console.log(decoded_implicitTagged);
console.groupEnd();
console.group('EXPLICIT check');
const explicitTagged = ExplicitTag(18, 'INTEGER');
const asn1_explicitTagged = {
    type: explicitTagged,
    value: { EXPLICIT: 12345n },
};
const der_explicitTagged = DER.encode(asn1_explicitTagged);
console.log(der_explicitTagged, BASE64(der_explicitTagged));
const decoded_explicitTagged = DER.decode(der_explicitTagged, explicitTagged);
console.log(decoded_explicitTagged);
console.groupEnd();
console.group('SEQUENCE check');
const sequence = SEQUENCE({
    version: ExplicitTag(0, 'INTEGER'),
    serialNumber: 'INTEGER',
}, ['version', 'serialNumber']);
const asn1_sequence = {
    type: sequence,
    value: {
        version: { EXPLICIT: 2n },
        serialNumber: 143266986699090766294700635381230934788665930n,
    },
};
const der_sequence = DER.encode(asn1_sequence);
console.log(der_sequence, BASE64(der_sequence));
const decoded_sequence = DER.decode(der_sequence, sequence);
console.log(decoded_sequence);
console.groupEnd();
console.group('SEQUENCE OF Check');
const sequenceof = SEQUENCEOF('INTEGER');
const asn1_sequenceof = {
    type: sequenceof,
    value: [1n, 2n, 3n, 65535n, 5n, 143266986699090766294700635381230934788665930n],
};
const der_sequenceof = DER.encode(asn1_sequenceof);
console.log(der_sequenceof, BASE64(der_sequenceof));
const decoded_sequenceof = DER.decode(der_sequenceof, sequenceof);
console.log(decoded_sequenceof);
console.groupEnd();
console.group('SET OF Check');
const setof = SETOF('INTEGER');
const asn1_setof = {
    type: setof,
    value: new Set([2n, 1n, 3n, 65535n, 5n, 143266986699090766294700635381230934788665930n]),
};
const der_setof = DER.encode(asn1_setof);
console.log(der_setof, BASE64(der_setof));
const decoded_setof = DER.decode(der_setof, setof);
console.log(decoded_setof);
console.groupEnd();
console.group('CHOICE Check');
const choice = CHOICE({ a: 'INTEGER', b: ExplicitTag(7, 'NULL') });
const asn1_choice = {
    type: choice,
    value: { CHOICE: { EXPLICIT: undefined } },
};
const der_choice = DER.encode(asn1_choice);
console.log(der_choice, BASE64(der_choice));
const decoded_choice = DER.decode(der_choice, choice);
console.log(decoded_choice);
console.groupEnd();
console.group('X509 Certificate');
const AlgorithmIdentifier = SEQUENCE({
    algorithm: 'OBJECT IDENTIFIER',
    parameters: {
        OPTIONAL: { ANY: { DEFIEND_BY: 'algorithm', typeDerive: () => 'OBJECT IDENTIFIER' } },
    },
}, ['algorithm', 'parameters']);
console.group('X509 AlgorithmIdentifier');
const asn1_aid = {
    type: AlgorithmIdentifier,
    value: {
        algorithm: [1, 2, 840, 10045, 2, 1],
        parameters: { ANY: [1, 2, 840, 10045, 3, 1, 7] },
    },
};
const der_aid = DER.encode(asn1_aid);
console.log(der_aid, BASE64(der_aid));
const decoded_aid = DER.decode(der_aid, AlgorithmIdentifier);
console.log(decoded_aid);
console.groupEnd();
const AttributeTypeAndValue = SEQUENCE({
    type: 'OBJECT IDENTIFIER',
    value: { ANY: { DEFIEND_BY: 'type', typeDerive: () => 'OCTET STRING' } },
}, ['type', 'value']);
const RelativeDistinguishedName = SETOF(AttributeTypeAndValue);
const RDNSequence = SEQUENCEOF(RelativeDistinguishedName);
const Name = CHOICE({ rdnSequence: RDNSequence });
const Time = CHOICE({
    utcTime: 'UTCTime',
    // generalTime: 'GeneralizedTime'
});
const Validity = SEQUENCE({ notBefore: Time, notAfter: Time }, ['notBefore', 'notAfter']);
const SubjectPublicKeyInfo = SEQUENCE({
    algorithm: AlgorithmIdentifier,
    subjectPublicKey: 'BIT STRING',
}, ['algorithm', 'subjectPublicKey']);
const UniqueIdentifier = 'BIT STRING';
const Extension = SEQUENCE({
    extnID: 'OBJECT IDENTIFIER',
    critical: 'BOOLEAN',
    extnValue: 'OCTET STRING',
}, ['extnID', 'critical', 'extnValue']);
const Extensions = SEQUENCEOF(Extension);
const TBSCertificate = SEQUENCE({
    version: ExplicitTag(0, 'INTEGER'),
    serialNumber: 'INTEGER',
    signature: AlgorithmIdentifier,
    issuer: Name,
    validity: Validity,
    subject: Name,
    subjectPublicKeyInfo: SubjectPublicKeyInfo,
    issuerUniqueID: { OPTIONAL: ImplicitTag(1, UniqueIdentifier) },
    subjectUniqueID: { OPTIONAL: ImplicitTag(2, UniqueIdentifier) },
    extensions: { OPTIONAL: ImplicitTag(3, Extensions) },
}, [
    'version',
    'serialNumber',
    'signature',
    'issuer',
    'validity',
    'subject',
    'subjectPublicKeyInfo',
    'issuerUniqueID',
    'subjectUniqueID',
    'extensions',
]);
const Certificate = SEQUENCE({
    tbsCertificate: TBSCertificate,
    signatureAlgorithm: AlgorithmIdentifier,
    signatureValue: 'BIT STRING',
}, ['tbsCertificate', 'signatureAlgorithm', 'signatureValue']);
const asn1_crt = {
    type: Certificate,
    value: {
        tbsCertificate: {
            version: { EXPLICIT: 2n },
            serialNumber: 143266986699090766294700635381230934788665930n,
            signature: { algorithm: [1, 2, 840, 10045, 4, 3, 2] },
            issuer: {
                CHOICE: [
                    new Set([{ type: [2, 5, 4, 6], value: { ANY: UTF8('US') } }]),
                    new Set([{ type: [2, 5, 4, 10], value: { ANY: UTF8('Amazon') } }]),
                    new Set([{ type: [2, 5, 4, 3], value: { ANY: UTF8('Amazon Root CA 3') } }]),
                ],
            },
            validity: {
                notBefore: { CHOICE: new Date(Date.UTC(2015, 5 - 1, 26)) },
                notAfter: { CHOICE: new Date(Date.UTC(2040, 5 - 1, 26)) },
            },
            subject: {
                CHOICE: [
                    new Set([{ type: [2, 5, 4, 6], value: { ANY: UTF8('US') } }]),
                    new Set([{ type: [2, 5, 4, 10], value: { ANY: UTF8('Amazon') } }]),
                    new Set([{ type: [2, 5, 4, 3], value: { ANY: UTF8('Amazon Root CA 3') } }]),
                ],
            },
            subjectPublicKeyInfo: {
                algorithm: {
                    algorithm: [1, 2, 840, 10045, 2, 1],
                    parameters: { ANY: [1, 2, 840, 10045, 3, 1, 7] },
                },
                subjectPublicKey: new Uint8Array([
                    4, 41, 151, 167, 198, 65, 127, 192, 13, 155, 232, 1, 27, 86, 198, 242, 82, 165, 186, 45,
                    178, 18, 232, 210, 46, 215, 250, 201, 197, 216, 170, 109, 31, 115, 129, 59, 59, 152, 107,
                    57, 124, 51, 165, 197, 78, 134, 142, 128, 23, 104, 98, 69, 87, 125, 68, 88, 29, 179, 55,
                    229, 103, 8, 235, 102, 222,
                ]),
            },
        },
        signatureAlgorithm: { algorithm: [1, 2, 840, 10045, 4, 3, 2] },
        signatureValue: new Uint8Array([
            48, 70, 2, 33, 0, 224, 133, 146, 163, 23, 183, 141, 249, 43, 6, 165, 147, 172, 26, 152, 104,
            97, 114, 250, 225, 161, 208, 251, 28, 120, 96, 166, 67, 153, 197, 184, 196, 2, 33, 0, 156, 2,
            239, 241, 148, 156, 179, 150, 249, 235, 198, 42, 248, 182, 44, 254, 58, 144, 20, 22, 215, 140,
            99, 36, 72, 28, 223, 48, 125, 213, 104, 59,
        ]),
    },
};
const der_crt = DER.encode(asn1_crt);
const der_crt_b64 = 'MIIBtjCCAVugAwIBAgITBmyf1XSXNmY/Owua2eiedgPySjAKBggqhkjOPQQDAjA5MQswCQYDVQQGEwJVUzEPMA0GA1UEChMGQW1hem9uMRkwFwYDVQQDExBBbWF6b24gUm9vdCBDQSAzMB4XDTE1MDUyNjAwMDAwMFoXDTQwMDUyNjAwMDAwMFowOTELMAkGA1UEBhMCVVMxDzANBgNVBAoTBkFtYXpvbjEZMBcGA1UEAxMQQW1hem9uIFJvb3QgQ0EgMzBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABCmXp8ZBf8ANm+gBG1bG8lKlui2yEujSLtf6ycXYqm0fc4E7O5hrOXwzpcVOho6AF2hiRVd9RFgdszflZwjrZt6jQjBAMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgGGMB0GA1UdDgQWBBSrttvXBp43rDCGB5Fwx5zEGbF4wDAKBggqhkjOPQQDAgNJADBGAiEA4IWSoxe3jfkrBqWTrBqYaGFy+uGh0PsceGCmQ5nFuMQCIQCcAu/xlJyzlvnrxir4tiz+OpAUFteMYyRIHN8wfdVoOw==';
console.log(der_crt, BASE64(der_crt), BASE64(der_crt) === der_crt_b64);
const decoded_crt = DER.decode(der_crt, Certificate);
console.log(decoded_crt);
console.groupEnd();
