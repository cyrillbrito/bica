import { createSignal } from 'solid-js';

// Focused, not just visible: a tab behind another window, or a laptop left
// open on a session, isn't someone looking.
function isFocused() {
  return document.visibilityState === 'visible' && document.hasFocus();
}
const [focused, setFocused] = createSignal(isFocused(), {
  name: 'pageFocused',
});
export { focused as pageFocused };

function update() {
  return setFocused(isFocused());
}
addEventListener('focus', update);
addEventListener('blur', update);
document.addEventListener('visibilitychange', update);
