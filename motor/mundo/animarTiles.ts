// Animação dos tiles (água, cachoeira, flores) conforme a tabela exportada do pacote de arte.

import Phaser from "phaser";
import { manifesto } from "../arte";

export function animarTiles(cena: Phaser.Scene, camadas: Phaser.Tilemaps.TilemapLayer[]) {
  const sequencias = new Map<number, number[]>();
  let fps = 5;
  for (const [inicio, anim] of Object.entries(manifesto.animacoes_tiles)) {
    sequencias.set(Number(inicio) + 1, anim.quadros.map((q) => q + 1)); // gid = índice + 1
    fps = anim.fps;
  }
  const animados: Array<{ tile: Phaser.Tilemaps.Tile; quadros: number[] }> = [];
  for (const camada of camadas) {
    camada.forEachTile((tile) => {
      const quadros = sequencias.get(tile.index);
      if (quadros) animados.push({ tile, quadros });
    });
  }
  if (!animados.length) return;
  let passo = 0;
  cena.time.addEvent({
    delay: 1000 / fps,
    loop: true,
    callback: () => {
      passo += 1;
      for (const { tile, quadros } of animados) tile.index = quadros[passo % quadros.length];
    },
  });
}
