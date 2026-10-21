// Moradores da ilha: parados fazendo algo, vagando por perto ou seguindo uma rota (estilo Pokémon).

import Phaser from "phaser";
import { chavePersonagem, manifesto } from "../arte";

export type Comportamento = "parado" | "vagar" | "rota";

export interface DadosMorador {
  nome: string;
  rotulo: string;
  visual: string;
  comportamento: Comportamento;
  acao: string;
  raio: number;
  rota: Array<[number, number]>;
  falas: string[];
  x: number;
  y: number;
}

const VELOCIDADE = 34;
const TILE = 16;

export class Morador {
  sprite: Phaser.Physics.Arcade.Sprite;
  conversando = false;
  private alvo: { x: number; y: number } | null = null;
  private espera = 0;
  private indiceRota = 0;
  private ultimaPosicao = { x: 0, y: 0 };
  private tempoParado = 0;
  private indiceFala = 0;

  constructor(cena: Phaser.Scene, readonly dados: DadosMorador,
              private livre: (x: number, y: number) => boolean) {
    const parado = manifesto.personagens[`${dados.visual}_idle`];
    this.sprite = cena.physics.add.sprite(dados.x, dados.y, chavePersonagem(dados.visual, "idle"));
    this.sprite.setOrigin(parado.ox / parado.w, parado.oy / parado.h);
    this.sprite.setSize(10, 6).setOffset(parado.ox - 5, parado.oy - 6);
    (this.sprite.body as Phaser.Physics.Arcade.Body).pushable = false;
    this.animar(dados.comportamento === "parado" ? dados.acao : "idle");
    this.espera = Phaser.Math.Between(300, 2000);
  }

  proximaFala(): string {
    const falas = this.dados.falas;
    const fala = falas[this.indiceFala % falas.length];
    this.indiceFala += 1;
    return fala;
  }

  private animar(acao: string) {
    const chave = chavePersonagem(this.dados.visual, acao);
    if (this.sprite.anims.currentAnim?.key !== chave) this.sprite.play(chave, true);
  }

  private olharPara(x: number) {
    this.sprite.setFlipX(x < this.sprite.x);
  }

  update(delta: number, jogador: Phaser.GameObjects.Sprite) {
    const corpo = this.sprite.body as Phaser.Physics.Arcade.Body;
    this.sprite.setDepth(this.sprite.y);
    const perto = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, jogador.x, jogador.y) < 28;

    if (this.conversando || (perto && this.dados.comportamento !== "parado")) {
      corpo.setVelocity(0, 0);
      this.animar("idle");
      this.olharPara(jogador.x);
      return;
    }
    if (this.dados.comportamento === "parado") {
      if (perto) this.olharPara(jogador.x);
      return;
    }

    if (!this.alvo) {
      corpo.setVelocity(0, 0);
      this.animar("idle");
      this.espera -= delta;
      if (this.espera <= 0) this.escolherAlvo();
      return;
    }

    const dx = this.alvo.x - this.sprite.x;
    const dy = this.alvo.y - this.sprite.y;
    const distancia = Math.hypot(dx, dy);
    if (distancia < 3) {
      this.chegou();
      return;
    }
    corpo.setVelocity((dx / distancia) * VELOCIDADE, (dy / distancia) * VELOCIDADE);
    if (Math.abs(dx) > 1) this.sprite.setFlipX(dx < 0);
    this.animar("walk");

    // preso numa parede ou atrás de alguém: desiste deste alvo
    this.tempoParado += delta;
    if (this.tempoParado > 900) {
      const andou = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, this.ultimaPosicao.x, this.ultimaPosicao.y);
      if (andou < 4) this.chegou();
      this.ultimaPosicao = { x: this.sprite.x, y: this.sprite.y };
      this.tempoParado = 0;
    }
  }

  private chegou() {
    this.alvo = null;
    (this.sprite.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.espera = this.dados.comportamento === "rota" ? Phaser.Math.Between(400, 1400) : Phaser.Math.Between(1200, 3500);
    if (this.dados.comportamento === "rota") this.indiceRota = (this.indiceRota + 1) % this.dados.rota.length;
  }

  private escolherAlvo() {
    this.ultimaPosicao = { x: this.sprite.x, y: this.sprite.y };
    this.tempoParado = 0;
    if (this.dados.comportamento === "rota") {
      const [tx, ty] = this.dados.rota[this.indiceRota];
      this.alvo = { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
      return;
    }
    for (let tentativa = 0; tentativa < 12; tentativa++) {
      const x = this.dados.x + Phaser.Math.Between(-this.dados.raio, this.dados.raio) * TILE;
      const y = this.dados.y + Phaser.Math.Between(-this.dados.raio, this.dados.raio) * TILE;
      if (this.livre(x, y)) {
        this.alvo = { x, y };
        return;
      }
    }
    this.espera = 1000;
  }
}
