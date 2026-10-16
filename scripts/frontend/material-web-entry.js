// Build Material Web locally so production does not depend on a third-party CDN.
// Components are imported individually to keep this vendor bundle intentional.
import '@material/web/progress/linear-progress.js';

document.documentElement.dataset.materialWeb = 'ready';
document.dispatchEvent(new CustomEvent('material-web-ready'));
