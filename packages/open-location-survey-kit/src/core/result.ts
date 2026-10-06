/**
 * The outcome of anything that can fail. Failure is a value carrying what
 * happened, never a thrown exception and never a sentence meant for display.
 */
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E }

export const Ok = <T>(value: T): Result<T, never> => ({ ok: true, value })

export const Err = <E>(error: E): Result<never, E> => ({ ok: false, error })
