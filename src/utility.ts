

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
 