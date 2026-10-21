// Web Worker que roda o Python do jogo (núcleo + conteúdo) no Pyodide.
// Recebe {id, acao, args} e responde {id, ok, dados | erro}.
// As ações são as funções de python/ilha/api.py, que devolvem JSON.

const VERSAO_PYODIDE = "0.26.4";
importScripts(`https://cdn.jsdelivr.net/pyodide/v${VERSAO_PYODIDE}/full/pyodide.js`);

const BASE_PYTHON = new URL("../python/", self.location).href;
const DESTINO = "/home/pyodide/jogo";
let api = null;

async function iniciar() {
  const pyodide = await loadPyodide();
  const arquivos = await (await fetch(BASE_PYTHON + "arquivos.json", { cache: "no-store" })).json();
  await Promise.all(arquivos.map(async (caminho) => {
    const resposta = await fetch(BASE_PYTHON + caminho, { cache: "no-store" });
    if (!resposta.ok) throw new Error(`não carregou ${caminho}: ${resposta.status}`);
    const destino = `${DESTINO}/${caminho}`;
    pyodide.FS.mkdirTree(destino.slice(0, destino.lastIndexOf("/")));
    pyodide.FS.writeFile(destino, await resposta.text());
  }));
  pyodide.runPython(`import sys; sys.path.insert(0, "${DESTINO}")`);
  api = pyodide.pyimport("ilha.api");
}

const pronto = iniciar();

self.onmessage = async ({ data }) => {
  const { id, acao, args } = data;
  try {
    await pronto;
    if (acao === "pronto") {
      self.postMessage({ id, ok: true, dados: true });
      return;
    }
    const texto = api[acao](...args);
    self.postMessage({ id, ok: true, dados: JSON.parse(texto) });
  } catch (erro) {
    self.postMessage({ id, ok: false, erro: String(erro && erro.message || erro) });
  }
};
