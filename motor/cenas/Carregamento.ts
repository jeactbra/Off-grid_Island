import Phaser from "phaser";
import urlMapaVila from "../../mapas/vila.tmj?url";
import { gerarTexturas } from "../texturas";

export class Carregamento extends Phaser.Scene {
  constructor() {
    super("Carregamento");
  }

  preload() {
    this.load.tilemapTiledJSON("mapa-vila", urlMapaVila);
  }

  create() {
    gerarTexturas(this);
    this.scene.start("Vila");
  }
}
