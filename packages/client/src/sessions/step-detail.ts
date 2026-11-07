import { createContext, untrack, useContext } from 'solid-js';

import type { StepDetail } from '@bica/shared/protocol';
import { request } from '../socket/socket';

/** The open session's id, for rows that load their contents. */
export const SessionId = createContext<() => string>();

/**
 * Loads what a transcript row leaves out (shared/src/projection.ts): a tool
 * call by id, a thought by step key. Call it from the component.
 */
export function useStepDetail() {
  const id = useContext(SessionId);
  return (key: string): Promise<StepDetail | null> =>
    request('session.detail', { id: untrack(id), key });
}
