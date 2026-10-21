import Phaser from "phaser";
import { ExecutorPython } from "../executor/cliente.js";
import { Carregamento } from "./cenas/Carregamento";
import { Vila } from "./cenas/Vila";
import { Interface } from "./ui/interface";
import "./estilo.css";

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
