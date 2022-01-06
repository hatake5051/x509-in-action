'use strict';

/**
 * ２つのバイト列を結合する
 * @param {Uint8Array} A - 先頭バイト列
 * @param {Uint8Array} B - 後続バイト列
 * @return {Uint8Array} A の後ろに B をつなげたバイト列 A || B
 */
function CONCAT(A, B) {
    const ans = new Uint8Array(A.length + B.length);
    ans.set(A);
    ans.set(B, A.length);
    return ans;
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
function isASN1Type(arg, t) {
    if (t == null) {
        return (isASN1SimpleType(arg) ||
            isASN1StructuredType(arg) ||
            isASN1TaggedType(arg) ||
            isASN1OtherType(arg));
    }
    return isASN1Type(arg) && equalsASN1Type(arg, t);
}
// type ASN1TypeName = ASN1SimpleType | 'SEQUENCE' | 'IMPLICIT' | 'EXPLICIT' | 'ANY';
// type ASN1TypeFromName<N extends ASN1TypeName> = N extends ASN1SimpleType
//   ? N
//   : N extends 'SEQUENCE'
//   ? ASN1SEQUENCEType
//   : N extends 'IMPLICIT'
//   ? ASN1ImplicitlyTaggedType
//   : N extends 'EXPLICIT'
//   ? ASN1ExplicitlyTaggedType
//   : N extends 'ANY'
//   ? 'ANY'
//   : never;
// function isASN1Type<N extends ASN1TypeName = ASN1TypeName>(
//   arg: unknown,
//   name?: N
// ): arg is ASN1TypeFromName<N> {
//   if (name == null) {
//     return (
//       isASN1SimpleType(arg) ||
//       isASN1StructuredType(arg) ||
//       isASN1TaggedType(arg) ||
//       isASN1OtherType(arg)
//     );
//   }
//   if (['NULL', 'INTEGER'].includes(name)) return isASN1SimpleType(arg);
//   if (['SEQUENCE'].includes(name)) return isASN1StructuredValue(arg);
// }
function equalsASN1Type(l, r) {
    if (l == null && r == null)
        return true;
    if (l == null || r == null)
        return false;
    if (l === 'ANY' || r === 'ANY')
        return true;
    if (isASN1SimpleType(l))
        return isASN1SimpleType(r) && l == r;
    if (isASN1TaggedType(l))
        return isASN1TaggedType(r) && equalsASN1TaggedType(l, r);
    if (isASN1StructuredType(l))
        return isASN1StructuredType(r) && equalsASN1StructuredType(l, r);
    if (isASN1OtherType(l))
        return isASN1OtherType(r) && equalsASN1OtherType(l, r);
    return false;
}
function isASN1Value(arg, t) {
    if (!(isObject(arg) && isASN1Type(arg.t) && equalsASN1Type(arg.t, t)))
        return false;
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
const ASN1SimpleTypeList = [
    'INTEGER',
    'BIT STRING',
    'NULL',
    'OBJECT IDENTIFIER',
    'UTCTime',
    'BOOLEAN',
    'OCTET STRING',
];
const isASN1SimpleType = (arg) => ASN1SimpleTypeList.some((t) => arg === t);
function isASN1SimpleValue(value, t) {
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
function isASN1StructuredType(arg) {
    if (isObject(arg)) {
        if (arg.order == null) {
            return arg.SEQUENCE === 'unknown';
        }
        // if arg.order has a value
        return (Array.isArray(arg.order) &&
            arg.order.every((k) => typeof k === 'string') &&
            isObject(arg.SEQUENCE) &&
            Object.entries(arg.SEQUENCE).every(([k, v]) => arg.order.includes(k) &&
                ((isObject(v) && isASN1Type(v.OPTIONAL)) || isASN1Type(v))));
    }
    if (isObject(arg)) {
        return isASN1Type(arg.SEQUENCEOF);
    }
    if (isObject(arg)) {
        return isASN1Type(arg.SETOF);
    }
    return false;
}
function equalsASN1StructuredType(l, r) {
    if (l == null && r == null)
        return true;
    if (l == null || r == null)
        return false;
    if ('SEQUENCE' in l) {
        if (l.order == null) {
            return 'SEQUENCE' in r && l.SEQUENCE === 'unknown';
        }
        return ('SEQUENCE' in r &&
            ((r.order == null && r.SEQUENCE === 'unknown') ||
                (Array.isArray(l.order) &&
                    Array.isArray(r.order) &&
                    new Set(l.order).size === new Set(r.order).size &&
                    l.order.every((ll) => r.order.includes(ll)) &&
                    l.SEQUENCE !== 'unknown' &&
                    r.SEQUENCE !== 'unknown' &&
                    l.order.every((k) => {
                        const lk = l.SEQUENCE[k];
                        const rk = r.SEQUENCE[k];
                        return equalsASN1Type(isASN1Type(lk) ? lk : lk?.OPTIONAL, isASN1Type(rk) ? rk : rk?.OPTIONAL);
                    }))));
    }
    if ('SEQUENCEOF' in l) {
        return 'SEQUENCEOF' in r && equalsASN1Type(l.SEQUENCEOF, r.SEQUENCEOF);
    }
    if ('SETOF' in l) {
        return 'SETOF' in r && equalsASN1Type(l.SETOF, r.SETOF);
    }
    return false;
}
function isASN1StructuredValue(value, t) {
    if ('SEQUENCE' in t) {
        if (!(typeof value === 'object' && value != null))
            return false;
        if (t.SEQUENCE === 'unknown')
            return true;
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
        if (!(value instanceof Set))
            return false;
        value.forEach((v) => {
            if (!isASN1Value(v, t.SETOF))
                return false;
        });
        return true;
    }
    return false;
}
const ASN1SEQUENCE = (s, order) => ({
    SEQUENCE: s,
    order,
});
const ASN1SEQUENCEOF = (s) => ({ SEQUENCEOF: s });
const ASN1SETOF = (s) => ({ SETOF: s });
const isASN1TaggedType = (arg) => (isObject(arg) &&
    (arg.IMPLICIT === 'unknown' || isASN1Tag(arg.IMPLICIT)) &&
    isASN1Type(arg.t)) ||
    (isObject(arg) &&
        (arg.EXPLICIT === 'unknown' || isASN1Tag(arg.EXPLICIT)) &&
        isASN1Type(arg.t));
function equalsASN1TaggedType(l, r) {
    if (l == null && r == null)
        return true;
    if (l == null || r == null)
        return false;
    if ('IMPLICIT' in l) {
        return ('IMPLICIT' in r &&
            (l.IMPLICIT === 'unknown' ||
                r.IMPLICIT === 'unknown' ||
                equalsASN1Tag(l.IMPLICIT, r.IMPLICIT)) &&
            equalsASN1Type(r.t, l.t));
    }
    return ('EXPLICIT' in r &&
        (l.EXPLICIT === 'unknown' ||
            r.EXPLICIT === 'unknown' ||
            equalsASN1Tag(l.EXPLICIT, r.EXPLICIT)) &&
        equalsASN1Type(l.t, r.t));
}
function isASN1TaggedValue(value, t) {
    return isObject(value) && isASN1Value({ v: value.v, t: t.t }, t.t);
}
/**
 * Implicitly tagged types は基となる type の tag を変更することで他の types から派生する。
 * ASN.1 キーワードで "[class number] IMPLICIT" として表記される。
 * おおよその場合で、 "[class number]" のみの場合は implicitly tagged type の表記。
 */
const ASN1ImplicitTag = (tag, t) => {
    if (isASN1TagNumber(tag))
        return { IMPLICIT: { c: 'Context Specific', n: tag }, t };
    if (isASN1Tag(tag))
        return { IMPLICIT: tag, t };
    throw new TypeError('不適切な引数です');
};
/**
 * Explicitly tagged types は基となる type に an outer tag を付加することで他の types から派生する。
 * 実質的に、 explicitly tagged types は基となる types を要素に持つ structured types である。
 * ASN.1 キーワードで "[class number] EXPLICIT" として表記される。
 */
const ASN1ExplicitTag = (tag, t) => {
    if (isASN1TagNumber(tag))
        return { EXPLICIT: { c: 'Context Specific', n: tag }, t };
    if (isASN1Tag(tag))
        return { EXPLICIT: tag, t };
    throw new TypeError('不適切な引数です');
};
const isASN1OtherType = (arg) => arg === 'ANY' ||
    (isObject(arg) &&
        typeof arg.CHOICE === 'object' &&
        arg.CHOICE != null &&
        Object.values(arg.CHOICE).every((t) => isASN1Type(t)));
function equalsASN1OtherType(l, r) {
    if (l == null && r == null)
        return true;
    if (l == null || r == null)
        return false;
    if ('ANY' === l)
        return 'ANY' === r;
    return (typeof r === 'object' &&
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
        }));
}
function isASN1OtheValue(value, t) {
    if (t === 'ANY') {
        return true;
    }
    return (isObject(value) &&
        Object.values(t.CHOICE).some((tt) => isASN1Value(value.v, tt)));
}
const ASN1CHOICE = (s) => ({ CHOICE: s });
const isASN1Tag = (arg) => isObject(arg) && isASN1TagClass(arg.c) && isASN1TagNumber(arg.n);
function equalsASN1Tag(l, r) {
    if (l == null && r == null)
        return true;
    if (l == null || r == null)
        return false;
    return l.c === r.c && l.n === r.n;
}
const isASN1TagNumber = (arg) => typeof arg === 'number' && arg >= 0;
function ASN1Type_to_ASN1Tag(t) {
    if (t === 'INTEGER')
        return { c: 'Universal', n: 2 };
    if (t === 'BIT STRING')
        return { c: 'Universal', n: 3 };
    if (t === 'NULL')
        return { c: 'Universal', n: 5 };
    if (t === 'OBJECT IDENTIFIER')
        return { c: 'Universal', n: 6 };
    if (isASN1Type(t, { IMPLICIT: 'unknown', t: 'ANY' })) {
        return t.IMPLICIT;
    }
    if (isASN1Type(t, { EXPLICIT: 'unknown', t: 'ANY' })) {
        return t.EXPLICIT;
    }
    throw new TypeError(`ASN1Type_toASN1Tag(${JSON.stringify(t)}) has not been implmented`);
}
const isASN1TagClass = (arg) => ASN1TagClassList.some((x) => x === arg);
const ASN1TagClassList = ['Universal', 'Application', 'Context Specific', 'Private'];

const DER = {
    encode: (asn1) => {
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
            const contentsOctets = CONCAT(contents.identifier, CONCAT(contents.length, contents.contents));
            const identifierOctets = DERIdentifierOctets.encode(ASN1Type_to_ASN1Tag(asn1.t), 'Constructed');
            const lengthOctets = DERLengthOctets.encode(contentsOctets.length);
            return {
                identifier: identifierOctets,
                length: lengthOctets,
                contents: contentsOctets,
            };
        }
        if (isASN1Value(asn1, { SEQUENCE: 'unknown' })) {
            console.log('ABCDE');
        }
        throw new TypeError('not implemented');
    },
    decode: (der, t) => {
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
            return { t, v };
        }
        if (isASN1Type(t, 'INTEGER')) {
            if (!equalsASN1Tag(ASN1Type_to_ASN1Tag(t), tag)) {
                console.log(tag);
                throw new TypeError(`パースエラー。 ${JSON.stringify(t)} としてバイナリを解析できない`);
            }
            const v = DERContentsOctets_INTEGER.decode(der.slice(start, start + len));
            return { t, v };
        }
        if (isASN1Type(t, { IMPLICIT: 'unknown', t: 'ANY' })) {
            const implicitTag = ASN1Type_to_ASN1Tag(t);
            if (!equalsASN1Tag(implicitTag, tag)) {
                throw new TypeError(`パースエラー。 ${JSON.stringify(t)} としてバイナリを解析できない`);
            }
            const identifierOctets = DERIdentifierOctets.encode(ASN1Type_to_ASN1Tag(t.t), method);
            const asn1 = DER.decode(CONCAT(identifierOctets, der.slice(lasti + 1)), t.t);
            return { t, v: { v: asn1.v } };
        }
        if (isASN1Type(t, { EXPLICIT: 'unknown', t: 'ANY' })) {
            const explicitTag = ASN1Type_to_ASN1Tag(t);
            if (!equalsASN1Tag(explicitTag, tag)) {
                throw new TypeError(`パースエラー。 ${JSON.stringify(t)} としてバイナリを解析できない`);
            }
            const asn1 = DER.decode(der.slice(start, start + len), t.t);
            return { t, v: { v: asn1.v } };
        }
        throw new TypeError('not implemented');
    },
};
const DERIdentifierOctets = {
    encode: (tag, method) => {
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
        let num = tag.n;
        const numlistBasedOnRasix = [];
        const radix = 128;
        while (num >= radix) {
            numlistBasedOnRasix.push(num % radix);
            num = Math.floor(num / radix);
        }
        numlistBasedOnRasix.push(num);
        return new Uint8Array([first_octet, ...numlistBasedOnRasix.reverse()]);
    },
    decode: (octets) => {
        if (octets[0] == null)
            throw new TypeError('正しい DER Identifier Octets を与えてください。');
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
            return { tag: { c, n: bits5_1 }, method, last: 0 };
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
        return { tag: { c, n: num }, method, last };
    },
};
const DERLengthOctets = {
    encode: (contentsOctetLength) => {
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
    decode: (octets) => {
        if (octets[0] == null)
            throw new TypeError('正しい DER Length Octets を与えてください。');
        if (octets[0] < 128) {
            return { len: octets[0], last: 0 };
        }
        const lenOctetsLength = octets[0] & 0x7f;
        let len = 0;
        for (let idx = 0; idx < lenOctetsLength; idx++) {
            const oct = octets[idx + 1];
            if (oct == null)
                throw new TypeError('DER Length Octets の encoding で long format error');
            len = (len << 8) + oct;
        }
        return { len, last: lenOctetsLength };
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
const DERContentsOctets_NULL = {
    encode: (v) => {
        return new Uint8Array();
    },
    decode: (octets) => {
        return undefined;
    },
};

const AlgorithmIdentifier = ASN1SEQUENCE({
    algorithm: 'OBJECT IDENTIFIER',
    parameters: { OPTIONAL: 'ANY' },
}, ['algorithm', 'parameters']);
const AttributeTypeAndValue = ASN1SEQUENCE({
    type: 'OBJECT IDENTIFIER',
    value: 'ANY',
}, ['type', 'value']);
const RelativeDistinguishedName = ASN1SETOF(AttributeTypeAndValue);
const RDNSequence = ASN1SEQUENCEOF(RelativeDistinguishedName);
const Name = ASN1CHOICE({ rdnSequence: RDNSequence });
const Time = ASN1CHOICE({
    utcTime: 'UTCTime',
    // generalTime: 'GeneralizedTime'
});
const Validity = ASN1SEQUENCE({ notBefore: Time, notAfter: Time }, ['notBefore', 'notAfter']);
const SubjectPublicKeyInfo = ASN1SEQUENCE({
    algorithm: AlgorithmIdentifier,
    subjectPublicKey: 'BIT STRING',
}, ['algorithm', 'subjectPublicKey']);
const UniqueIdentifier = 'BIT STRING';
const Extension = ASN1SEQUENCE({
    extnID: 'OBJECT IDENTIFIER',
    critical: 'BOOLEAN',
    extnValue: 'OCTET STRING',
}, ['extnID', 'critical', 'extnValue']);
const Extensions = ASN1SEQUENCEOF(Extension);
ASN1SEQUENCE({
    version: ASN1ExplicitTag(0, 'INTEGER'),
    serialNumber: 'INTEGER',
    signature: AlgorithmIdentifier,
    issuer: Name,
    validity: Validity,
    subject: Name,
    subjectPublicKeyInfo: SubjectPublicKeyInfo,
    issuerUniqueID: { OPTIONAL: ASN1ImplicitTag(1, UniqueIdentifier) },
    subjectUniqueID: { OPTIONAL: ASN1ImplicitTag(2, UniqueIdentifier) },
    extensions: { OPTIONAL: ASN1ImplicitTag(3, Extensions) },
}, ['version', 'serialNumber', 'signature', 'issuer', 'validity', 'subject', 'subjectPublicKeyInfo']);
/**
 * バイナリに文字列を BASE64 デコードする。
 * デコードに失敗すると TypeError を吐く。
 */
function BASE64_DECODE(STRING) {
    try {
        const b_str = window.atob(STRING);
        // バイナリ文字列を Uint8Array に変換する
        const b = new Uint8Array(b_str.length);
        for (let i = 0; i < b_str.length; i++) {
            b[i] = b_str.charCodeAt(i);
        }
        return b;
    }
    catch (e) {
        throw new TypeError(`与えられた文字列 ${STRING} は base64 encoded string ではない`);
    }
}
BASE64_DECODE('MIIBtjCCAVugAwIBAgITBmyf1XSXNmY/Owua2eiedgPySjAKBggqhkjOPQQDAjA5MQswCQYDVQQGEwJVUzEPMA0GA1UEChMGQW1hem9uMRkwFwYDVQQDExBBbWF6b24gUm9vdCBDQSAzMB4XDTE1MDUyNjAwMDAwMFoXDTQwMDUyNjAwMDAwMFowOTELMAkGA1UEBhMCVVMxDzANBgNVBAoTBkFtYXpvbjEZMBcGA1UEAxMQQW1hem9uIFJvb3QgQ0EgMzBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABCmXp8ZBf8ANm+gBG1bG8lKlui2yEujSLtf6ycXYqm0fc4E7O5hrOXwzpcVOho6AF2hiRVd9RFgdszflZwjrZt6jQjBAMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgGGMB0GA1UdDgQWBBSrttvXBp43rDCGB5Fwx5zEGbF4wDAKBggqhkjOPQQDAgNJADBGAiEA4IWSoxe3jfkrBqWTrBqYaGFy+uGh0PsceGCmQ5nFuMQCIQCcAu/xlJyzlvnrxir4tiz+OpAUFteMYyRIHN8wfdVoOw==');
const eq = (x, y) => {
    console.log(x, '===', y, '?', equalsASN1Type(x, y));
    console.log(`${JSON.stringify(y)} === ${JSON.stringify(x)} ? ${equalsASN1Type(y, x)}`);
};
console.group('NULL check');
eq('NULL', 'ANY');
const asn1_null = { t: 'NULL', v: undefined };
const der_null = DER.encode(asn1_null);
console.log(der_null, DER.decode(CONCAT(der_null.identifier, CONCAT(der_null.length, der_null.contents)), 'NULL'));
console.groupEnd();
console.group('INTEGER check');
eq('INTEGER', 'ANY');
const asn1_integer = { t: 'INTEGER', v: -129n };
const der_integer = DER.encode(asn1_integer);
console.log(der_integer, DER.decode(CONCAT(der_integer.identifier, CONCAT(der_integer.length, der_integer.contents)), 'INTEGER'));
console.groupEnd();
console.group('IMPLICIT check');
const implicitTagged = ASN1ImplicitTag(0, 'NULL');
eq(implicitTagged, { IMPLICIT: 'unknown', t: 'ANY' });
const asn1_implicitTagged = {
    t: implicitTagged,
    v: { v: undefined },
};
const der_implicitTagged = DER.encode(asn1_implicitTagged);
console.log(der_implicitTagged, DER.decode(CONCAT(der_implicitTagged.identifier, CONCAT(der_implicitTagged.length, der_implicitTagged.contents)), implicitTagged));
console.groupEnd();
console.group('EXPLICIT check');
const explicitTagged = ASN1ExplicitTag(0, implicitTagged);
eq(explicitTagged, { EXPLICIT: 'unknown', t: 'ANY' });
const asn1_explicitTagged = {
    t: explicitTagged,
    v: { v: { v: undefined } },
};
const der_explicitTagged = DER.encode(asn1_explicitTagged);
console.log(der_explicitTagged, DER.decode(CONCAT(der_explicitTagged.identifier, CONCAT(der_explicitTagged.length, der_explicitTagged.contents)), explicitTagged));
console.groupEnd();
console.group('SEQUENCE check');
const sequence = ASN1SEQUENCE({
    version: ASN1ExplicitTag(0, 'INTEGER'),
    serialNumber: 'INTEGER',
}, ['version', 'serialNumber']);
eq(sequence, { SEQUENCE: 'unknown' });
const asn1_sequence = {
    t: sequence,
    v: {
        version: { v: 2n },
        serialNumber: 143266986699090766294700635381230934788665930n,
    },
};
const der_sequence = DER.encode(asn1_sequence);
console.log(der_sequence);
console.groupEnd();
