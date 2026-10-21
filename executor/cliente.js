// Interface do jogo com o worker Python.
// Cada chamada tem um limite de tempo de segurança: o Python já interrompe
// laços infinitos sozinho (3 s), mas se o worker travar, ele é recriado.

const LIMITE_MS = 20000;

export class ExecutorPython {
  constructor(urlWorker = new URL("./worker.js", import.meta.url)) {
    this.urlWorker = urlWorker;
    this.proximoId = 1;
    this.pendentes = new Map();
    this._criarWorker();
  }

  _criarWorker() {
    this.worker = new Worker(this.urlWorker);
    this.worker.onmessage = ({ data }) => {
      const pendente = this.pendentes.get(data.id);
      if (!pendente) return;
      clearTimeout(pendente.timer);
      this.pendentes.delete(data.id);
      data.ok ? pendente.resolver(data.dados) : pendente.rejeitar(new Error(data.erro));
    };
    this.pronto = this._chamar("pronto", [], 120000);
  }

  _chamar(acao, args, limiteMs = LIMITE_MS) {
    const id = this.proximoId++;
    return new Promise((resolver, rejeitar) => {
      const timer = setTimeout(() => {
        this.pendentes.delete(id);
        this.worker.terminate();
        for (const p of this.pendentes.values()) {
          clearTimeout(p.timer);
          p.rejeitar(new Error("O executor foi reiniciado."));
        }
        this.pendentes.clear();
        this._criarWorker();
        rejeitar(new Error("O programa demorou demais e foi interrompido."));
      }, limiteMs);
      this.pendentes.set(id, { resolver, rejeitar, timer });
      this.worker.postMessage({ id, acao, args });
    });
  }

  async listar() { await this.pronto; return this._chamar("listar", []); }
  async gerar(idModelo, semente) { await this.pronto; return this._chamar("gerar", [idModelo, String(semente)]); }
  async rodar(codigo, entradas = []) { await this.pronto; return this._chamar("rodar", [codigo, JSON.stringify(entradas)]); }
  async avaliar(idModelo, semente, resposta) {
    await this.pronto;
    return this._chamar("avaliar", [idModelo, String(semente), JSON.stringify(resposta)]);
  }
}
