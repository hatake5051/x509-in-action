/**
 * ２つのバイト列を結合する
 * @param {Uint8Array} A - 先頭バイト列
 * @param {Uint8Array} B - 後続バイト列
 * @return {Uint8Array} A の後ろに B をつなげたバイト列 A || B
 */
export function CONCAT(A: Uint8Array, B: Uint8Array): Uint8Array {
  const ans = new Uint8Array(A.length + B.length);
  ans.set(A);
  ans.set(B, A.length);
  return ans;
}

/**
 * 文字列を UTF8 バイトエンコードする。(string to Uint8Array)
 * @param {string} STRING - 文字列
 * @return {Uint8Array} UTF8 バイト列
 */
export function UTF8(STRING: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(STRING);
}

/**
 * 文字列に UTF8 バイトデコードする (Uint8Array to string)
 * @param {Uint8Array} OCTETS - UTF8 バイト列
 * @return {string} 文字列
 */
export function UTF8_DECODE(OCTETS: Uint8Array): string {
  const decoder = new TextDecoder();
  return decoder.decode(OCTETS);
}

/**
 * T のプロパティを全て unknown | undefined 型に変える
 */
type WouldBe<T> = { [P in keyof T]?: unknown };

/**
 * value を WouldBE<T> かどうか判定する。
 * T のプロパティを持つかもしれないところまで。
 * ref: https://qiita.com/suin/items/e0f7b7add75092196cd8
 * @template T
 * @param {unknown} value - 型ガード対象の値
 * @return {value is WouldBe<T>} value が WouldBe<T> なら true
 */
export const isObject = <T extends object>(value: unknown): value is WouldBe<T> =>
  typeof value === 'object' && value !== null;
