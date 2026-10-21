// Caixa de diálogo dos personagens, desenhada em HTML sobre o jogo.
// Texto aparece letra por letra; clique, Espaço, Enter ou E avançam.

export interface Fala {
  quem: string;
  texto: string;
}

export class Dialogo {
  private raiz: HTMLDivElement;
  private nome: HTMLDivElement;
  private texto: HTMLDivElement;
  private opcoes: HTMLDivElement;
  private avancar: (() => void) | null = null;
  aberto = false;

  constructor(container: HTMLElement) {
    this.raiz = document.createElement("div");
    this.raiz.className = "dialogo";
    this.raiz.hidden = true;
    this.raiz.innerHTML = `<div class="dialogo-nome"></div><div class="dialogo-texto"></div>
      <div class="dialogo-opcoes"></div><div class="dialogo-continuar">▼</div>`;
    container.appendChild(this.raiz);
    this.nome = this.raiz.querySelector(".dialogo-nome")!;
    this.texto = this.raiz.querySelector(".dialogo-texto")!;
    this.opcoes = this.raiz.querySelector(".dialogo-opcoes")!;
    this.raiz.addEventListener("click", () => this.avancar?.());
    window.addEventListener("keydown", (e) => {
      if (!this.aberto || !["Space", "Enter", "KeyE"].includes(e.code)) return;
      e.preventDefault();
      this.avancar?.();
    });
  }

  /** Mostra as falas em sequência. Com opções, devolve a escolhida na última fala. */
  async mostrar(falas: Fala[], opcoes: string[] = []): Promise<string | undefined> {
    this.aberto = true;
    this.raiz.hidden = false;
    let escolha: string | undefined;
    for (let i = 0; i < falas.length; i++) {
      const ultima = i === falas.length - 1;
      await this.escrever(falas[i]);
      if (ultima && opcoes.length) {
        escolha = await this.escolher(opcoes);
      } else {
        await new Promise<void>((resolver) => { this.avancar = resolver; });
      }
    }
    this.avancar = null;
    this.raiz.hidden = true;
    // fecha no próximo quadro, para a mesma tecla não reabrir a conversa
    await new Promise((r) => setTimeout(r, 120));
    this.aberto = false;
    return escolha;
  }

  private escrever(fala: Fala): Promise<void> {
    this.nome.textContent = fala.quem;
    this.texto.textContent = "";
    this.opcoes.innerHTML = "";
    this.raiz.classList.add("escrevendo");
    return new Promise((resolver) => {
      let i = 0;
      const timer = setInterval(() => {
        i += 2;
        this.texto.textContent = fala.texto.slice(0, i);
        if (i >= fala.texto.length) terminar();
      }, 22);
      const terminar = () => {
        clearInterval(timer);
        this.texto.textContent = fala.texto;
        this.raiz.classList.remove("escrevendo");
        this.avancar = null;
        resolver();
      };
      this.avancar = terminar; // primeiro toque completa o texto
    });
  }

  private escolher(opcoes: string[]): Promise<string> {
    return new Promise((resolver) => {
      this.avancar = null;
      this.raiz.classList.add("com-opcoes");
      opcoes.forEach((opcao, i) => {
        const botao = document.createElement("button");
        botao.textContent = opcao;
        botao.onclick = (e) => {
          e.stopPropagation();
          this.raiz.classList.remove("com-opcoes");
          resolver(opcao);
        };
        this.opcoes.appendChild(botao);
        if (i === 0) setTimeout(() => botao.focus(), 0);
      });
    });
  }
}
