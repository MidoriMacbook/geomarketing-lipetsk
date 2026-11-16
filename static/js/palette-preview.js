const theme = new URLSearchParams(location.search).get('theme');
document.documentElement.dataset.theme = theme === 'B' || theme === 'C' ? theme : 'A';
