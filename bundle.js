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
    if (isASN1TypeName(t))
        return isASN1Type(arg) && t === asn1TypeNameFromType(arg);
    return isASN1Type(arg) && eqASN1Type(t, arg);
}
function eqASN1Type(l, r) {
    if (l == null && r == null)
        return true;
    if (l == null || r == null)
        return false;
    if (l === 'ANY' || r === 'ANY')
        return true;
    if (isASN1SimpleType(l))
        return isASN1SimpleType(r) && l === r;
    if ('IMPLICIT' in l) {
        return (isObject(r) && 'IMPLICIT' in r && eqASN1Tag(l.IMPLICIT, r.IMPLICIT) && eqASN1Type(l.t, r.t));
    }
    if ('EXPLICIT' in l) {
        return (isObject(r) && 'EXPLICIT' in r && eqASN1Tag(l.EXPLICIT, r.EXPLICIT) && eqASN1Type(l.t, r.t));
    }
    if ('SEQUENCE' in l) {
        return (isObject(r) &&
            'SEQUENCE' in r &&
            new Set(l.order).size === new Set(r.order).size &&
            l.order.every((li) => {
                const lv = l.SEQUENCE[li];
                const rv = l.SEQUENCE[li];
                return (r.order.includes(li) &&
                    eqASN1Type(isObject(lv) && 'OPTIONAL' in lv ? lv.OPTIONAL : lv, isObject(rv) && 'OPTIONAL' in rv ? rv.OPTIONAL : rv));
            }));
    }
    if ('SEQUENCEOF' in l) {
        return isObject(r) && 'SEQUENCEOF' in r && eqASN1Type(l.SEQUENCEOF, r.SEQUENCEOF);
    }
    if ('SETOF' in l) {
        return isObject(r) && 'SETOF' in r && eqASN1Type(l.SETOF, r.SETOF);
    }
    if ('CHOICE' in l) {
        return (isObject(r) &&
            'CHOICE' in r &&
            Object.entries(l.CHOICE).every(([li, lt]) => eqASN1Type(lt, r.CHOICE[li])) &&
            Object.entries(r.CHOICE).every(([ri, rt]) => eqASN1Type(l.CHOICE[ri], rt)));
    }
    return false;
}
const isASN1TypeName = (arg) => isASN1SimpleTypeName(arg) ||
    isASN1StructuredTypeName(arg) ||
    isASN1TaggedTypeName(arg) ||
    isASN1OtherTypeName(arg);
const asn1TypeNameFromType = (t) => {
    if (isASN1SimpleType(t))
        return t;
    if ('SEQUENCE' in t)
        return 'SEQUENCE';
    if ('SEQUENCEOF' in t)
        return 'SEQUENCEOF';
    if ('SETOF' in t)
        return 'SETOF';
    if ('IMPLICIT' in t)
        return 'IMPLICIT';
    if ('EXPLICIT' in t)
        return 'EXPLICIT';
    if (t === 'ANY')
        return 'ANY';
    if ('CHOICE' in t)
        return 'CHOICE';
    throw new TypeError(`${JSON.stringify(t)} は ASN1 Type ではない`);
};
function isASN1Value(arg) {
    if (!isObject(arg))
        return false;
    if (isASN1SimpleType(arg.t))
        return isASN1SimpleType_to_TSType(arg.v, arg.t);
    if (isASN1StructuredType(arg.t))
        return isASN1StructuredType_to_TSType(arg.v, arg.t);
    if (isASN1TaggedType(arg.t))
        return isASN1TaggedType_to_TSType(arg.v, arg.t);
    if (isASN1OtherType(arg.t))
        return isASN1OtherType_to_TSType(arg.v, arg.t);
    return false;
}
function checkASN1Value(value, t) {
    if (isASN1TypeName(t))
        return t === asn1TypeNameFromType(value.t);
    return eqASN1Type(t, value.t);
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
const isASN1SimpleTypeName = isASN1SimpleType;
function isASN1SimpleType_to_TSType(arg, t) {
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
const isASN1StructuredTypeName = (arg) => ['SEQUENCE', 'SEQUENCEOF', 'SETOF'].some((x) => x === arg);
function isASN1StructuredType(arg) {
    if (isObject(arg) && 'SEQUENCE' in arg) {
        return (Array.isArray(arg.order) &&
            arg.order.every((k) => typeof k === 'string') &&
            isObject(arg.SEQUENCE) &&
            Object.entries(arg.SEQUENCE).every(([k, v]) => arg.order.includes(k) &&
                ((isObject(v) && 'OPTIONAL' in v && isASN1Type(v.OPTIONAL)) ||
                    isASN1Type(v))));
    }
    if (isObject(arg) && 'SEQUENCEOF' in arg) {
        return isASN1Type(arg.SEQUENCEOF);
    }
    if (isObject(arg) && 'SETOF' in arg) {
        return isASN1Type(arg.SETOF);
    }
    return false;
}
function isASN1StructuredType_to_TSType(arg, t) {
    if ('SEQUENCE' in t) {
        return (isObject(arg) &&
            Object.entries(arg).every(([k, v]) => t.order.some((x) => x === k) && isASN1Value({ v, t: t.SEQUENCE[k] })));
    }
    if ('SEQUENCEOF' in t) {
        return Array.isArray(arg) && arg.every((v) => isASN1Value({ v, t: t.SEQUENCEOF }));
    }
    if ('SETOF' in t) {
        return arg instanceof Set && [...arg].every((v) => isASN1Value({ v, t: t.SETOF }));
    }
    return false;
}
const ASN1SEQUENCE = (s, order) => ({
    SEQUENCE: s,
    order,
});
const ASN1SEQUENCEOF = (s) => ({ SEQUENCEOF: s });
const ASN1SETOF = (s) => ({ SETOF: s });
const isASN1TaggedTypeName = (arg) => ['IMPLICIT', 'EXPLICIT'].some((x) => x === arg);
const isASN1TaggedType = (arg) => (isObject(arg) && isASN1Tag(arg.IMPLICIT) && isASN1Type(arg.t)) ||
    (isObject(arg) && isASN1Tag(arg.EXPLICIT) && isASN1Type(arg.t));
function isASN1TaggedType_to_TSType(arg, t) {
    return isObject(arg) && isASN1Value({ v: arg.v, t: t.t });
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
const isASN1OtherTypeName = (arg) => ['ANY', 'CHOICE'].some((x) => x === arg);
const isASN1OtherType = (arg) => arg === 'ANY' ||
    (isObject(arg) &&
        typeof arg.CHOICE === 'object' &&
        arg.CHOICE != null &&
        Object.values(arg.CHOICE).every((t) => isASN1Type(t)));
function isASN1OtherType_to_TSType(arg, t) {
    if (t === 'ANY')
        return true;
    return (isObject(arg) &&
        Object.values(t.CHOICE).some((t) => isASN1Value({ v: arg.v, t })));
}
const ASN1CHOICE = (s) => ({ CHOICE: s });
const isASN1Tag = (arg) => isObject(arg) && isASN1TagClass(arg.c) && isASN1TagNumber(arg.n);
function eqASN1Tag(l, r) {
    if (l == null && r == null)
        return true;
    if (l == null || r == null)
        return false;
    return l.c === r.c && l.n === r.n;
}
const isASN1TagNumber = (arg) => typeof arg === 'number' && arg >= 0;
function ASN1Type_to_ASN1Tag(t) {
    if (t === 'ANY')
        throw new TypeError(`Any の ASN1Tag はない`);
    if (t === 'BOOLEAN')
        return { c: 'Universal', n: 1 };
    if (t === 'INTEGER')
        return { c: 'Universal', n: 2 };
    if (t === 'BIT STRING')
        return { c: 'Universal', n: 3 };
    if (t === 'OCTET STRING')
        return { c: 'Universal', n: 4 };
    if (t === 'NULL')
        return { c: 'Universal', n: 5 };
    if (t === 'OBJECT IDENTIFIER')
        return { c: 'Universal', n: 6 };
    if (t === 'UTCTime')
        return { c: 'Universal', n: 23 };
    if ('EXPLICIT' in t)
        return t.EXPLICIT;
    if ('IMPLICIT' in t)
        return t.IMPLICIT;
    if ('SEQUENCE' in t || 'SEQUENCEOF' in t)
        return { c: 'Universal', n: 16 };
    if ('SETOF' in t)
        return { c: 'Universal', n: 17 };
    if ('CHOICE' in t)
        throw new TypeError(`${JSON.stringify(t)} の ASN1Tag は選べない`);
    throw new TypeError(`ASN1Type_toASN1Tag(${JSON.stringify(t)}) has not been implmented`);
}
const isASN1TagClass = (arg) => ASN1TagClassList.some((x) => x === arg);
const ASN1TagClassList = ['Universal', 'Application', 'Context Specific', 'Private'];

function ASN1Type_to_DERMethod(t) {
    if (t === 'ANY')
        throw new TypeError('ANY  は DER encode できません');
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
        return ASN1Type_to_DERMethod(t.t);
    if ('CHOICE' in t)
        throw new TypeError(`${JSON.stringify(t)} は DER encode できない`);
    throw new TypeError(`ASN1Type_to_DERMethod(${JSON.stringify(t)}) has not been implmented`);
}
const DER = {
    encode: (asn1) => serialize(encodeDER(asn1)),
    decode: (der, t) => {
        const x = decodeDER(der, t);
        // 乱暴な型キャスト
        return x.asn1;
    },
};
const serialize = (x) => CONCAT(CONCAT(x.id, x.len), x.contents);
function encodeDER(asn1) {
    if (checkASN1Value(asn1, 'CHOICE')) {
        for (const t of Object.values(asn1.t.CHOICE)) {
            const inner = { v: asn1.v.v, t };
            if (!isASN1Value(inner)) {
                continue;
            }
            return encodeDER(inner);
        }
        throw new TypeError(`asn1 value が CHOICE を満たせていない`);
    }
    const id = DERIdentifierOctets.encode(ASN1Type_to_ASN1Tag(asn1.t), ASN1Type_to_DERMethod(asn1.t));
    const ans = (contents) => ({
        id,
        len: DERLengthOctets.encode(contents.length),
        contents,
    });
    if (checkASN1Value(asn1, 'BOOLEAN')) {
        const contents = DERContentsOctets_BOOLEAN.encode(asn1.v);
        return ans(contents);
    }
    if (checkASN1Value(asn1, 'INTEGER')) {
        const contents = DERContentsOctets_INTEGER.encode(asn1.v);
        return ans(contents);
    }
    if (checkASN1Value(asn1, 'BIT STRING')) {
        const contents = DERContentsOctets_BIT_STRING.encode(asn1.v);
        return ans(contents);
    }
    if (checkASN1Value(asn1, 'OCTET STRING')) {
        const contents = DERContentsOctets_OCTET_STRING.encode(asn1.v);
        return ans(contents);
    }
    if (checkASN1Value(asn1, 'NULL')) {
        const contents = DERContentsOctets_NULL.encode(asn1.v);
        return ans(contents);
    }
    if (checkASN1Value(asn1, 'OBJECT IDENTIFIER')) {
        const contents = DERContentsOctets_OBJECT_IDENTIFIER.encode(asn1.v);
        return ans(contents);
    }
    if (checkASN1Value(asn1, 'IMPLICIT')) {
        const der = encodeDER({ v: asn1.v.v, t: asn1.t.t });
        return { id, len: der.len, contents: der.contents };
    }
    if (checkASN1Value(asn1, 'EXPLICIT')) {
        const component = encodeDER({ v: asn1.v.v, t: asn1.t.t });
        const contents = serialize(component);
        return ans(contents);
    }
    if (checkASN1Value(asn1, 'SEQUENCE')) {
        const contents = asn1.t.order.reduce((prev, id) => {
            let t = asn1.t.SEQUENCE[id];
            if (t == null)
                throw new TypeError(`Unexpected null`);
            if (isObject(t) && 'OPTIONAL' in t) {
                if (asn1.v[id] == null) {
                    return prev;
                }
                t = t.OPTIONAL;
            }
            const component = encodeDER({ v: asn1.v[id], t });
            return CONCAT(prev, serialize(component));
        }, new Uint8Array());
        return ans(contents);
    }
    if (checkASN1Value(asn1, 'SEQUENCEOF')) {
        const contents = asn1.v.reduce((prev, v) => {
            const component = encodeDER({ t: asn1.t.SEQUENCEOF, v });
            return CONCAT(prev, serialize(component));
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
        asn1.v.forEach((v) => {
            const component = serialize(encodeDER({ t: asn1.t.SETOF, v }));
            let i = 0;
            for (; i < components.length; i++) {
                const ci = components[i];
                if (ci == null || cmp(component, ci) === 'lt') {
                    break;
                }
            }
            components.splice(i, 0, component);
        });
        const contents = components.reduce((prev, c) => CONCAT(prev, c), new Uint8Array());
        return ans(contents);
    }
    throw new TypeError('not implemented');
}
function decodeDER(der, t) {
    if (isASN1Type(t, 'CHOICE')) {
        for (const inner of Object.values(t.CHOICE)) {
            try {
                return decodeDER(der, inner);
            }
            catch (e) {
                continue;
            }
        }
        throw new TypeError(`パースエラー。 CHOICE のいずれの型を用いても解析できない`);
    }
    const { tag, method, entireLen: leni } = DERIdentifierOctets.decode(der);
    if (!eqASN1Tag(ASN1Type_to_ASN1Tag(t), tag)) {
        throw new TypeError(`パースエラー。 ${JSON.stringify(t)} としてバイナリを解析できない`);
    }
    const der_len = der.slice(leni);
    const { contentsLength, entireLen: lenl } = DERLengthOctets.decode(der_len);
    const entireLen = leni + lenl + contentsLength;
    const der_contents = der.slice(leni + lenl, entireLen);
    if (isASN1Type(t, 'BOOLEAN')) {
        const v = DERContentsOctets_BOOLEAN.decode(der_contents);
        const asn1 = { t, v };
        return { asn1, entireLen };
    }
    if (isASN1Type(t, 'INTEGER')) {
        const v = DERContentsOctets_INTEGER.decode(der_contents);
        const asn1 = { t, v };
        return { asn1, entireLen };
    }
    if (isASN1Type(t, 'BIT STRING')) {
        const v = DERContentsOctets_BIT_STRING.decode(der_contents);
        const asn1 = { t, v };
        return { asn1, entireLen };
    }
    if (isASN1Type(t, 'OCTET STRING')) {
        const v = DERContentsOctets_OCTET_STRING.decode(der_contents);
        const asn1 = { t, v };
        return { asn1, entireLen };
    }
    if (isASN1Type(t, 'NULL')) {
        const v = DERContentsOctets_NULL.decode(der_contents);
        const asn1 = { t, v };
        return { asn1, entireLen };
    }
    if (isASN1Type(t, 'OBJECT IDENTIFIER')) {
        const v = DERContentsOctets_OBJECT_IDENTIFIER.decode(der_contents);
        const asn1 = { t, v };
        return { asn1, entireLen };
    }
    if (isASN1Type(t, 'IMPLICIT')) {
        const identifierOctets = DERIdentifierOctets.encode(ASN1Type_to_ASN1Tag(t.t), method);
        const { asn1: component } = decodeDER(CONCAT(identifierOctets, der_len), t.t);
        const asn1 = { t, v: { v: component.v } };
        return { asn1, entireLen };
    }
    if (isASN1Type(t, 'EXPLICIT')) {
        const { asn1: component } = decodeDER(der_contents, t.t);
        const asn1 = { t, v: { v: component.v } };
        return { asn1, entireLen };
    }
    if (isASN1Type(t, 'SEQUENCE')) {
        let v = {};
        let start = 0;
        for (const id of t.order) {
            let tt = t.SEQUENCE[id];
            if (tt == null)
                throw new TypeError(`Unexpected null`);
            if (isObject(tt) && 'OPTIONAL' in tt) {
                const { tag: ttag } = DERIdentifierOctets.decode(der_contents.slice(start));
                if (!eqASN1Tag(ASN1Type_to_ASN1Tag(tt.OPTIONAL), ttag)) {
                    continue;
                }
                tt = tt.OPTIONAL;
            }
            const { asn1: component, entireLen: tlen } = decodeDER(der_contents.slice(start), tt);
            v = { ...v, [id]: component.v };
            start += tlen;
        }
        const asn1 = { v, t };
        if (!isASN1Value(asn1)) {
            throw new TypeError('SEQUENCE のデコードに失敗');
        }
        return { asn1, entireLen };
    }
    if (isASN1Type(t, 'SEQUENCEOF')) {
        const v = [];
        for (let start = 0; start < contentsLength;) {
            const { asn1: component, entireLen: tlen } = decodeDER(der_contents.slice(start), t.SEQUENCEOF);
            v.push(component.v);
            start += tlen;
        }
        const asn1 = { v, t };
        if (!isASN1Value(asn1)) {
            throw new TypeError('SEQUENCEOF のデコードに失敗');
        }
        return { asn1, entireLen };
    }
    if (isASN1Type(t, 'SETOF')) {
        const v = new Set();
        for (let start = 0; start < contentsLength;) {
            const { asn1: component, entireLen: tlen } = decodeDER(der_contents.slice(start), t.SETOF);
            v.add(component.v);
            start += tlen;
        }
        const asn1 = { v, t };
        if (!isASN1Value(asn1)) {
            throw new TypeError('SETOF のデコードに失敗');
        }
        return { asn1, entireLen };
    }
    throw new TypeError(`decodeDER(asn1type: ${JSON.stringify(t)}) has been not implemented`);
}
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
        const numlistBasedOnRasix = converRadix(tag.n, 128);
        return new Uint8Array([first_octet, ...numlistBasedOnRasix]);
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
        console.log('OCTET ', octets);
        if (octets[0] == null)
            throw new TypeError('Unexpected Null');
        const ans = [];
        // the first octet has 40 * value1 + value2
        ans.push(Math.floor(octets[0] / 40));
        ans.push(octets[0] % 40);
        const covertToNumber = (octets) => {
            console.log(`aaa`, octets);
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
            console.log(vi, entireLen);
            ans.push(vi);
            start += entireLen;
        } while (start < octets.length);
        return ans;
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
function BASE64(OCTETS) {
    // window 組み込みの base64 encode 関数
    // 組み込みの関数は引数としてバイナリ文字列を要求するため
    // Uint8Array をバイナリ文字列へと変換する
    const b_str = String.fromCharCode(...OCTETS);
    const base64_encode = window.btoa(b_str);
    return base64_encode;
}
BASE64_DECODE('MIIBtjCCAVugAwIBAgITBmyf1XSXNmY/Owua2eiedgPySjAKBggqhkjOPQQDAjA5MQswCQYDVQQGEwJVUzEPMA0GA1UEChMGQW1hem9uMRkwFwYDVQQDExBBbWF6b24gUm9vdCBDQSAzMB4XDTE1MDUyNjAwMDAwMFoXDTQwMDUyNjAwMDAwMFowOTELMAkGA1UEBhMCVVMxDzANBgNVBAoTBkFtYXpvbjEZMBcGA1UEAxMQQW1hem9uIFJvb3QgQ0EgMzBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABCmXp8ZBf8ANm+gBG1bG8lKlui2yEujSLtf6ycXYqm0fc4E7O5hrOXwzpcVOho6AF2hiRVd9RFgdszflZwjrZt6jQjBAMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgGGMB0GA1UdDgQWBBSrttvXBp43rDCGB5Fwx5zEGbF4wDAKBggqhkjOPQQDAgNJADBGAiEA4IWSoxe3jfkrBqWTrBqYaGFy+uGh0PsceGCmQ5nFuMQCIQCcAu/xlJyzlvnrxir4tiz+OpAUFteMYyRIHN8wfdVoOw==');
const eq = (x, y) => {
    console.log(x, '===', y, '?', eqASN1Type(x, y));
    console.log(`${JSON.stringify(y)} === ${JSON.stringify(x)} ? ${eqASN1Type(y, x)}`);
};
console.group('NULL check');
eq('NULL', 'ANY');
const asn1_null = { t: 'NULL', v: undefined };
const der_null = DER.encode(asn1_null);
console.log(der_null, BASE64(der_null));
const decoded_null = DER.decode(der_null, 'NULL');
console.log(decoded_null);
console.groupEnd();
console.group('BOOLEAN check');
eq('BOOLEAN', 'ANY');
const asn1_boolean = { t: 'BOOLEAN', v: true };
const der_boolean = DER.encode(asn1_boolean);
console.log(der_boolean, BASE64(der_boolean));
const decoded_boolean = DER.decode(der_boolean, 'BOOLEAN');
console.log(decoded_boolean);
console.groupEnd();
console.group('INTEGER check');
eq('INTEGER', 'ANY');
const asn1_integer = { t: 'INTEGER', v: -129n };
const der_integer = DER.encode(asn1_integer);
console.log(der_integer, BASE64(der_integer));
const decoded_integer = DER.decode(der_integer, 'INTEGER');
console.log(decoded_integer);
console.groupEnd();
console.group('BIT STRING check');
eq('BIT STRING', 'ANY');
const asn1_bitstring = {
    t: 'BIT STRING',
    v: new Uint8Array([
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
    t: 'OCTET STRING',
    v: new Uint8Array([48, 3, 1, 1, 255]),
};
const der_octetstring = DER.encode(asn1_octetstring);
console.log(der_octetstring, BASE64(der_octetstring));
const decoded_octetstring = DER.decode(der_octetstring, 'OCTET STRING');
console.log(decoded_octetstring);
console.groupEnd();
console.group('OBJECT IDENTIFIER check');
const asn1_oid = {
    t: 'OBJECT IDENTIFIER',
    v: [1, 2, 840, 10045, 4, 3, 2],
};
const der_oid = DER.encode(asn1_oid);
console.log(der_oid, BASE64(der_oid));
const decoded_oid = DER.decode(der_oid, 'OBJECT IDENTIFIER');
console.log(decoded_oid);
console.groupEnd();
console.group('IMPLICIT check');
const implicitTagged = ASN1ImplicitTag(23, 'INTEGER');
const asn1_implicitTagged = {
    t: implicitTagged,
    v: { v: 65535n },
};
const der_implicitTagged = DER.encode(asn1_implicitTagged);
console.log(der_implicitTagged, BASE64(der_implicitTagged));
const decoded_implicitTagged = DER.decode(der_implicitTagged, implicitTagged);
console.log(decoded_implicitTagged);
console.groupEnd();
console.group('EXPLICIT check');
const explicitTagged = ASN1ExplicitTag(18, 'INTEGER');
const asn1_explicitTagged = {
    t: explicitTagged,
    v: { v: 12345n },
};
const der_explicitTagged = DER.encode(asn1_explicitTagged);
console.log(der_explicitTagged, BASE64(der_explicitTagged));
const decoded_explicitTagged = DER.decode(der_explicitTagged, explicitTagged);
console.log(decoded_explicitTagged);
console.groupEnd();
console.group('SEQUENCE check');
const sequence = ASN1SEQUENCE({
    version: ASN1ExplicitTag(0, 'INTEGER'),
    serialNumber: 'INTEGER',
}, ['version', 'serialNumber']);
const asn1_sequence = {
    t: sequence,
    v: {
        version: { v: 2n },
        serialNumber: 143266986699090766294700635381230934788665930n,
    },
};
const der_sequence = DER.encode(asn1_sequence);
console.log(der_sequence, BASE64(der_sequence));
const decoded_sequence = DER.decode(der_sequence, sequence);
console.log(decoded_sequence);
console.groupEnd();
console.group('SEQUENCE OF Check');
const sequenceof = ASN1SEQUENCEOF('INTEGER');
const asn1_sequenceof = {
    t: sequenceof,
    v: [1n, 2n, 3n, 65535n, 5n, 143266986699090766294700635381230934788665930n],
};
const der_sequenceof = DER.encode(asn1_sequenceof);
console.log(der_sequenceof, BASE64(der_sequenceof));
const decoded_sequenceof = DER.decode(der_sequenceof, sequenceof);
console.log(decoded_sequenceof);
console.groupEnd();
console.group('SET OF Check');
const setof = ASN1SETOF('INTEGER');
const asn1_setof = {
    t: setof,
    v: new Set([2n, 1n, 3n, 65535n, 5n, 143266986699090766294700635381230934788665930n]),
};
const der_setof = DER.encode(asn1_setof);
console.log(der_setof, BASE64(der_setof));
const decoded_setof = DER.decode(der_setof, setof);
console.log(decoded_setof);
console.groupEnd();
console.group('CHOICE Check');
const choice = ASN1CHOICE({ a: 'INTEGER', b: ASN1ExplicitTag(7, 'NULL') });
const asn1_choice = {
    t: choice,
    v: { v: { v: undefined } },
};
const der_choice = DER.encode(asn1_choice);
console.log(der_choice, BASE64(der_choice));
const decoded_choice = DER.decode(der_choice, choice);
console.log(decoded_choice);
console.groupEnd();
