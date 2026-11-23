import { request } from '../socket/socket';

/** Answers a request on its card (docs/requests.md). */
export function answerRequest(session: string, call: string, value: string) {
  return request('request.answer', { session, call, value });
}
