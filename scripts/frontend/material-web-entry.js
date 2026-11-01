// Собираем Material Web локально, чтобы рабочий сайт не зависел от стороннего CDN.
// Импортируем компоненты по отдельности, включая в сборку только нужные.
import '@material/web/progress/linear-progress.js';

document.documentElement.dataset.materialWeb = 'ready';
document.dispatchEvent(new CustomEvent('material-web-ready'));
