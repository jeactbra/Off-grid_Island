// Pequenos objetos que o pacote de arte não tem, desenhados no mesmo estilo (16 px, contorno escuro).

import Phaser from "phaser";

const CONTORNO = "#171424";
const MADEIRA = "#a0603a";
const MADEIRA_CLARA = "#c58a52";
const METAL = "#5a6988";
const METAL_CLARO = "#8b9bb4";

function criar(cena: Phaser.Scene, chave: string, largura: number, altura: number,
               desenhar: (c: CanvasRenderingContext2D) => void) {
  const textura = cena.textures.createCanvas(chave, largura, altura)!;
  const c = textura.getContext();
  c.imageSmoothingEnabled = false;
  desenhar(c);
  textura.refresh();
}

function caixa(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cor: string) {
  c.fillStyle = CONTORNO; c.fillRect(x, y, w, h);
  c.fillStyle = cor; c.fillRect(x + 1, y + 1, w - 2, h - 2);
}

export function gerarTexturas(cena: Phaser.Scene) {
  // painel de controle do moinho (16x24), tela apagada ou acesa
  const painel = (aceso: boolean) => (c: CanvasRenderingContext2D) => {
    c.fillStyle = "rgba(0,0,0,.25)"; c.fillRect(2, 21, 12, 3);
    caixa(c, 6, 14, 4, 9, METAL);
    caixa(c, 1, 2, 14, 13, METAL);
    c.fillStyle = METAL_CLARO; c.fillRect(2, 3, 12, 1);
    caixa(c, 3, 5, 10, 6, aceso ? "#63c74d" : "#262b44");
    if (aceso) { c.fillStyle = "#265c42"; c.fillRect(5, 7, 5, 1); c.fillRect(5, 9, 3, 1); }
    c.fillStyle = aceso ? "#feae34" : "#3a4466"; c.fillRect(11, 12, 2, 1);
  };
  criar(cena, "painel-apagado", 16, 24, painel(false));
  criar(cena, "painel-aceso", 16, 24, painel(true));

  // quadro de avisos (20x24)
  criar(cena, "quadro", 20, 24, (c) => {
    c.fillStyle = "rgba(0,0,0,.25)"; c.fillRect(3, 21, 14, 3);
    caixa(c, 3, 12, 3, 11, MADEIRA); caixa(c, 14, 12, 3, 11, MADEIRA);
    caixa(c, 0, 1, 20, 13, MADEIRA);
    c.fillStyle = MADEIRA_CLARA; c.fillRect(1, 2, 18, 1);
    c.fillStyle = "#f4ecd8"; c.fillRect(3, 4, 6, 6); c.fillRect(11, 5, 6, 5);
    c.fillStyle = "#e43b44"; c.fillRect(5, 4, 2, 1); c.fillRect(13, 5, 2, 1);
  });

  // portão de madeira trancado (16x24)
  criar(cena, "portao", 16, 24, (c) => {
    c.fillStyle = "rgba(0,0,0,.25)"; c.fillRect(1, 21, 14, 3);
    caixa(c, 0, 2, 3, 21, MADEIRA); caixa(c, 13, 2, 3, 21, MADEIRA);
    caixa(c, 2, 7, 12, 3, MADEIRA_CLARA); caixa(c, 2, 15, 12, 3, MADEIRA_CLARA);
    caixa(c, 4, 9, 8, 7, "#e43b44");
    c.fillStyle = "#f4ecd8"; c.fillRect(6, 11, 4, 1); c.fillRect(6, 13, 4, 1);
  });

  // brilho de luz (gradiente radial) e seta de objetivo
  criar(cena, "brilho", 64, 64, (c) => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,214,140,0.7)");
    g.addColorStop(1, "rgba(255,214,140,0)");
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  });
  criar(cena, "seta", 9, 8, (c) => {
    c.fillStyle = CONTORNO;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(9, 0); c.lineTo(4.5, 8); c.closePath(); c.fill();
    c.fillStyle = "#feae34";
    c.beginPath(); c.moveTo(2, 1); c.lineTo(7, 1); c.lineTo(4.5, 6); c.closePath(); c.fill();
  });
}
