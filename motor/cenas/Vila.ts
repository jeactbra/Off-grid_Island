// Região 1: a Vila. Exploração, moradores e o painel do Moinho G1, que religa a energia.

import Phaser from "phaser";
import { chavePersonagem, manifesto } from "../arte";
import { animarTiles } from "../mundo/animarTiles";
import { Morador, type Comportamento, type DadosMorador } from "../mundo/Morador";
import type { Interface } from "../ui/interface";

const VELOCIDADE = 74;
const ALCANCE_INTERACAO = 22;
const VISUAL_JOGADOR = "shorthair";
const ESCURIDAO = 0x10142e;
const ESCURIDAO_APAGADA = 0.5;
const ESCURIDAO_ACESA = 0.08;
const MOINHOS = new Set(["spr_deco_windmill", "spr_deco_windmill_withshadow"]);
const LUZES = /fire|campfire|firepit|chimneysmoke/;

interface Interativo {
  x: number;
  y: number;
  rotulo: string;
  morador?: Morador;
  acao: () => Promise<void>;
}

interface ObjetoTiled {
  name: string;
  type: string;
  x: number;
  y: number;
  properties?: Array<{ name: string; value: string | number | boolean }>;
}

function propriedades(o: ObjetoTiled): Record<string, string | number | boolean> {
  return Object.fromEntries((o.properties ?? []).map((p) => [p.name, p.value]));
}

function lerJson<T>(valor: unknown, padrao: T): T {
  if (typeof valor !== "string") return padrao;
  try { return JSON.parse(valor) as T; } catch { return padrao; }
}

export class Vila extends Phaser.Scene {
  private jogador!: Phaser.Physics.Arcade.Sprite;
  private teclas!: Record<string, Phaser.Input.Keyboard.Key>;
  private interativos: Interativo[] = [];
  private proximo: Interativo | null = null;
  private moradores: Morador[] = [];
  private seta!: Phaser.GameObjects.Image;
  private seguirSeta: (() => { x: number; y: number }) | null = null;
  private escuridao!: Phaser.GameObjects.Rectangle;
  private moinhos: Phaser.GameObjects.Sprite[] = [];
  private luzes: Phaser.GameObjects.Image[] = [];
  private painel!: Phaser.GameObjects.Image;
  private colisao!: Phaser.Tilemaps.TilemapLayer;
  private ocupado = false;

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
    const tilesets = [
      mapa.addTilesetImage("sunnyside", "tileset-sunnyside")!,
      mapa.addTilesetImage("floresta", "tileset-floresta")!,
    ];
    const camadas: Phaser.Tilemaps.TilemapLayer[] = [];
    let profundidadeFloresta = -1000;
    mapa.layers.forEach((dados, i) => {
      if (dados.name === "colisao") return;
      const camada = mapa.createLayer(dados.name, tilesets, 0, 0)!;
      const acima = (dados.properties as Array<{ name: string; value: unknown }> | undefined)
        ?.some((p) => p.name === "acima" && p.value === true);
      camada.setDepth(acima ? 1_000_000 + i : -1000 + i);
      if (dados.name === "forest") profundidadeFloresta = -1000 + i;
      camadas.push(camada);
    });
    this.colisao = mapa.createLayer("colisao", mapa.addTilesetImage("colisao", "tileset-colisao")!, 0, 0)!;
    this.colisao.setVisible(new URLSearchParams(location.search).has("fisica")).setDepth(2_000_000);
    this.colisao.setCollisionByExclusion([-1]);
    animarTiles(this, camadas);
    this.physics.world.setBounds(0, 0, mapa.widthInPixels, mapa.heightInPixels);

    const solidos = this.physics.add.staticGroup();
    const solido = (x: number, y: number, largura: number, altura: number) => {
      const zona = this.add.zone(x, y, largura, altura);
      this.physics.add.existing(zona, true);
      solidos.add(zona);
    };

    // decoração da cena: árvores, animais, moinhos, fogueiras...
    for (const o of (mapa.getObjectLayer("decoracao")?.objects ?? []) as ObjetoTiled[]) {
      const info = manifesto.sprites[o.name];
      if (!info) continue;
      const p = propriedades(o);
      const sprite = this.add.sprite(o.x, o.y, o.name, 0)
        .setOrigin(info.ox / info.w, info.oy / info.h)
        .setScale(Number(p.escala_x ?? 1), Number(p.escala_y ?? 1));
      const [esquerda, direita, fundo] = info.base ?? [0, info.w, info.h];
      const baseY = o.y - info.oy + fundo;
      sprite.setDepth(p.profundidade === "fundo" ? profundidadeFloresta - 0.5 : baseY);
      const animacao = this.anims.get(o.name);
      if (animacao) {
        const n = animacao.frames.length;
        sprite.play({ key: o.name, startFrame: ((Math.trunc(Number(p.quadro) || 0) % n) + n) % n });
        sprite.anims.timeScale = Math.abs(Number(p.velocidade ?? 1)) || 1;
      }
      if (MOINHOS.has(o.name)) {
        this.moinhos.push(sprite);
        sprite.anims.pause();
      }
      if (LUZES.test(o.name)) {
        this.luzes.push(this.add.image(o.x, baseY - 6, "brilho").setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(900_001).setAlpha(o.name.includes("chimney") ? 0 : 0.8).setScale(1.2));
      }
      if (p.solido) {
        const largura = Math.min(24, Math.max(6, (direita - esquerda) * 0.5));
        solido(o.x - info.ox + (esquerda + direita) / 2, baseY - 3, largura, 6);
      }
    }

    // objetos do jogo: início, painel do moinho, quadro, portão e moradores
    let inicio = { x: 24 * 16, y: 31 * 16 };
    let painelPos = { x: 0, y: 0 };
    let lia: Morador | null = null;
    for (const o of (mapa.getObjectLayer("objetos")?.objects ?? []) as ObjetoTiled[]) {
      const p = propriedades(o);
      if (o.type === "inicio") inicio = { x: o.x, y: o.y };
      if (o.type === "terminal") {
        painelPos = { x: o.x, y: o.y };
        this.painel = this.add.image(o.x, o.y + 4, "painel-apagado").setOrigin(0.5, 1).setDepth(o.y + 4);
        solido(o.x, o.y, 12, 6);
        this.interativos.push({ x: o.x, y: o.y + 10, rotulo: "Usar painel",
          acao: () => this.usarPainel(String(p.missao), String(p.equipamento)) });
      }
      if (o.type === "quadro") {
        this.add.image(o.x, o.y + 4, "quadro").setOrigin(0.5, 1).setDepth(o.y + 4);
        solido(o.x, o.y, 16, 6);
        this.interativos.push({ x: o.x, y: o.y + 10, rotulo: "Ler avisos", acao: () => this.lerQuadro() });
      }
      if (o.type === "portao") {
        this.add.image(o.x, o.y + 6, "portao").setOrigin(0.5, 1).setDepth(o.y + 6);
        solido(o.x, o.y, 16, 12);
        this.interativos.push({ x: o.x, y: o.y + 14, rotulo: "Examinar portão",
          acao: () => this.examinarPortao(String(p.destino)) });
      }
      if (o.type === "npc") {
        const dados: DadosMorador = {
          nome: o.name, rotulo: String(p.rotulo ?? o.name), visual: String(p.visual ?? "shorthair"),
          comportamento: String(p.comportamento ?? "parado") as Comportamento, acao: String(p.acao ?? "idle"),
          raio: Number(p.raio ?? 3), rota: lerJson(p.rota, []), falas: lerJson(p.falas, ["Olá!"]), x: o.x, y: o.y,
        };
        const morador = new Morador(this, dados, (x, y) => this.livre(x, y));
        this.moradores.push(morador);
        if (p.missao) lia = morador;
        this.interativos.push({
          x: o.x, y: o.y, rotulo: `Falar com ${dados.rotulo}`, morador,
          acao: () => (morador === lia ? this.falarComLia(morador) : this.conversar(morador)),
        });
      }
    }

    const parado = manifesto.personagens[`${VISUAL_JOGADOR}_idle`];
    this.jogador = this.physics.add.sprite(inicio.x, inicio.y, chavePersonagem(VISUAL_JOGADOR, "idle"));
    this.jogador.setOrigin(parado.ox / parado.w, parado.oy / parado.h);
    this.jogador.setSize(10, 6).setOffset(parado.ox - 5, parado.oy - 6).setCollideWorldBounds(true);
    this.jogador.play(chavePersonagem(VISUAL_JOGADOR, "idle"));
    this.physics.add.collider(this.jogador, this.colisao);
    this.physics.add.collider(this.jogador, solidos);
    for (const m of this.moradores) {
      this.physics.add.collider(m.sprite, this.colisao);
      this.physics.add.collider(m.sprite, solidos);
      this.physics.add.collider(this.jogador, m.sprite);
    }

    this.escuridao = this.add.rectangle(0, 0, mapa.widthInPixels, mapa.heightInPixels, ESCURIDAO, ESCURIDAO_APAGADA)
      .setOrigin(0).setDepth(900_000);

    this.seta = this.add.image(0, 0, "seta").setDepth(1_500_000);
    const liaAlvo = lia as Morador | null;
    this.apontar(liaAlvo ? () => ({ x: liaAlvo.sprite.x, y: liaAlvo.sprite.y - 24 }) : null);
    this.registry.set("alvoPainel", painelPos);

    const kb = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.teclas = {
      cima: kb.addKey(K.UP), baixo: kb.addKey(K.DOWN), esquerda: kb.addKey(K.LEFT), direita: kb.addKey(K.RIGHT),
      w: kb.addKey(K.W), a: kb.addKey(K.A), s: kb.addKey(K.S), d: kb.addKey(K.D),
      usar: kb.addKey(K.E), espaco: kb.addKey(K.SPACE), correr: kb.addKey(K.SHIFT),
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
    this.ui.hud.definir({ regiao: "Vila", energia: 0,
      objetivo: "A Vila está sem energia. Procure a técnica Lia, perto do moinho grande." });
    if (new URLSearchParams(location.search).has("debug")) kb.addKey(K.L).on("down", () => this.acender());
    (window as unknown as { __ilha: unknown }).__ilha = { cena: this };
  }

  private apontar(alvo: (() => { x: number; y: number }) | null) {
    this.seguirSeta = alvo;
    this.seta.setVisible(alvo !== null);
  }

  private livre(x: number, y: number): boolean {
    const tile = this.colisao.getTileAtWorldXY(x, y, true);
    return !!tile && tile.index === -1;
  }

  private ajustarZoom() {
    const { width, height } = this.scale;
    // cerca de 24 tiles na largura em telas grandes; no celular, mínimo de 2x
    const zoom = Phaser.Math.Clamp(Math.min(width / (16 * 24), height / (16 * 14)), 2, 5);
    this.cameras.main.setZoom(Math.round(zoom * 2) / 2);
  }

  private bloqueado() {
    return this.ocupado || this.ui.dialogo.aberto || this.ui.terminal.aberto;
  }

  update(tempo: number, delta: number) {
    for (const m of this.moradores) m.update(delta, this.jogador);
    if (this.seguirSeta) {
      const { x, y } = this.seguirSeta();
      this.seta.setPosition(x, y + Math.sin(tempo / 180) * 2);
    }

    const corpo = this.jogador.body as Phaser.Physics.Arcade.Body;
    this.jogador.setDepth(this.jogador.y);
    if (this.bloqueado()) {
      corpo.setVelocity(0, 0);
      this.jogador.play(chavePersonagem(VISUAL_JOGADOR, "idle"), true);
      this.ui.aviso(null);
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
      const correndo = t.correr.isDown;
      const velocidade = VELOCIDADE * intensidade * (correndo ? 1.6 : 1);
      const angulo = Math.atan2(vy, vx);
      corpo.setVelocity(Math.cos(angulo) * velocidade, Math.sin(angulo) * velocidade);
      if (Math.abs(vx) > 0.1) this.jogador.setFlipX(vx < 0);
      this.jogador.play(chavePersonagem(VISUAL_JOGADOR, correndo ? "run" : "walk"), true);
    } else {
      corpo.setVelocity(0, 0);
      this.jogador.play(chavePersonagem(VISUAL_JOGADOR, "idle"), true);
    }

    this.proximo = null;
    let menor = ALCANCE_INTERACAO;
    for (const item of this.interativos) {
      const x = item.morador ? item.morador.sprite.x : item.x;
      const y = item.morador ? item.morador.sprite.y : item.y;
      const d = Phaser.Math.Distance.Between(this.jogador.x, this.jogador.y, x, y);
      if (d < menor) { menor = d; this.proximo = item; }
    }
    if (this.proximo) {
      const cam = this.cameras.main;
      this.ui.aviso(this.proximo.rotulo, (this.jogador.x - cam.worldView.x) * cam.zoom,
        (this.jogador.y - 22 - cam.worldView.y) * cam.zoom, !this.ui.toque.ativo);
    } else {
      this.ui.aviso(null);
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

  private async conversar(morador: Morador) {
    morador.conversando = true;
    await this.ui.dialogo.mostrar([{ quem: morador.dados.rotulo, texto: morador.proximaFala() }]);
    morador.conversando = false;
  }

  private async falarComLia(lia: Morador) {
    const d = this.ui.dialogo;
    lia.conversando = true;
    try {
      if (this.estado.acesa) {
        await d.mostrar([
          { quem: "Lia", texto: "Olha os moinhos girando! A Vila inteira tem energia graças ao seu código." },
          { quem: "Lia", texto: "Logo o portão para o Campo Solar vai abrir. Lá a energia vem do sol." },
        ]);
        return;
      }
      if (this.estado.missaoAceita) {
        await d.mostrar([{ quem: "Lia", texto: "O painel fica bem aqui, ao pé do moinho grande." }]);
        return;
      }
      const escolha = await d.mostrar([
        { quem: "Lia", texto: "Oi! Você é a pessoa engenheira que chegou ontem? Eu sou a Lia, técnica da Vila." },
        { quem: "Lia", texto: "O vento está bom, mas o painel do Moinho G1 perdeu o programa e travou as pás." },
        { quem: "Lia", texto: "Sem o painel mostrando o status, o sistema não libera a energia. Você consegue reprogramar?" },
      ], ["Aceitar missão", "Agora não"]);
      if (escolha === "Aceitar missão") {
        this.estado.missaoAceita = true;
        const alvo = this.registry.get("alvoPainel") as { x: number; y: number };
        this.apontar(() => ({ x: alvo.x, y: alvo.y - 24 }));
        this.ui.hud.definir({ objetivo: "Use o painel ao pé do moinho grande." });
        await d.mostrar([{ quem: "Lia", texto: "Ótimo! O painel fica bem aqui, ao pé do moinho. Boa sorte!" }]);
      }
    } finally {
      lia.conversando = false;
    }
  }

  private async usarPainel(idMissao: string, equipamento: string) {
    if (this.estado.acesa) {
      await this.ui.dialogo.mostrar([{ quem: equipamento, texto: "Status: ligado. Produção estável em 35 kW." }]);
      return;
    }
    if (!this.estado.missaoAceita) {
      await this.ui.dialogo.mostrar([
        { quem: equipamento, texto: "Painel sem programa. Acesso restrito à equipe técnica." },
        { quem: "Você", texto: "Melhor falar com a técnica da Vila antes." },
      ]);
      return;
    }
    this.input.keyboard!.enabled = false;
    this.input.keyboard!.disableGlobalCapture();
    const resultado = await this.ui.terminal.abrir(equipamento, idMissao, this.semente);
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
      { quem: "Quadro de avisos", texto: "ATIVIDADE DA SEMANA: religar o Moinho G1. Prazo: domingo, 23h59." },
      { quem: "Quadro de avisos", texto: "Recado da equipe: cada print mostra uma linha na tela, de cima para baixo." },
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
    this.apontar(null);
    this.painel.setTexture("painel-aceso");
    const camera = this.cameras.main;
    camera.stopFollow();
    camera.pan(this.painel.x, this.painel.y - 40, 700, "Sine.easeInOut");
    this.time.delayedCall(800, () => {
      camera.shake(250, 0.003);
      this.moinhos.forEach((m, i) => this.time.delayedCall(i * 250, () => m.anims.resume()));
      this.tweens.add({ targets: this.escuridao, alpha: ESCURIDAO_ACESA, duration: 2200, ease: "Sine.out" });
      this.tweens.add({ targets: this.luzes, alpha: 0.6, duration: 1500, delay: 600 });
    });
    this.time.delayedCall(3200, () => camera.startFollow(this.jogador, true, 0.12, 0.12));
    this.ui.hud.definir({ energia: this.estado.energia,
      objetivo: "A Vila tem energia! Converse com os moradores e explore." });
    this.ui.hud.notificar("⚡ Os moinhos voltaram a girar!");
  }
}
