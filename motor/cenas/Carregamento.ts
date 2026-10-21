import Phaser from "phaser";
import urlMapaVila from "../../mapas/vila.tmj?url";
import { manifesto, urlArte } from "../arte";
import { gerarTexturas } from "../texturas";

export class Carregamento extends Phaser.Scene {
  constructor() {
    super("Carregamento");
  }

  preload() {
    this.load.tilemapTiledJSON("mapa-vila", urlMapaVila);
    this.load.image("tileset-sunnyside", urlArte("tileset_16.png"));
    this.load.image("tileset-floresta", urlArte("floresta.png"));
    this.load.image("tileset-colisao", urlArte("colisao.png"));
    for (const [nome, s] of Object.entries(manifesto.sprites)) {
      this.load.spritesheet(nome, urlArte(s.arquivo), { frameWidth: s.w, frameHeight: s.h });
    }
    for (const [nome, s] of Object.entries(manifesto.personagens)) {
      this.load.spritesheet(nome, urlArte(s.arquivo), { frameWidth: s.w, frameHeight: s.h });
    }
    const barra = document.createElement("div");
    barra.className = "carregando";
    barra.innerHTML = `<span>Ilha Off-Grid</span><div><i></i></div>`;
    document.getElementById("interface")!.appendChild(barra);
    this.load.on("progress", (p: number) => { barra.querySelector("i")!.style.width = `${p * 100}%`; });
    this.load.on("complete", () => barra.remove());
  }

  create() {
    gerarTexturas(this);
    const criar = (nome: string, quadros: number, fps: number) => {
      if (quadros < 2) return;
      const frames = this.anims.generateFrameNumbers(nome);
      if (frames.length < 2) {
        console.warn(`animação sem quadros: ${nome}`);
        (window as unknown as { __erros?: string[] }).__erros?.push(`animação sem quadros: ${nome}`);
        return;
      }
      if (frames.length !== quadros) console.warn(`${nome}: ${frames.length} quadros na imagem, ${quadros} no manifesto`);
      this.anims.create({ key: nome, frames, frameRate: fps, repeat: -1 });
    };
    for (const [nome, s] of Object.entries(manifesto.sprites)) criar(nome, s.quadros, s.fps);
    for (const [nome, s] of Object.entries(manifesto.personagens)) criar(nome, s.quadros, s.fps);
    this.scene.start("Vila");
  }
}
