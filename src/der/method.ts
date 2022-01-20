import { Type } from 'asn1';

export type DERMethod = 'Primitive' | 'Constructed';

export function DERMethodFromType(t: Type): DERMethod {
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
  if ('IMPLICIT' in t) return DERMethodFromType(t.t);
  throw new TypeError(`DERMethodFromType(${JSON.stringify(t)}) に失敗`);
}
