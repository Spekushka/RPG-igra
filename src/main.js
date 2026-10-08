import { fitStage, installTouch } from './ui/dom.js';
import { createGame } from './ui/screens.js';

const stage = document.getElementById('stage');
fitStage();
installTouch(stage);
window.addEventListener('resize', fitStage);
const G = createGame(stage);
G.menu();
window.__G = G;
