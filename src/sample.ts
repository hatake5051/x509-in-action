import { DER } from 'der';
import { CONCAT } from 'utility';
import {
  ASN1CHOICE,
  ASN1ExplicitTag,
  ASN1ImplicitTag,
  ASN1SEQUENCE,
  ASN1SEQUENCEOF,
  ASN1SETOF,
  ASN1TagNumber,
  ASN1Type,
  ASN1Value,
  equalsASN1Type,
} from './asn1';

const AlgorithmIdentifier = ASN1SEQUENCE(
  {
    algorithm: 'OBJECT IDENTIFIER',
    parameters: { OPTIONAL: 'ANY' },
  },
  ['algorithm', 'parameters']
);

const AttributeTypeAndValue = ASN1SEQUENCE(
  {
    type: 'OBJECT IDENTIFIER',
    value: 'ANY',
  },
  ['type', 'value']
);

const RelativeDistinguishedName = ASN1SETOF(AttributeTypeAndValue);
const RDNSequence = ASN1SEQUENCEOF(RelativeDistinguishedName);
const Name = ASN1CHOICE({ rdnSequence: RDNSequence });

const Time = ASN1CHOICE({
  utcTime: 'UTCTime',
  // generalTime: 'GeneralizedTime'
});
const Validity = ASN1SEQUENCE({ notBefore: Time, notAfter: Time }, ['notBefore', 'notAfter']);

const SubjectPublicKeyInfo = ASN1SEQUENCE(
  {
    algorithm: AlgorithmIdentifier,
    subjectPublicKey: 'BIT STRING',
  },
  ['algorithm', 'subjectPublicKey']
);

const UniqueIdentifier = 'BIT STRING';

const Extension = ASN1SEQUENCE(
  {
    extnID: 'OBJECT IDENTIFIER',
    critical: 'BOOLEAN',
    extnValue: 'OCTET STRING',
  },
  ['extnID', 'critical', 'extnValue']
);

const Extensions = ASN1SEQUENCEOF(Extension);

const TBSCertificate = ASN1SEQUENCE(
  {
    version: ASN1ExplicitTag(0 as ASN1TagNumber, 'INTEGER'),
    serialNumber: 'INTEGER',
    signature: AlgorithmIdentifier,
    issuer: Name,
    validity: Validity,
    subject: Name,
    subjectPublicKeyInfo: SubjectPublicKeyInfo,
    issuerUniqueID: { OPTIONAL: ASN1ImplicitTag(1 as ASN1TagNumber, UniqueIdentifier) },
    subjectUniqueID: { OPTIONAL: ASN1ImplicitTag(2 as ASN1TagNumber, UniqueIdentifier) },
    extensions: { OPTIONAL: ASN1ImplicitTag(3 as ASN1TagNumber, Extensions) },
  },
  ['version', 'serialNumber', 'signature', 'issuer', 'validity', 'subject', 'subjectPublicKeyInfo']
);

const Certificate = ASN1SEQUENCE(
  {
    tbsCertificate: TBSCertificate,
    signatureAlgorithm: AlgorithmIdentifier,
    signatureValue: 'BIT STRING',
  },
  ['tbsCertificate', 'signatureAlgorithm', 'signatureValue']
);

/**
 * バイナリに文字列を BASE64 デコードする。
 * デコードに失敗すると TypeError を吐く。
 */
function BASE64_DECODE(STRING: string) {
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

const DERCert = BASE64_DECODE(
  'MIIBtjCCAVugAwIBAgITBmyf1XSXNmY/Owua2eiedgPySjAKBggqhkjOPQQDAjA5MQswCQYDVQQGEwJVUzEPMA0GA1UEChMGQW1hem9uMRkwFwYDVQQDExBBbWF6b24gUm9vdCBDQSAzMB4XDTE1MDUyNjAwMDAwMFoXDTQwMDUyNjAwMDAwMFowOTELMAkGA1UEBhMCVVMxDzANBgNVBAoTBkFtYXpvbjEZMBcGA1UEAxMQQW1hem9uIFJvb3QgQ0EgMzBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABCmXp8ZBf8ANm+gBG1bG8lKlui2yEujSLtf6ycXYqm0fc4E7O5hrOXwzpcVOho6AF2hiRVd9RFgdszflZwjrZt6jQjBAMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgGGMB0GA1UdDgQWBBSrttvXBp43rDCGB5Fwx5zEGbF4wDAKBggqhkjOPQQDAgNJADBGAiEA4IWSoxe3jfkrBqWTrBqYaGFy+uGh0PsceGCmQ5nFuMQCIQCcAu/xlJyzlvnrxir4tiz+OpAUFteMYyRIHN8wfdVoOw=='
);
const ASN1Cert: ASN1Value<typeof Certificate> = {
  t: Certificate,
  v: {
    tbsCertificate: {
      version: { v: 2n },
      serialNumber: 143266986699090766294700635381230934788665930n,
      signature: { algorithm: [1, 2, 840, 10045, 4, 3, 2] },
      issuer: {
        v: [
          new Set([{ type: [2, 5, 4, 6], value: 'US' }]),
          new Set([{ type: [2, 5, 4, 10], value: 'Amazon' }]),
          new Set([{ type: [2, 5, 4, 3], value: 'Amazon Root CA 3' }]),
        ],
      },
      validity: {
        notBefore: { v: '150526000000Z' },
        notAfter: { v: '400526000000Z' },
      },
      subject: {
        v: [
          new Set([{ type: [2, 5, 4, 6], value: 'US' }]),
          new Set([{ type: [2, 5, 4, 10], value: 'Amazon' }]),
          new Set([{ type: [2, 5, 4, 3], value: 'Amazon Root CA 3' }]),
        ],
      },
      subjectPublicKeyInfo: {
        algorithm: {
          algorithm: [1, 2, 840, 10045, 2, 1],
          parameters: [1, 2, 840, 10045, 3, 1, 7],
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

const eq = (x: ASN1Type, y: ASN1Type) => {
  console.log(x, '===', y, '?', equalsASN1Type(x, y));
  console.log(`${JSON.stringify(y)} === ${JSON.stringify(x)} ? ${equalsASN1Type(y, x)}`);
};

console.group('NULL check');
eq('NULL', 'ANY');
const asn1_null: ASN1Value<'NULL'> = { t: 'NULL', v: undefined };
const der_null = DER.encode(asn1_null);
console.log(
  der_null,
  DER.decode(CONCAT(der_null.identifier, CONCAT(der_null.length, der_null.contents)), 'NULL')
);
console.groupEnd();

console.group('INTEGER check');
eq('INTEGER', 'ANY');
const asn1_integer: ASN1Value<'INTEGER'> = { t: 'INTEGER', v: -129n };
const der_integer = DER.encode(asn1_integer);
console.log(
  der_integer,
  DER.decode(
    CONCAT(der_integer.identifier, CONCAT(der_integer.length, der_integer.contents)),
    'INTEGER'
  )
);
console.groupEnd();

console.group('IMPLICIT check');
const implicitTagged = ASN1ImplicitTag(0 as ASN1TagNumber, 'NULL');
eq(implicitTagged, { IMPLICIT: 'unknown', t: 'ANY' });
const asn1_implicitTagged: ASN1Value<typeof implicitTagged> = {
  t: implicitTagged,
  v: { v: undefined },
};
const der_implicitTagged = DER.encode(asn1_implicitTagged);
console.log(
  der_implicitTagged,
  DER.decode(
    CONCAT(
      der_implicitTagged.identifier,
      CONCAT(der_implicitTagged.length, der_implicitTagged.contents)
    ),
    implicitTagged
  )
);
console.groupEnd();

console.group('EXPLICIT check');
const explicitTagged = ASN1ExplicitTag(0 as ASN1TagNumber, implicitTagged);
eq(explicitTagged, { EXPLICIT: 'unknown', t: 'ANY' });
const asn1_explicitTagged: ASN1Value<typeof explicitTagged> = {
  t: explicitTagged,
  v: { v: { v: undefined } },
};
const der_explicitTagged = DER.encode(asn1_explicitTagged);
console.log(
  der_explicitTagged,
  DER.decode(
    CONCAT(
      der_explicitTagged.identifier,
      CONCAT(der_explicitTagged.length, der_explicitTagged.contents)
    ),
    explicitTagged
  )
);
console.groupEnd();

console.group('SEQUENCE check');
const sequence = ASN1SEQUENCE(
  {
    version: ASN1ExplicitTag(0 as ASN1TagNumber, 'INTEGER'),
    serialNumber: 'INTEGER',
  },
  ['version', 'serialNumber']
);
eq(sequence, { SEQUENCE: 'unknown' });
const asn1_sequence: ASN1Value<typeof sequence> = {
  t: sequence,
  v: {
    version: { v: 2n },
    serialNumber: 143266986699090766294700635381230934788665930n,
  },
};
const der_sequence = DER.encode(asn1_sequence);
console.log(der_sequence);
console.groupEnd();