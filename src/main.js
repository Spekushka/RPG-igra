import { fitStage } from './ui/dom.js';
import { createGame } from './ui/screens.js';

const stage = document.getElementById('stage');
fitStage();
window.addEventListener('resize', fitStage);
const G = createGame(stage);
G.menu();
window.__G = G;
