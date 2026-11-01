import type {
  AgentState,
  ConversationView,
  InboxState,
  LiveState,
  UsageState,
} from '@earendil-works/pi-durable';

/** The built-in documents Bica reads, which Pi Durable's view leaves untyped. */
export type PiDocs = {
  'pi.live'?: LiveState;
  'pi.agent'?: AgentState;
  'pi.inbox'?: InboxState;
  'pi.usage'?: UsageState;
};

export function piDocs(view: ConversationView) {
  return view.docs as PiDocs;
}
