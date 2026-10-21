// Camada HTML sobre o jogo: barra de status, diálogo, terminal e controles de toque.

import type { ExecutorPython } from "../../executor/cliente.js";
import { Dialogo } from "./dialogo";
import { Terminal } from "./terminal";
import { ControleToque } from "./toque";

export class Hud {
  private regiao: HTMLElement;
  private energia: HTMLElement;
  private objetivo: HTMLElement;
  private notificacao: HTMLElement;

  constructor(container: HTMLElement) {
    const raiz = document.createElement("div");
    raiz.className = "hud";
    raiz.innerHTML = `<div class="hud-linha"><span class="hud-regiao"></span>
      <span class="hud-energia" title="Energia gerada">⚡ <b>0</b> kWh</span></div>
      <div class="hud-objetivo"></div><div class="hud-notificacao" hidden></div>`;
    container.appendChild(raiz);
    this.regiao = raiz.querySelector(".hud-regiao")!;
    this.energia = raiz.querySelector(".hud-energia b")!;
    this.objetivo = raiz.querySelector(".hud-objetivo")!;
    this.notificacao = raiz.querySelector(".hud-notificacao")!;
  }

  definir({ regiao, energia, objetivo }: { regiao?: string; energia?: number; objetivo?: string }) {
    if (regiao !== undefined) this.regiao.textContent = regiao;
    if (energia !== undefined) this.energia.textContent = String(energia);
    if (objetivo !== undefined) this.objetivo.textContent = `Objetivo: ${objetivo}`;
  }

  notificar(texto: string) {
    this.notificacao.textContent = texto;
    this.notificacao.hidden = false;
    this.notificacao.classList.remove("entrando");
    void this.notificacao.offsetWidth;
    this.notificacao.classList.add("entrando");
    setTimeout(() => { this.notificacao.hidden = true; }, 3500);
  }
}

export class Interface {
  hud: Hud;
  dialogo: Dialogo;
  terminal: Terminal;
  toque: ControleToque;
  private balao: HTMLDivElement;

  constructor(container: HTMLElement, executor: ExecutorPython) {
    this.balao = document.createElement("div");
    this.balao.className = "aviso";
    this.balao.hidden = true;
    container.appendChild(this.balao);
    this.hud = new Hud(container);
    this.toque = new ControleToque(container);
    this.dialogo = new Dialogo(container);
    this.terminal = new Terminal(container, executor);
  }

  /** Balão "E · Falar com…" sobre o jogador (posição em pixels da tela). */
  aviso(texto: string | null, x = 0, y = 0, comTecla = true) {
    if (texto === null) {
      this.balao.hidden = true;
      return;
    }
    const conteudo = comTecla ? `<kbd>E</kbd> ${texto}` : texto;
    if (this.balao.innerHTML !== conteudo) this.balao.innerHTML = conteudo;
    this.balao.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -100%)`;
    this.balao.hidden = false;
  }
}
