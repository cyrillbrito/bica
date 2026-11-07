import type { WorkspaceRef } from '@bica/shared/protocol';
import { request, useTopic } from '../socket/socket';

export function useTerminals() {
  return useTopic('terminals', () => ({}));
}

export function useTerminalOutput(id: () => string) {
  return useTopic('terminal', () => ({ id: id() }));
}

export function createTerminal(ref: WorkspaceRef, command?: string) {
  return request('terminal.create', { ...ref, command });
}

export function terminalInput(id: string, data: string) {
  return request('terminal.input', { id, data });
}

export function resizeTerminal(id: string, cols: number, rows: number) {
  return request('terminal.resize', { id, cols, rows });
}

export function stopTerminal(id: string) {
  return request('terminal.stop', { id });
}

export function restartTerminal(id: string) {
  return request('terminal.restart', { id });
}

export function removeTerminal(id: string) {
  return request('terminal.remove', { id });
}

/** Takes it from its session: archiving that session leaves it open. */
export function detachTerminal(id: string) {
  return request('terminal.detach', { id });
}
