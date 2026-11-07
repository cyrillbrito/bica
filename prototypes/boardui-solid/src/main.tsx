import { render } from '@solidjs/web';

import './styles/globals.css';
import BicaApp from './app/BicaApp';
import Gallery from './Gallery';

// Two pages, picked by path; Vite serves index.html for both.
const isApp = location.pathname.startsWith('/app');
const Page = isApp ? BicaApp : Gallery;

// The gallery draws both themes itself; its dark half is a `.dark` region,
// which only works under a light <html> (BoardUI has no `.light` class).
if (!isApp) document.documentElement.classList.remove('dark');

render(() => <Page />, document.getElementById('root')!);
