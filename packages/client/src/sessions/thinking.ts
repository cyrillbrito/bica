import { stored } from '../ui/stored';

// Per device: a phone may want a tighter transcript.
export const [hideThinking, setHideThinking] = stored('hideThinking', false);
