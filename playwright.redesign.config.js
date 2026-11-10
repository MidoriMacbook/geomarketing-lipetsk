import base from './playwright.config.js';
// Локальный просмотр уже запущенного smoke-сервера; CI использует основной config.
export default {...base,webServer:{...base.webServer,reuseExistingServer:true},use:{...base.use,channel:'chrome'}};
