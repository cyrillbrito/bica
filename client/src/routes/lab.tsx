import { lazy } from 'solid-js';

import NotFound from './[...404]';

// A temporary brainstorm page for Bica's personality, development only like
// /ui. Delete it with playground/Lab.tsx once the direction is settled.
export default import.meta.env.DEV
  ? lazy(() => import('../playground/Lab'))
  : NotFound;
