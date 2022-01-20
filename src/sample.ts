import { ASN1Value, eqType, Type } from 'asn1';
import { CHOICE } from 'asn1/other';
import { SEQUENCE, SEQUENCEOF, SETOF } from 'asn1/structured';
import { TagNumber } from 'asn1/tag';
import { ExplicitTag, ImplicitTag } from 'asn1/tagged';
import { DER } from 'der';
import { UTF8 } from 'utility';

/**
 * バイナリに文字列を BASE64 デコードする。
 * デコードに失敗すると TypeError を吐く。
 */
function BASE64_DECODE(STRING: string): Uint8Array {
  try {
    const b_str = window.atob(STRING);
    // バイナリ文字列を Uint8Array に変換する
    const b = new Uint8Array(b_str.length);
    for (let i = 0; i < b_str.length; i++) {
      b[i] = b_str.charCodeAt(i);
    }
    return b;
  } catch (e: unknown) {
    throw new TypeError(`与えられた文字列 ${STRING} は base64 encoded string ではない`);
  }
}

function BASE64(OCTETS: Uint8Array): string {
  // window 組み込みの base64 encode 関数
  // 組み込みの関数は引数としてバイナリ文字列を要求するため
  // Uint8Array をバイナリ文字列へと変換する
  const b_str = String.fromCharCode(...OCTETS);
  const base64_encode = window.btoa(b_str);
  return base64_encode;
}

const eq = (x: Type, y: Type) => {
  console.log(x, '===', y, '?', eqType(x, y));
  console.log(`${JSON.stringify(y)} === ${JSON.stringify(x)} ? ${eqType(y, x)}`);
};

console.group('NULL check');
eq('NULL', { ANY: {} });
const asn1_null: ASN1Value<'NULL'> = { type: 'NULL', value: undefined };
const der_null = DER.encode(asn1_null);
console.log(der_null, BASE64(der_null));
const decoded_null = DER.decode(der_null, 'NULL');
console.log(decoded_null);
console.groupEnd();

console.group('BOOLEAN check');
eq('BOOLEAN', { ANY: {} });
const asn1_boolean: ASN1Value<'BOOLEAN'> = { type: 'BOOLEAN', value: true };
const der_boolean = DER.encode(asn1_boolean);
console.log(der_boolean, BASE64(der_boolean));
const decoded_boolean = DER.decode(der_boolean, 'BOOLEAN');
console.log(decoded_boolean);
console.groupEnd();

console.group('INTEGER check');
eq('INTEGER', { ANY: {} });
const asn1_integer: ASN1Value<'INTEGER'> = { type: 'INTEGER', value: -129n };
const der_integer = DER.encode(asn1_integer);
console.log(der_integer, BASE64(der_integer));
const decoded_integer = DER.decode(der_integer, 'INTEGER');
console.log(decoded_integer);
console.groupEnd();

console.group('BIT STRING check');
eq('BIT STRING', { ANY: {} });
const asn1_bitstring: ASN1Value<'BIT STRING'> = {
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
const asn1_octetstring: ASN1Value<'OCTET STRING'> = {
  type: 'OCTET STRING',
  value: new Uint8Array([48, 3, 1, 1, 255]),
};
const der_octetstring = DER.encode(asn1_octetstring);
console.log(der_octetstring, BASE64(der_octetstring));
const decoded_octetstring = DER.decode(der_octetstring, 'OCTET STRING');
console.log(decoded_octetstring);
console.groupEnd();

console.group('OBJECT IDENTIFIER check');
const asn1_oid: ASN1Value<'OBJECT IDENTIFIER'> = {
  type: 'OBJECT IDENTIFIER',
  value: [1, 2, 840, 10045, 4, 3, 2],
};
const der_oid = DER.encode(asn1_oid);
console.log(der_oid, BASE64(der_oid));
const decoded_oid = DER.decode(der_oid, 'OBJECT IDENTIFIER');
console.log(decoded_oid);
console.groupEnd();

console.group('UTCTime check');
const asn1_utctime: ASN1Value<'UTCTime'> = {
  type: 'UTCTime',
  value: new Date(Date.UTC(2015, 5 - 1, 26)),
};
const der_utctime = DER.encode(asn1_utctime);
console.log(der_utctime, BASE64(der_utctime));
const decoded_utctime = DER.decode(der_utctime, 'UTCTime');
console.log(decoded_utctime);
console.groupEnd();

console.group('IMPLICIT check');
const implicitTagged = ImplicitTag(23 as TagNumber, 'INTEGER');
const asn1_implicitTagged: ASN1Value<typeof implicitTagged> = {
  type: implicitTagged,
  value: { IMPLICIT: 65535n },
};
const der_implicitTagged = DER.encode(asn1_implicitTagged);
console.log(der_implicitTagged, BASE64(der_implicitTagged));
const decoded_implicitTagged = DER.decode(der_implicitTagged, implicitTagged);
console.log(decoded_implicitTagged);
console.groupEnd();

console.group('EXPLICIT check');
const explicitTagged = ExplicitTag(18 as TagNumber, 'INTEGER');
const asn1_explicitTagged: ASN1Value<typeof explicitTagged> = {
  type: explicitTagged,
  value: { EXPLICIT: 12345n },
};
const der_explicitTagged = DER.encode(asn1_explicitTagged);
console.log(der_explicitTagged, BASE64(der_explicitTagged));
const decoded_explicitTagged = DER.decode(der_explicitTagged, explicitTagged);
console.log(decoded_explicitTagged);
console.groupEnd();

console.group('SEQUENCE check');
const sequence = SEQUENCE(
  {
    version: ExplicitTag(0 as TagNumber, 'INTEGER'),
    serialNumber: 'INTEGER',
  },
  ['version', 'serialNumber']
);
const asn1_sequence: ASN1Value<typeof sequence> = {
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
const asn1_sequenceof: ASN1Value<typeof sequenceof> = {
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
const asn1_setof: ASN1Value<typeof setof> = {
  type: setof,
  value: new Set([2n, 1n, 3n, 65535n, 5n, 143266986699090766294700635381230934788665930n]),
};
const der_setof = DER.encode(asn1_setof);
console.log(der_setof, BASE64(der_setof));
const decoded_setof = DER.decode(der_setof, setof);
console.log(decoded_setof);
console.groupEnd();

console.group('CHOICE Check');
const choice = CHOICE({ a: 'INTEGER', b: ExplicitTag(7 as TagNumber, 'NULL') });
const asn1_choice: ASN1Value<typeof choice> = {
  type: choice,
  value: { CHOICE: { EXPLICIT: undefined } },
};
const der_choice = DER.encode(asn1_choice);
console.log(der_choice, BASE64(der_choice));
const decoded_choice = DER.decode(der_choice, choice);
console.log(decoded_choice);
console.groupEnd();

console.group('X509 Certificate');
const AlgorithmIdentifier = SEQUENCE(
  {
    algorithm: 'OBJECT IDENTIFIER',
    parameters: {
      OPTIONAL: { ANY: { DEFIEND_BY: 'algorithm', typeDerive: () => 'OBJECT IDENTIFIER' } },
    },
  },
  ['algorithm', 'parameters']
);

console.group('X509 AlgorithmIdentifier');
const asn1_aid: ASN1Value<typeof AlgorithmIdentifier> = {
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

const AttributeTypeAndValue = SEQUENCE(
  {
    type: 'OBJECT IDENTIFIER',
    value: { ANY: { DEFIEND_BY: 'type', typeDerive: () => 'OCTET STRING' } },
  },
  ['type', 'value']
);

const RelativeDistinguishedName = SETOF(AttributeTypeAndValue);
const RDNSequence = SEQUENCEOF(RelativeDistinguishedName);
const Name = CHOICE({ rdnSequence: RDNSequence });

const Time = CHOICE({
  utcTime: 'UTCTime',
  // generalTime: 'GeneralizedTime'
});
const Validity = SEQUENCE({ notBefore: Time, notAfter: Time }, ['notBefore', 'notAfter']);

const SubjectPublicKeyInfo = SEQUENCE(
  {
    algorithm: AlgorithmIdentifier,
    subjectPublicKey: 'BIT STRING',
  },
  ['algorithm', 'subjectPublicKey']
);

const UniqueIdentifier = 'BIT STRING';

const Extension = SEQUENCE(
  {
    extnID: 'OBJECT IDENTIFIER',
    critical: 'BOOLEAN',
    extnValue: 'OCTET STRING',
  },
  ['extnID', 'critical', 'extnValue']
);

const Extensions = SEQUENCEOF(Extension);

const TBSCertificate = SEQUENCE(
  {
    version: ExplicitTag(0 as TagNumber, 'INTEGER'),
    serialNumber: 'INTEGER',
    signature: AlgorithmIdentifier,
    issuer: Name,
    validity: Validity,
    subject: Name,
    subjectPublicKeyInfo: SubjectPublicKeyInfo,
    issuerUniqueID: { OPTIONAL: ImplicitTag(1 as TagNumber, UniqueIdentifier) },
    subjectUniqueID: { OPTIONAL: ImplicitTag(2 as TagNumber, UniqueIdentifier) },
    extensions: { OPTIONAL: ImplicitTag(3 as TagNumber, Extensions) },
  },
  [
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
  ]
);

const Certificate = SEQUENCE(
  {
    tbsCertificate: TBSCertificate,
    signatureAlgorithm: AlgorithmIdentifier,
    signatureValue: 'BIT STRING',
  },
  ['tbsCertificate', 'signatureAlgorithm', 'signatureValue']
);
const asn1_crt: ASN1Value<typeof Certificate> = {
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
const der_crt_b64 =
  'MIIBtjCCAVugAwIBAgITBmyf1XSXNmY/Owua2eiedgPySjAKBggqhkjOPQQDAjA5MQswCQYDVQQGEwJVUzEPMA0GA1UEChMGQW1hem9uMRkwFwYDVQQDExBBbWF6b24gUm9vdCBDQSAzMB4XDTE1MDUyNjAwMDAwMFoXDTQwMDUyNjAwMDAwMFowOTELMAkGA1UEBhMCVVMxDzANBgNVBAoTBkFtYXpvbjEZMBcGA1UEAxMQQW1hem9uIFJvb3QgQ0EgMzBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABCmXp8ZBf8ANm+gBG1bG8lKlui2yEujSLtf6ycXYqm0fc4E7O5hrOXwzpcVOho6AF2hiRVd9RFgdszflZwjrZt6jQjBAMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgGGMB0GA1UdDgQWBBSrttvXBp43rDCGB5Fwx5zEGbF4wDAKBggqhkjOPQQDAgNJADBGAiEA4IWSoxe3jfkrBqWTrBqYaGFy+uGh0PsceGCmQ5nFuMQCIQCcAu/xlJyzlvnrxir4tiz+OpAUFteMYyRIHN8wfdVoOw==';
console.log(der_crt, BASE64(der_crt), BASE64(der_crt) === der_crt_b64);
const decoded_crt = DER.decode(der_crt, Certificate);
console.log(decoded_crt);
console.groupEnd();
