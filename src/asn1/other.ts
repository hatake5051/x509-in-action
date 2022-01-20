import { eqType, isType, isValue, Type, Value } from 'asn1';
import { isObject } from 'utility';

export const ANY = (definedBy?: string, typeDerive?: (id?: unknown) => Type) => ({
  ANY: { DEFIEND_BY: definedBy, typeDerive },
});
type ANYType = { ANY: { DEFIEND_BY?: string; typeDerive?: (id?: unknown) => Type } };
type ANYValue = { ANY: Value<Type>; typeDerive?: (id?: unknown) => Type };

export const CHOICE = <T extends Record<string, Type>>(s: T) => ({ CHOICE: s });
type CHOICEType = { CHOICE: Record<string, Type> };
type CHOICEValue<C extends CHOICEType['CHOICE']> = C extends Record<infer S, Type>
  ? { CHOICE: Value<C[S]> }
  : never;

export type OtherType = ANYType | CHOICEType;
export const isOtherType = (arg: unknown): arg is OtherType =>
  (isObject<ANYType>(arg) &&
    isObject<ANYType['ANY']>(arg.ANY) &&
    (arg.ANY.DEFIEND_BY == null || typeof arg.ANY.DEFIEND_BY === 'string') &&
    (arg.ANY.typeDerive == null || typeof arg.ANY.typeDerive === 'function')) ||
  (isObject<CHOICEType>(arg) &&
    isObject<CHOICEType['CHOICE']>(arg.CHOICE) &&
    Object.values(arg.CHOICE).every((t) => isType(t)));

export function checkOtherType<N extends OtherTypeName>(t: Type, n?: N): t is OtherTypeFromName<N> {
  if (n == null) return typeof t === 'object' && ('ANY' in t || 'CHOICE' in t);
  return typeof t === 'object' && n in t;
}

export function eqOtherType(l?: OtherType, r?: OtherType): boolean {
  if (l == null && r == null) return true;
  if (l == null || r == null) return false;
  if ('ANY' in l || 'ANY' in r) return true;
  if ('CHOICE' in l) {
    return (
      'CHOICE' in r &&
      Object.entries(l.CHOICE).every(([li, lt]) => eqType(lt, r.CHOICE[li])) &&
      Object.entries(r.CHOICE).every(([ri, rt]) => eqType(l.CHOICE[ri], rt))
    );
  }
  return false;
}

export type OtherTypeName = 'ANY' | 'CHOICE';
export const isOtherTypeName = (arg: unknown): arg is OtherTypeName =>
  ['ANY', 'CHOICE'].some((x) => x === arg);

export type OtherTypeFromName<N extends OtherTypeName> = N extends 'ANY'
  ? ANYType
  : N extends 'CHOICE'
  ? CHOICEType
  : never;
export const OtherNameFromType = (t: OtherType): OtherTypeName => {
  if ('ANY' in t) return 'ANY';
  if ('CHOICE' in t) return 'CHOICE';
  throw new TypeError('Unexpected flow');
};

export type OtherValue<T extends OtherType> = T extends ANYType
  ? ANYValue
  : T extends CHOICEType
  ? CHOICEValue<T['CHOICE']>
  : never;

export function isOtherValue<T extends OtherType>(arg: unknown, t: T): arg is OtherValue<T> {
  if ('CHOICE' in t) {
    return (
      isObject<OtherValue<CHOICEType>>(arg) &&
      Object.values(t.CHOICE).some((t) => isValue(arg.CHOICE, t))
    );
  }
  if ('ANY' in t) {
    return isObject<ANYValue>(arg);
  }
  return false;
}
