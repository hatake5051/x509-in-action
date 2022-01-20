import { ASN1Value, checkASN1Value, isASN1Value } from 'asn1';
import { TagFromType } from 'asn1/tag';
import { CONCAT } from 'utility';
import { ContentsOctets, DERContentsOctets } from './contents';
import { DERIdentifierOctets, IdentifierOctets } from './identifier';
import { DERLengthOctets, LengthOctets } from './length';
import { DERMethodFromType } from './method';

export function encode(
  asn1: ASN1Value,
  ctx?: {
    parentSEQUENCE?: Record<string, unknown>;
  }
): {
  id: IdentifierOctets;
  len: LengthOctets;
  contents: ContentsOctets;
} {
  if (checkASN1Value(asn1, 'ANY')) {
    const derive = asn1.type.ANY.typeDerive;
    if (derive == null) throw new TypeError('ANY の actual type を判断できません');
    const t = derive(
      asn1.type.ANY.DEFIEND_BY == null || ctx?.parentSEQUENCE == null
        ? undefined
        : ctx.parentSEQUENCE[asn1.type.ANY.DEFIEND_BY]
    );
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
  const ans = (contents: ContentsOctets) => ({
    id,
    len: DERLengthOctets.encode(contents.length),
    contents,
  });
  if (checkASN1Value(asn1, 'IMPLICIT')) {
    const inner = { type: asn1.type.t, value: asn1.value.IMPLICIT };
    if (!isASN1Value(inner)) throw new TypeError('タグづけされた内部の value と type が一致しない');
    const der = encode(inner);
    return { id, len: der.len, contents: der.contents };
  }
  if (checkASN1Value(asn1, 'EXPLICIT')) {
    const inner = { type: asn1.type.t, value: asn1.value.EXPLICIT };
    if (!isASN1Value(inner)) throw new TypeError('タグづけされた内部の value と type が一致しない');
    const der = serialize(encode(inner));
    return ans(der as ContentsOctets);
  }
  if (checkASN1Value(asn1, 'SEQUENCE')) {
    const contents = asn1.type.order.reduce((prev, id) => {
      let componentType = asn1.type.SEQUENCE[id];
      if (componentType == null) throw new TypeError(`Unexpected null`);
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
    }, new Uint8Array()) as ContentsOctets;
    return ans(contents);
  }
  if (checkASN1Value(asn1, 'SEQUENCEOF')) {
    const contents = asn1.value.reduce<Uint8Array>((prev, value) => {
      const component = { type: asn1.type.SEQUENCEOF, value };
      if (!isASN1Value(component))
        throw new TypeError('SEQUENCEOF 内部の value と type が一致しない');
      const componentDER = serialize(encode(component));
      return CONCAT(prev, componentDER);
    }, new Uint8Array()) as ContentsOctets;
    return ans(contents);
  }
  if (checkASN1Value(asn1, 'SETOF')) {
    const cmp = (l: Uint8Array, r: Uint8Array): 'gt' | 'eq' | 'lt' => {
      for (let i = 0; i < l.length; i++) {
        const li = l[i];
        if (li == null) break;
        const ri = r[i];
        if (ri == null) return 'gt';
        if (li > ri) return 'gt';
        if (li < ri) return 'lt';
      }
      return 'eq';
    };

    const components: Uint8Array[] = [];
    asn1.value.forEach((value) => {
      const component = { type: asn1.type.SETOF, value };
      if (!isASN1Value(component)) throw new TypeError('SETOF 内部の value と type が一致しない');
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
    return ans(CONCAT(...components) as ContentsOctets);
  }
  try {
    return ans(DERContentsOctets.encode(asn1));
  } catch (e) {
    throw new TypeError(`${asn1} のエンコードには対応していない`);
  }
}

function serialize(x: {
  id: IdentifierOctets;
  len: LengthOctets;
  contents: ContentsOctets;
}): Uint8Array {
  return CONCAT(x.id, x.len, x.contents);
}
