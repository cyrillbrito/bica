import { lazy } from 'solid-js';

import NotFound from './[...404]';

// Development only (docs/UI.md): a production build folds this to the 404
// and leaves the playground out of the bundle.
export default import.meta.env.DEV
  ? lazy(() => import('../playground/Playground'))
  : NotFound;
