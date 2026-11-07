import { request } from '../socket/socket';

export function detachSession(id: string) {
  return request('session.detach', { id });
}

export function unwatchSession(id: string) {
  return request('session.unwatch', { id });
}
