// Arte provisória desenhada por código (pixel art simples).
// Substituível depois por um pacote de arte sem mudar o resto do motor:
// basta manter as mesmas chaves de textura e a ordem dos tiles.

import Phaser from "phaser";

export const TILE = 32;

// Ordem dos tiles no tileset "vila" (gid = índice + 1), igual a ferramentas/gerar_mapa_vila.py
const TILES: Array<(c: CanvasRenderingContext2D, rnd: () => number) => void> = [
  (c, r) => grama(c, r, "#6abe5a", "#5aae4c"),          // 1 grama
  (c, r) => grama(c, r, "#5aa84d", "#4c9842"),          // 2 grama escura
  (c, r) => { grama(c, r, "#6abe5a", "#5aae4c"); flores(c, r); }, // 3 flores
  (c, r) => pontilhado(c, r, "#d9b97a", "#c9a868"),     // 4 caminho
  (c, r) => pontilhado(c, r, "#ecd9a0", "#e0cb8c"),     // 5 areia
  (c) => agua(c),                                       // 6 água
  (c, r) => { grama(c, r, "#6abe5a", "#5aae4c"); arvore(c); }, // 7 árvore
  (c) => parede(c),                                     // 8 parede
  (c) => telhado(c),                                    // 9 telhado
  (c, r) => { grama(c, r, "#6abe5a", "#5aae4c"); cerca(c); },  // 10 cerca
  (c, r) => { grama(c, r, "#6abe5a", "#5aae4c"); pedra(c); },  // 11 pedra
  (c) => { parede(c); janela(c); },                     // 12 janela
  (c) => { parede(c); porta(c); },                      // 13 porta
  (c, r) => { grama(c, r, "#6abe5a", "#5aae4c"); arbusto(c); }, // 14 arbusto
];

function aleatorio(semente: number) {
  let s = semente;
  return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
}

function grama(c: CanvasRenderingContext2D, r: () => number, base: string, tufo: string) {
  c.fillStyle = base; c.fillRect(0, 0, TILE, TILE);
  c.fillStyle = tufo;
  for (let i = 0; i < 10; i++) c.fillRect(Math.floor(r() * 30), Math.floor(r() * 30), 2, 3);
}
function pontilhado(c: CanvasRenderingContext2D, r: () => number, base: string, ponto: string) {
  c.fillStyle = base; c.fillRect(0, 0, TILE, TILE);
  c.fillStyle = ponto;
  for (let i = 0; i < 12; i++) c.fillRect(Math.floor(r() * 31), Math.floor(r() * 31), 2, 2);
}
function flores(c: CanvasRenderingContext2D, r: () => number) {
  const cores = ["#f2e86d", "#f08cb0", "#ffffff"];
  for (let i = 0; i < 4; i++) {
    c.fillStyle = cores[i % 3];
    const x = 4 + Math.floor(r() * 24), y = 4 + Math.floor(r() * 24);
    c.fillRect(x, y, 3, 3);
  }
}
function agua(c: CanvasRenderingContext2D) {
  c.fillStyle = "#3b8fd0"; c.fillRect(0, 0, TILE, TILE);
  c.fillStyle = "#5aa9e6";
  c.fillRect(4, 8, 10, 2); c.fillRect(18, 20, 10, 2); c.fillRect(8, 26, 6, 2);
}
function arvore(c: CanvasRenderingContext2D) {
  c.fillStyle = "#7a4f2a"; c.fillRect(13, 20, 6, 10);
  c.fillStyle = "#2f7a3a"; c.beginPath(); c.arc(16, 14, 12, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#3f944a"; c.beginPath(); c.arc(12, 11, 6, 0, Math.PI * 2); c.fill();
}
function arbusto(c: CanvasRenderingContext2D) {
  c.fillStyle = "#3a8a43"; c.beginPath(); c.arc(16, 20, 9, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#4ea457"; c.beginPath(); c.arc(13, 17, 4, 0, Math.PI * 2); c.fill();
}
function pedra(c: CanvasRenderingContext2D) {
  c.fillStyle = "#8d949a"; c.beginPath(); c.ellipse(16, 20, 11, 8, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#b0b7bc"; c.fillRect(10, 15, 6, 3);
}
function parede(c: CanvasRenderingContext2D) {
  c.fillStyle = "#e8dcc4"; c.fillRect(0, 0, TILE, TILE);
  c.fillStyle = "#d4c5a8";
  for (let y = 0; y < TILE; y += 8) c.fillRect(0, y, TILE, 1);
}
function telhado(c: CanvasRenderingContext2D) {
  c.fillStyle = "#b5523b"; c.fillRect(0, 0, TILE, TILE);
  c.fillStyle = "#9a4330";
  for (let y = 4; y < TILE; y += 8) c.fillRect(0, y, TILE, 3);
}
function janela(c: CanvasRenderingContext2D) {
  c.fillStyle = "#5b6f80"; c.fillRect(8, 8, 16, 14);
  c.fillStyle = "#7d93a6"; c.fillRect(10, 10, 5, 4);
  c.fillStyle = "#8a6a45"; c.fillRect(15, 8, 2, 14); c.fillRect(8, 14, 16, 2);
}
function porta(c: CanvasRenderingContext2D) {
  c.fillStyle = "#7a4f2a"; c.fillRect(9, 6, 14, 26);
  c.fillStyle = "#f2c94c"; c.fillRect(19, 19, 2, 2);
}
function cerca(c: CanvasRenderingContext2D) {
  c.fillStyle = "#a7774a";
  c.fillRect(0, 12, TILE, 4); c.fillRect(0, 22, TILE, 4);
  c.fillRect(4, 6, 4, 24); c.fillRect(24, 6, 4, 24);
}

function criarCanvas(cena: Phaser.Scene, chave: string, largura: number, altura: number,
                     desenhar: (c: CanvasRenderingContext2D) => void) {
  const textura = cena.textures.createCanvas(chave, largura, altura)!;
  const ctx = textura.getContext();
  ctx.imageSmoothingEnabled = false;
  desenhar(ctx);
  textura.refresh();
}

function pessoa(c: CanvasRenderingContext2D, ox: number, camisa: string, cabelo: string, passo: number) {
  // corpo 32x32 visto de cima/frente, com pernas alternando no passo
  c.fillStyle = "rgba(0,0,0,.18)"; c.beginPath(); c.ellipse(ox + 16, 29, 9, 3, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#33415c";
  c.fillRect(ox + 11, 22 - (passo === 1 ? 1 : 0), 4, 7);
  c.fillRect(ox + 17, 22 - (passo === 2 ? 1 : 0), 4, 7);
  c.fillStyle = camisa; c.fillRect(ox + 9, 13, 14, 10);
  c.fillStyle = "#f1c7a0"; c.fillRect(ox + 10, 3, 12, 11);
  c.fillStyle = cabelo; c.fillRect(ox + 9, 2, 14, 5);
  c.fillStyle = "#1d2420"; c.fillRect(ox + 13, 8, 2, 2); c.fillRect(ox + 18, 8, 2, 2);
}

export function gerarTexturas(cena: Phaser.Scene) {
  criarCanvas(cena, "tiles-vila", TILE * TILES.length, TILE, (c) => {
    TILES.forEach((desenhar, i) => {
      c.save(); c.translate(i * TILE, 0);
      c.beginPath(); c.rect(0, 0, TILE, TILE); c.clip();
      desenhar(c, aleatorio(i * 97 + 13));
      c.restore();
    });
  });

  // jogador e técnica: 3 quadros (parado, passo 1, passo 2)
  criarCanvas(cena, "jogador", TILE * 3, TILE, (c) => {
    for (let q = 0; q < 3; q++) pessoa(c, q * TILE, "#2f80ed", "#4a3426", q);
  });
  cena.textures.get("jogador").add(0, 0, 0, 0, TILE, TILE);
  cena.textures.get("jogador").add(1, 0, TILE, 0, TILE, TILE);
  cena.textures.get("jogador").add(2, 0, TILE * 2, 0, TILE, TILE);
  criarCanvas(cena, "lia", TILE, TILE, (c) => {
    pessoa(c, 0, "#f2994a", "#2b1d14", 0);
    c.fillStyle = "#f2c94c"; c.fillRect(8, 1, 16, 3); // capacete
  });

  // gerador apagado e aceso (64x64)
  const gerador = (aceso: boolean) => (c: CanvasRenderingContext2D) => {
    c.fillStyle = "rgba(0,0,0,.2)"; c.fillRect(6, 54, 54, 6);
    c.fillStyle = "#6c7a86"; c.fillRect(6, 14, 52, 42);
    c.fillStyle = "#56636e"; c.fillRect(6, 14, 52, 6);
    c.fillStyle = "#2c3640"; c.fillRect(14, 26, 26, 18);
    c.fillStyle = aceso ? "#6ff2a8" : "#3a4652"; c.fillRect(16, 28, 22, 14);
    if (aceso) { c.fillStyle = "#1d6b45"; c.fillRect(18, 31, 14, 2); c.fillRect(18, 36, 10, 2); }
    c.fillStyle = aceso ? "#f2c94c" : "#4b5560"; c.beginPath(); c.arc(48, 32, 5, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#3a4652"; c.fillRect(44, 42, 8, 8);
    c.fillStyle = "#f2c94c"; c.font = "bold 10px monospace"; c.fillText("G1", 9, 24);
  };
  criarCanvas(cena, "gerador-apagado", 64, 64, gerador(false));
  criarCanvas(cena, "gerador-aceso", 64, 64, gerador(true));

  // poste de luz apagado e aceso (32x64)
  const poste = (aceso: boolean) => (c: CanvasRenderingContext2D) => {
    c.fillStyle = "rgba(0,0,0,.18)"; c.beginPath(); c.ellipse(16, 61, 7, 2, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#3d4650"; c.fillRect(14, 12, 4, 49);
    c.fillStyle = "#2c3640"; c.fillRect(9, 6, 14, 8);
    c.fillStyle = aceso ? "#ffe9a3" : "#5b6670"; c.fillRect(11, 13, 10, 4);
  };
  criarCanvas(cena, "poste-apagado", 32, 64, poste(false));
  criarCanvas(cena, "poste-aceso", 32, 64, poste(true));

  criarCanvas(cena, "quadro", 32, 40, (c) => {
    c.fillStyle = "#7a4f2a"; c.fillRect(6, 20, 4, 20); c.fillRect(22, 20, 4, 20);
    c.fillStyle = "#a7774a"; c.fillRect(2, 4, 28, 20);
    c.fillStyle = "#f4ecd8"; c.fillRect(5, 7, 10, 7); c.fillRect(17, 9, 10, 9);
    c.fillStyle = "#d64545"; c.fillRect(9, 6, 2, 2); c.fillRect(21, 8, 2, 2);
  });
  criarCanvas(cena, "portao", 32, 64, (c) => {
    c.fillStyle = "#4b5560"; c.fillRect(2, 4, 6, 60); c.fillRect(24, 4, 6, 60);
    c.fillStyle = "#6c7a86";
    for (let x = 8; x < 24; x += 5) c.fillRect(x, 10, 2, 50);
    c.fillStyle = "#d64545"; c.fillRect(8, 30, 16, 4);
  });

  // brilho de luz (gradiente radial), usado no modo "aceso"
  criarCanvas(cena, "brilho", 128, 128, (c) => {
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,233,163,0.55)");
    g.addColorStop(1, "rgba(255,233,163,0)");
    c.fillStyle = g; c.fillRect(0, 0, 128, 128);
  });

  // seta que indica o objetivo atual
  criarCanvas(cena, "seta", 16, 16, (c) => {
    c.fillStyle = "#f2c94c";
    c.beginPath(); c.moveTo(1, 2); c.lineTo(15, 2); c.lineTo(8, 14); c.closePath(); c.fill();
  });
}
