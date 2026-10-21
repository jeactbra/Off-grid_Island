import Phaser from "phaser";
import { ExecutorPython } from "../executor/cliente.js";
import { Carregamento } from "./cenas/Carregamento";
import { Vila } from "./cenas/Vila";
import { Interface } from "./ui/interface";
import "./estilo.css";

// erros guardados para o autoteste e para depuração
const erros: string[] = [];
(window as unknown as { __erros: string[] }).__erros = erros;
window.addEventListener("error", (e) => erros.push(`${e.message} @ ${e.filename}:${e.lineno}\n${e.error?.stack ?? ""}`));
window.addEventListener("unhandledrejection", (e) => erros.push(`promessa: ${e.reason}`));

// O Python começa a carregar já na abertura, enquanto o aluno explora.
const executor = new ExecutorPython();
const camadaUi = document.getElementById("interface")!;
const ui = new Interface(camadaUi, executor);

const jogo = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "jogo",
  backgroundColor: "#1b3a5c",
  pixelArt: true,
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  physics: { default: "arcade", arcade: { debug: new URLSearchParams(location.search).has("fisica") } },
  scene: [Carregamento, Vila],
  callbacks: {
    preBoot: (game) => {
      game.registry.set("interface", ui);
      game.registry.set("executor", executor);
    },
  },
});

(window as unknown as { __jogo: Phaser.Game }).__jogo = jogo;

const destinoAutoteste = new URLSearchParams(location.search).get("autoteste");
if (destinoAutoteste) {
  import("./autoteste").then(({ autoteste }) => autoteste(jogo, destinoAutoteste));
}
