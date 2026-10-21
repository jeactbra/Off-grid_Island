// Região 1: a Vila. Exploração, conversa com a técnica Lia e o terminal do Gerador G1.

import Phaser from "phaser";
import { TILE } from "../texturas";
import type { Interface } from "../ui/interface";

const VELOCIDADE = 150;
const JANELA = 12; // gid do tile de janela (ver ferramentas/gerar_mapa_vila.py)
const ALCANCE_INTERACAO = 46;
const ESCURIDAO = 0x0b1630;
const ESCURIDAO_APAGADA = 0.55;
const ESCURIDAO_ACESA = 0.22; // fim de tarde: as luzes continuam visíveis

interface Interativo {
  x: number;
  y: number;
  rotulo: string;
  acao: () => Promise<void>;
}

interface ObjetoTiled {
  name: string;
  type: string;
  x: number;
  y: number;
  properties?: Array<{ name: string; value: string }>;
}

export class Vila extends Phaser.Scene {
  private jogador!: Phaser.Physics.Arcade.Sprite;
  private teclas!: Record<"cima" | "baixo" | "esquerda" | "direita" | "w" | "a" | "s" | "d" | "usar" | "espaco", Phaser.Input.Keyboard.Key>;
  private interativos: Interativo[] = [];
  private proximo: Interativo | null = null;
  private aviso!: Phaser.GameObjects.Text;
  private seta!: Phaser.GameObjects.Image;
  private escuridao!: Phaser.GameObjects.Rectangle;
  private postes: Phaser.GameObjects.Image[] = [];
  private brilhos: Phaser.GameObjects.Image[] = [];
  private brilhosJanela: Phaser.GameObjects.Image[] = [];
  private gerador!: Phaser.GameObjects.Image;
  private ocupado = false;
  private animacaoPasso = 0;

  estado = { missaoAceita: false, acesa: false, energia: 0 };
  private semente = String(Math.floor(Math.random() * 1e12));

  constructor() {
    super("Vila");
  }

  private get ui(): Interface {
    return this.registry.get("interface");
  }

  create() {
    const mapa = this.make.tilemap({ key: "mapa-vila" });
    const tileset = mapa.addTilesetImage("vila", "tiles-vila", TILE, TILE, 0, 0)!;
    mapa.createLayer("chao", tileset, 0, 0)!;
    const obstaculos = mapa.createLayer("obstaculos", tileset, 0, 0)!;
    obstaculos.setCollisionByExclusion([-1, 0]);
    this.physics.world.setBounds(0, 0, mapa.widthInPixels, mapa.heightInPixels);

    // janelas das casas ganham luz quando a região acende
    obstaculos.forEachTile((tile) => {
      if (tile.index !== JANELA) return;
      this.brilhosJanela.push(this.add.image(tile.getCenterX(), tile.getCenterY(), "brilho")
        .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setScale(0.5).setDepth(10000));
    });

    const solidos = this.physics.add.staticGroup();
    const solido = (x: number, y: number, largura: number, altura: number) => {
      const zona = this.add.zone(x, y, largura, altura);
      this.physics.add.existing(zona, true);
      solidos.add(zona);
    };
    const objetos = (mapa.getObjectLayer("objetos")?.objects ?? []) as ObjetoTiled[];
    const prop = (o: ObjetoTiled, nome: string) => o.properties?.find((p) => p.name === nome)?.value ?? "";
    let inicio = { x: 8 * TILE, y: 15 * TILE };
    let lia = { x: 0, y: 0 };
    let geradorPos = { x: 0, y: 0 };

    for (const o of objetos) {
      if (o.type === "inicio") inicio = { x: o.x, y: o.y };
      if (o.type === "poste") {
        const poste = this.add.image(o.x, o.y - 16, "poste-apagado").setDepth(o.y);
        this.postes.push(poste);
        this.brilhos.push(this.add.image(o.x, o.y - 26, "brilho").setBlendMode(Phaser.BlendModes.ADD)
          .setAlpha(0).setDepth(10000).setScale(1.4));
        solido(o.x, o.y + 8, 10, 8);
      }
      if (o.type === "npc") {
        lia = { x: o.x, y: o.y };
        this.add.image(o.x, o.y, "lia").setDepth(o.y);
        solido(o.x, o.y + 8, 18, 12);
        this.interativos.push({ x: o.x, y: o.y, rotulo: `Falar com ${prop(o, "rotulo")}`, acao: () => this.falarComLia() });
      }
      if (o.type === "gerador") {
        geradorPos = { x: o.x, y: o.y };
        this.gerador = this.add.image(o.x, o.y - 8, "gerador-apagado").setDepth(o.y + 16);
        solido(o.x, o.y + 4, 52, 30);
        this.interativos.push({ x: o.x, y: o.y + 16, rotulo: "Usar terminal", acao: () => this.usarGerador(prop(o, "missao")) });
      }
      if (o.type === "quadro") {
        this.add.image(o.x, o.y - 4, "quadro").setDepth(o.y);
        solido(o.x, o.y + 8, 24, 8);
        this.interativos.push({ x: o.x, y: o.y, rotulo: "Ler avisos", acao: () => this.lerQuadro() });
      }
      if (o.type === "portao") {
        this.add.image(o.x, o.y + 16, "portao").setDepth(o.y + 32);
        solido(o.x, o.y + 16, 28, 64);
        this.interativos.push({ x: o.x - 20, y: o.y + 16, rotulo: "Examinar portão",
          acao: () => this.examinarPortao(prop(o, "destino")) });
      }
    }

    this.jogador = this.physics.add.sprite(inicio.x, inicio.y, "jogador", 0);
    this.jogador.setSize(16, 10).setOffset(8, 21).setCollideWorldBounds(true);
    this.physics.add.collider(this.jogador, obstaculos);
    this.physics.add.collider(this.jogador, solidos);

    this.escuridao = this.add.rectangle(0, 0, mapa.widthInPixels, mapa.heightInPixels, ESCURIDAO, ESCURIDAO_APAGADA)
      .setOrigin(0).setDepth(9000);

    this.seta = this.add.image(lia.x, lia.y - 30, "seta").setDepth(11000);
    this.tweens.add({ targets: this.seta, y: "-=6", yoyo: true, repeat: -1, duration: 500, ease: "Sine.inOut" });
    this.registry.set("alvoGerador", geradorPos);

    this.aviso = this.add.text(0, 0, "", {
      fontFamily: "system-ui, sans-serif", fontSize: "11px", color: "#1d2420",
      backgroundColor: "#fdf6e3", padding: { x: 5, y: 3 },
    }).setOrigin(0.5, 1).setDepth(12000).setVisible(false).setResolution(2);

    const kb = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.teclas = {
      cima: kb.addKey(K.UP), baixo: kb.addKey(K.DOWN), esquerda: kb.addKey(K.LEFT), direita: kb.addKey(K.RIGHT),
      w: kb.addKey(K.W), a: kb.addKey(K.A), s: kb.addKey(K.S), d: kb.addKey(K.D),
      usar: kb.addKey(K.E), espaco: kb.addKey(K.SPACE),
    };
    this.teclas.usar.on("down", () => this.interagir());
    this.teclas.espaco.on("down", () => this.interagir());

    const camera = this.cameras.main;
    camera.setBounds(0, 0, mapa.widthInPixels, mapa.heightInPixels);
    camera.startFollow(this.jogador, true, 0.12, 0.12);
    camera.setRoundPixels(true);
    this.ajustarZoom();
    this.scale.on("resize", () => this.ajustarZoom());

    this.ui.toque.aoAgir = () => this.interagir();
    this.ui.hud.definir({ regiao: "Vila", energia: 0, objetivo: "Fale com a técnica Lia, perto da casa do leste." });
    if (new URLSearchParams(location.search).has("debug")) {
      kb.addKey(K.L).on("down", () => this.acender());
    }
    (window as unknown as { __ilha: unknown }).__ilha = { cena: this };
  }

  private ajustarZoom() {
    const { width, height } = this.scale;
    // cerca de 20 tiles na largura em telas grandes; nunca menos de 1x
    const zoom = Phaser.Math.Clamp(Math.min(width / (TILE * 20), height / (TILE * 13)), 1, 3);
    this.cameras.main.setZoom(Math.round(zoom * 4) / 4);
  }

  private bloqueado() {
    return this.ocupado || this.ui.dialogo.aberto || this.ui.terminal.aberto;
  }

  update(_tempo: number, delta: number) {
    const corpo = this.jogador.body as Phaser.Physics.Arcade.Body;
    if (this.bloqueado()) {
      corpo.setVelocity(0, 0);
      this.aviso.setVisible(false);
      return;
    }

    let vx = 0;
    let vy = 0;
    const t = this.teclas;
    if (t.esquerda.isDown || t.a.isDown) vx -= 1;
    if (t.direita.isDown || t.d.isDown) vx += 1;
    if (t.cima.isDown || t.w.isDown) vy -= 1;
    if (t.baixo.isDown || t.s.isDown) vy += 1;
    const toque = this.ui.toque.vetor;
    if (vx === 0 && vy === 0 && (toque.x || toque.y)) { vx = toque.x; vy = toque.y; }
    const intensidade = Math.min(1, Math.hypot(vx, vy));
    if (intensidade > 0) {
      const angulo = Math.atan2(vy, vx);
      corpo.setVelocity(Math.cos(angulo) * VELOCIDADE * intensidade, Math.sin(angulo) * VELOCIDADE * intensidade);
      if (vx !== 0) this.jogador.setFlipX(vx < 0);
      this.animacaoPasso += delta;
      this.jogador.setFrame(1 + (Math.floor(this.animacaoPasso / 140) % 2));
    } else {
      corpo.setVelocity(0, 0);
      this.jogador.setFrame(0);
    }
    this.jogador.setDepth(this.jogador.y);

    this.proximo = null;
    let menor = ALCANCE_INTERACAO;
    for (const item of this.interativos) {
      const d = Phaser.Math.Distance.Between(this.jogador.x, this.jogador.y, item.x, item.y);
      if (d < menor) { menor = d; this.proximo = item; }
    }
    if (this.proximo) {
      const tecla = this.ui.toque.ativo ? "" : "E · ";
      this.aviso.setText(`${tecla}${this.proximo.rotulo}`).setPosition(this.jogador.x, this.jogador.y - 20).setVisible(true);
    } else {
      this.aviso.setVisible(false);
    }
    this.ui.toque.rotuloAcao(this.proximo ? this.proximo.rotulo.split(" ")[0] : null);
  }

  async interagir() {
    if (this.bloqueado() || !this.proximo) return;
    this.ocupado = true;
    try {
      await this.proximo.acao();
    } finally {
      this.ocupado = false;
    }
  }

  private async falarComLia() {
    const d = this.ui.dialogo;
    if (this.estado.acesa) {
      await d.mostrar([
        { quem: "Lia", texto: "Olha essas luzes! A Vila inteira acendeu graças ao seu código." },
        { quem: "Lia", texto: "Logo o portão para o Campo Solar vai abrir. Lá a energia vem do sol." },
      ]);
      return;
    }
    if (this.estado.missaoAceita) {
      await d.mostrar([{ quem: "Lia", texto: "O terminal fica no Gerador G1, dentro do pátio cercado ao sul." }]);
      return;
    }
    const escolha = await d.mostrar([
      { quem: "Lia", texto: "Oi! Você deve ser a nova engenheira ou o novo engenheiro. Eu sou a Lia, técnica da Vila." },
      { quem: "Lia", texto: "O Gerador G1 até tem combustível, mas o painel de controle perdeu o programa." },
      { quem: "Lia", texto: "Sem o painel mostrando o status, o sistema não libera a energia. Você consegue reprogramar?" },
    ], ["Aceitar missão", "Agora não"]);
    if (escolha === "Aceitar missão") {
      this.estado.missaoAceita = true;
      const alvo = this.registry.get("alvoGerador") as { x: number; y: number };
      this.tweens.killTweensOf(this.seta);
      this.seta.setPosition(alvo.x, alvo.y - 52);
      this.tweens.add({ targets: this.seta, y: "-=6", yoyo: true, repeat: -1, duration: 500, ease: "Sine.inOut" });
      this.ui.hud.definir({ objetivo: "Use o terminal do Gerador G1, no pátio cercado ao sul." });
      await d.mostrar([{ quem: "Lia", texto: "Ótimo! O terminal fica no Gerador G1, no pátio cercado. Boa sorte!" }]);
    }
  }

  private async usarGerador(idMissao: string) {
    if (this.estado.acesa) {
      await this.ui.dialogo.mostrar([{ quem: "Gerador G1", texto: "Status: ligado. Produção estável em 35 kW." }]);
      return;
    }
    if (!this.estado.missaoAceita) {
      await this.ui.dialogo.mostrar([
        { quem: "Gerador G1", texto: "Painel sem programa. Acesso restrito à equipe técnica." },
        { quem: "Você", texto: "Melhor falar com a técnica da Vila antes." },
      ]);
      return;
    }
    this.input.keyboard!.enabled = false;
    this.input.keyboard!.disableGlobalCapture();
    const resultado = await this.ui.terminal.abrir("Gerador G1", idMissao, this.semente);
    this.input.keyboard!.enabled = true;
    this.input.keyboard!.enableGlobalCapture();
    this.input.keyboard!.resetKeys();
    if (resultado.concluida) {
      this.estado.energia += resultado.energia;
      await this.acender();
    }
  }

  private async lerQuadro() {
    await this.ui.dialogo.mostrar([
      { quem: "Quadro de avisos", texto: "ATIVIDADE DA SEMANA: religar a Vila. Prazo: domingo, 23h59." },
      { quem: "Quadro de avisos", texto: "Dica da equipe: cada print mostra uma linha na tela, de cima para baixo." },
    ]);
  }

  private async examinarPortao(destino: string) {
    await this.ui.dialogo.mostrar([
      { quem: "Portão", texto: `Caminho para o ${destino}. Trancado.` },
      { quem: "Portão", texto: this.estado.acesa
        ? "A Vila já tem energia. O portão abre quando a próxima região for liberada."
        : "Uma placa diz: \"Abre somente com a Vila energizada\"." },
    ]);
  }

  async acender() {
    if (this.estado.acesa) return;
    this.estado.acesa = true;
    this.seta.setVisible(false);
    this.gerador.setTexture("gerador-aceso");
    this.cameras.main.shake(250, 0.004);
    this.tweens.add({ targets: this.escuridao, alpha: ESCURIDAO_ACESA, duration: 1800, ease: "Sine.out" });
    this.tweens.add({ targets: this.brilhosJanela, alpha: 0.9, duration: 900, delay: 1200 });
    this.postes.forEach((poste, i) => {
      this.time.delayedCall(300 + i * 180, () => {
        poste.setTexture("poste-aceso");
        this.tweens.add({ targets: this.brilhos[i], alpha: 0.55, duration: 500 });
      });
    });
    this.ui.hud.definir({ energia: this.estado.energia, objetivo: "A Vila está energizada! Explore à vontade." });
    this.ui.hud.notificar("⚡ A Vila acendeu!");
  }
}
