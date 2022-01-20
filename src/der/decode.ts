import { ASN1Value, checkType, Type } from 'asn1';
import { eqTag, TagFromType } from 'asn1/tag';
import { CONCAT } from 'utility';
import { ContentsOctets, DERContentsOctets } from './contents';
import { DERIdentifierOctets, IdentifierOctets } from './identifier';
import { DERLengthOctets, LengthOctets } from './length';

export function decode(
  der: Uint8Array,
  t: Type,
  ctx?: {
    parentSEQUENCE?: Record<string, unknown>;
  }
): { asn1: ASN1Value; entireLen: number } {
  if (checkType(t, 'ANY')) {
    if (t.ANY.typeDerive == null) throw new TypeError('ANY の actual Type を決定できない');
    const actualType = t.ANY.typeDerive(
      ctx?.parentSEQUENCE == null || t.ANY.DEFIEND_BY == null
        ? undefined
        : ctx.parentSEQUENCE[t.ANY.DEFIEND_BY]
    );
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
      } catch (e) {
        continue;
      }
    }
    throw new TypeError(`パースエラー。 CHOICE のいずれの型を用いても解析できない`);
  }

  const { tag, method, entireLen: leni } = DERIdentifierOctets.decode(der as IdentifierOctets);
  if (!eqTag(TagFromType(t), tag)) {
    throw new TypeError(`パースエラー。expected: tag of ${JSON.stringify(t)}, but actual: ${tag} `);
  }
  const der_len = der.slice(leni) as LengthOctets;
  const { contentsLength, entireLen: lenl } = DERLengthOctets.decode(der_len);
  const entireLen = leni + lenl + contentsLength;
  const der_contents = der.slice(leni + lenl, entireLen) as ContentsOctets;
  if (checkType(t, 'IMPLICIT')) {
    const identifierOctets = DERIdentifierOctets.encode(TagFromType(t.t), method);
    const { asn1: component } = decode(CONCAT(identifierOctets, der_len), t.t, ctx);
    const asn1: ASN1Value<typeof t> = { type: t, value: { IMPLICIT: component.value } };
    return { asn1, entireLen };
  }
  if (checkType(t, 'EXPLICIT')) {
    const { asn1: component } = decode(der_contents, t.t, ctx);
    const asn1: ASN1Value<typeof t> = { type: t, value: { EXPLICIT: component.value } };
    return { asn1, entireLen };
  }
  if (checkType(t, 'SEQUENCE')) {
    let value: Partial<ASN1Value<typeof t>['value']> = {};
    let start = 0;
    for (const id of t.order) {
      if (der_contents.length <= start) {
        break;
      }
      let tt = t.SEQUENCE[id];
      if (tt == null) throw new TypeError(`Unexpected null`);
      if (typeof tt === 'object' && 'OPTIONAL' in tt) {
        if (!checkType(tt.OPTIONAL, 'ANY')) {
          const { tag: ttag } = DERIdentifierOctets.decode(
            der_contents.slice(start) as IdentifierOctets
          );
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
      } catch (e) {
        if (checkType(tt, 'ANY')) continue;
        throw e;
      }
    }
    const asn1: ASN1Value<typeof t> = { type: t, value };
    return { asn1, entireLen };
  }
  if (checkType(t, 'SEQUENCEOF')) {
    const value: ASN1Value<typeof t>['value'] = [];
    for (let start = 0; start < contentsLength; ) {
      const { asn1: component, entireLen: tlen } = decode(der_contents.slice(start), t.SEQUENCEOF);
      value.push(component.value);
      start += tlen;
    }
    const asn1: ASN1Value<typeof t> = { type: t, value };
    return { asn1, entireLen };
  }
  if (checkType(t, 'SETOF')) {
    const value: ASN1Value<typeof t>['value'] = new Set();
    for (let start = 0; start < contentsLength; ) {
      const { asn1: component, entireLen: tlen } = decode(der_contents.slice(start), t.SETOF);
      value.add(component.value);
      start += tlen;
    }
    const asn1: ASN1Value<typeof t> = { type: t, value };
    return { asn1, entireLen };
  }
  try {
    const asn1 = DERContentsOctets.decode(der_contents, t);
    return { asn1, entireLen };
  } catch (e) {
    throw new TypeError(`${t} のデコードには対応していない`);
  }
  throw new TypeError(`decodeDER(asn1type: ${JSON.stringify(t)}) has been not implemented`);
}
