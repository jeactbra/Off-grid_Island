// Controles de toque para celular: joystick à esquerda e botão de ação à direita.
// Aparecem em telas de toque (ou com ?toque=1 na URL).

export class ControleToque {
  vetor = { x: 0, y: 0 };
  ativo: boolean;
  aoAgir: () => void = () => {};
  private botao: HTMLButtonElement;

  constructor(container: HTMLElement) {
    this.ativo = matchMedia("(pointer: coarse)").matches
      || new URLSearchParams(location.search).has("toque");

    const raiz = document.createElement("div");
    raiz.className = "toque";
    raiz.hidden = !this.ativo;
    raiz.innerHTML = `<div class="joystick"><div class="joystick-pino"></div></div>
      <button class="acao" aria-label="Interagir">Usar</button>`;
    container.appendChild(raiz);

    const base = raiz.querySelector<HTMLDivElement>(".joystick")!;
    const pino = raiz.querySelector<HTMLDivElement>(".joystick-pino")!;
    this.botao = raiz.querySelector<HTMLButtonElement>(".acao")!;
    this.botao.addEventListener("pointerdown", (e) => { e.preventDefault(); this.aoAgir(); });

    const raio = 44;
    let ponteiro: number | null = null;
    const mover = (e: PointerEvent) => {
      const r = base.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2);
      let dy = e.clientY - (r.top + r.height / 2);
      const dist = Math.hypot(dx, dy);
      if (dist > raio) { dx = (dx / dist) * raio; dy = (dy / dist) * raio; }
      pino.style.transform = `translate(${dx}px, ${dy}px)`;
      this.vetor = dist < 8 ? { x: 0, y: 0 } : { x: dx / raio, y: dy / raio };
    };
    const soltar = () => {
      ponteiro = null;
      pino.style.transform = "";
      this.vetor = { x: 0, y: 0 };
    };
    base.addEventListener("pointerdown", (e) => {
      ponteiro = e.pointerId;
      base.setPointerCapture(e.pointerId);
      mover(e);
    });
    base.addEventListener("pointermove", (e) => { if (e.pointerId === ponteiro) mover(e); });
    base.addEventListener("pointerup", soltar);
    base.addEventListener("pointercancel", soltar);
  }

  rotuloAcao(texto: string | null) {
    this.botao.textContent = texto ?? "Usar";
    this.botao.classList.toggle("disponivel", texto !== null);
  }
}
