import { render } from 'solid-js/web';
import App from './App';

// Clear SSR placeholder content before rendering to avoid a brief duplicated layout during hydration.
const mount = document.getElementById('app');
if (mount) mount.innerHTML = '';
render(() => <App />, mount!);
