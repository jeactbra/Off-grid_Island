// Terminal do equipamento: abre sobre o jogo para o aluno resolver a missão.
// Regra do jogo: tentativas são contadas em silêncio e só aparecem na conclusão.

import { EditorView, basicSetup } from "codemirror";
import { keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";
import type { Avaliacao, ErroPython, ExecutorPython, MissaoPython } from "../../executor/cliente.js";

export interface ResultadoTerminal {
  concluida: boolean;
  tentativas: number;
  energia: number;
}

const ENERGIA_BASE = 120;
const BONUS_PERSISTENCIA = 30;
const TENTATIVAS_PARA_BONUS = 4;

function escapar(texto: string | null | undefined) {
  return String(texto ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

export class Terminal {
  private raiz: HTMLDivElement;
  private editor: EditorView | null = null;
  private missao: MissaoPython | null = null;
  private tentativas = 0;
  private dicasMostradas = 0;
  private rascunhos = new Map<string, string>();
  private fechar: ((r: ResultadoTerminal) => void) | null = null;
  private concluida = false;
  aberto = false;

  constructor(container: HTMLElement, private executor: ExecutorPython) {
    this.raiz = document.createElement("div");
    this.raiz.className = "terminal-fundo";
    this.raiz.hidden = true;
    container.appendChild(this.raiz);
    window.addEventListener("keydown", (e) => {
      if (this.aberto && e.key === "Escape") this.encerrar();
    });
  }

  /** Abre a missão e resolve quando o aluno fecha o terminal. */
  async abrir(equipamento: string, idModelo: string, semente: string): Promise<ResultadoTerminal> {
    this.aberto = true;
    this.concluida = false;
    this.tentativas = 0;
    this.dicasMostradas = 0;
    this.raiz.hidden = false;
    this.raiz.innerHTML = `<div class="terminal"><div class="terminal-carregando">
      Conectando ao ${escapar(equipamento)}…</div></div>`;

    try {
      this.missao = await this.executor.gerar(idModelo, semente);
    } catch (erro) {
      this.raiz.innerHTML = `<div class="terminal"><div class="terminal-carregando">
        Não foi possível conectar: ${escapar(String(erro))}
        <button class="botao" data-acao="fechar">Fechar</button></div></div>`;
      this.raiz.querySelector<HTMLButtonElement>("[data-acao=fechar]")!.onclick = () => this.encerrar();
    }
    if (this.missao) this.montar(equipamento, this.missao);
    return new Promise((resolver) => { this.fechar = resolver; });
  }

  private montar(equipamento: string, m: MissaoPython) {
    const f = m.formato;
    this.raiz.innerHTML = `
      <div class="terminal" role="dialog" aria-label="Terminal do ${escapar(equipamento)}">
        <header class="terminal-topo">
          <span class="terminal-luz"></span>
          <strong>Terminal · ${escapar(equipamento)}</strong>
          ${m.chefe ? `<span class="selo">Chefe da região</span>` : ""}
          <button class="terminal-x" data-acao="fechar" aria-label="Fechar (Esc)">✕</button>
        </header>
        <div class="terminal-corpo">
          <section class="terminal-missao">
            <h2>${escapar(m.titulo)}</h2>
            <p>${escapar(m.enunciado)}</p>
            ${f === "prever" || f === "completar"
              ? `<h3>Código</h3><pre class="bloco">${escapar(m.codigo)}</pre>` : ""}
            ${m.saida_esperada !== null
              ? `<h3>Saída esperada</h3><pre class="bloco saida">${escapar(m.saida_esperada)}</pre>` : ""}
            <div class="mentora" hidden></div>
          </section>
          <section class="terminal-trabalho">
            ${f === "prever" ? `<h3>Sua previsão</h3><textarea class="previsao" spellcheck="false"></textarea>` : ""}
            ${f === "completar" ? `<h3>Lacunas</h3><div class="lacunas">${Array.from({ length: m.lacunas },
              (_, i) => `<label>Lacuna ${i + 1}<input spellcheck="false" autocomplete="off"></label>`).join("")}</div>` : ""}
            ${f === "detetive" || f === "programa" ? `<div class="editor"></div>` : ""}
            <div class="terminal-acoes">
              ${f !== "prever" ? `<button class="botao" data-acao="rodar">▶ Rodar</button>` : ""}
              <button class="botao principal" data-acao="enviar">Enviar</button>
              <button class="botao" data-acao="dica">💡 Pedir dica à Iara</button>
            </div>
            <div class="console" aria-live="polite"></div>
          </section>
        </div>
      </div>`;

    if (f === "detetive" || f === "programa") {
      this.editor?.destroy();
      this.editor = new EditorView({
        doc: this.rascunhos.get(m.id) ?? m.codigo,
        extensions: [basicSetup, keymap.of([indentWithTab]), python(), oneDark,
          EditorView.updateListener.of((u) => {
            if (u.docChanged) this.rascunhos.set(m.id, u.state.doc.toString());
          })],
        parent: this.raiz.querySelector(".editor")!,
      });
      setTimeout(() => this.editor?.focus(), 50);
    }

    const acao = (nome: string, fn: () => void) => {
      const botao = this.raiz.querySelector<HTMLButtonElement>(`[data-acao=${nome}]`);
      if (botao) botao.onclick = fn;
    };
    acao("fechar", () => this.encerrar());
    acao("rodar", () => this.rodar());
    acao("enviar", () => this.enviar());
    acao("dica", () => this.dica());
  }

  private resposta(): string | string[] {
    const f = this.missao!.formato;
    if (f === "prever") return this.raiz.querySelector<HTMLTextAreaElement>(".previsao")!.value;
    if (f === "completar") {
      return [...this.raiz.querySelectorAll<HTMLInputElement>(".lacunas input")].map((i) => i.value);
    }
    return this.editor!.state.doc.toString();
  }

  private codigoParaRodar(): string {
    const m = this.missao!;
    if (m.formato !== "completar") return this.editor!.state.doc.toString();
    const valores = this.resposta() as string[];
    return m.codigo.split("___").reduce((acc, parte, i) => acc + (i ? valores[i - 1] : "") + parte, "");
  }

  private console(html: string, classe = "") {
    const el = this.raiz.querySelector<HTMLDivElement>(".console")!;
    el.className = `console ${classe}`;
    el.innerHTML = html;
  }

  private htmlErro(erro: ErroPython) {
    const linha = erro.linha ? ` <span class="linha">linha ${erro.linha}</span>` : "";
    return `<p class="erro">${escapar(erro.mensagem)}${linha}</p><p>${escapar(erro.dica)}</p>
      <p class="original">${escapar(erro.original)}</p>`;
  }

  private async rodar() {
    const botao = this.raiz.querySelector<HTMLButtonElement>("[data-acao=rodar]")!;
    botao.disabled = true;
    this.console(`<p class="aguarde">Rodando…</p>`);
    try {
      const r = await this.executor.rodar(this.codigoParaRodar(), this.missao!.entradas_exemplo);
      this.console(`<h3>Saída</h3><pre class="bloco">${escapar(r.saida) || "(nada foi mostrado)"}</pre>
        ${r.erro ? this.htmlErro(r.erro) : ""}`, r.erro ? "falha" : "");
    } catch (e) {
      this.console(`<p class="erro">${escapar(String(e))}</p>`, "falha");
    } finally {
      botao.disabled = false;
    }
  }

  private async enviar() {
    const botao = this.raiz.querySelector<HTMLButtonElement>("[data-acao=enviar]")!;
    botao.disabled = true;
    this.tentativas += 1;
    this.console(`<p class="aguarde">Testando no sistema…</p>`);
    try {
      const r = await this.executor.avaliar(this.missao!.id, this.missao!.semente, this.resposta());
      if (r.passou) this.concluir();
      else this.mostrarFalha(r);
    } catch (e) {
      this.console(`<p class="erro">${escapar(String(e))}</p>`, "falha");
    } finally {
      botao.disabled = false;
    }
  }

  private mostrarFalha(r: Avaliacao) {
    const detalhe = r.esperada !== null && !r.erro && r.obtida !== null
      ? `<div class="comparacao"><div><h4>Esperado</h4><pre class="bloco">${escapar(r.esperada)}</pre></div>
         <div><h4>Seu programa</h4><pre class="bloco">${escapar(r.obtida) || "(nada)"}</pre></div></div>` : "";
    this.console(`<p>${escapar(r.mensagem)}</p>${r.erro ? this.htmlErro(r.erro) : ""}${detalhe}`, "falha");
  }

  private concluir() {
    this.concluida = true;
    const persistente = this.tentativas >= TENTATIVAS_PARA_BONUS;
    const energia = ENERGIA_BASE + (persistente ? BONUS_PERSISTENCIA : 0);
    this.raiz.querySelector(".terminal-corpo")!.innerHTML = `
      <section class="conclusao">
        <div class="conclusao-icone">⚡</div>
        <h2>Sistema religado!</h2>
        <dl>
          <dt>Energia gerada</dt><dd>+${ENERGIA_BASE} kWh</dd>
          <dt>Tentativas</dt><dd>${this.tentativas}${persistente
            ? ` · <strong>Engenheiro persistente</strong> +${BONUS_PERSISTENCIA} kWh` : ""}</dd>
        </dl>
        <button class="botao principal" data-acao="voltar">Voltar à Vila</button>
      </section>`;
    this.raiz.querySelector<HTMLButtonElement>("[data-acao=voltar]")!.onclick = () => this.encerrar();
    this.rascunhos.delete(this.missao!.id);
    this.resultadoPendente = { concluida: true, tentativas: this.tentativas, energia };
  }

  private resultadoPendente: ResultadoTerminal | null = null;

  private dica() {
    const m = this.missao!;
    const caixa = this.raiz.querySelector<HTMLDivElement>(".mentora")!;
    if (this.dicasMostradas >= m.dicas.length) {
      caixa.insertAdjacentHTML("beforeend", `<p><em>Essas são todas as minhas dicas. Você consegue!</em></p>`);
      return;
    }
    caixa.hidden = false;
    caixa.insertAdjacentHTML("beforeend",
      `<p><strong>Iara:</strong> ${escapar(m.dicas[this.dicasMostradas])}</p>`);
    this.dicasMostradas += 1;
  }

  private encerrar() {
    if (!this.aberto) return;
    this.aberto = false;
    this.raiz.hidden = true;
    this.editor?.destroy();
    this.editor = null;
    const resultado = this.resultadoPendente
      ?? { concluida: this.concluida, tentativas: this.tentativas, energia: 0 };
    this.resultadoPendente = null;
    this.fechar?.(resultado);
    this.fechar = null;
  }
}
