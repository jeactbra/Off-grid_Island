// Autoteste de integração do jogo (Fase 2): ?autoteste=URL envia o relatório por POST.
// Percorre o fluxo real: andar, falar com a Lia, aceitar, abrir o terminal, errar, acertar, acender.

import Phaser from "phaser";
import { EditorView } from "codemirror";
import type { Vila } from "./cenas/Vila";

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function ate<T>(condicao: () => T | null | undefined | false, limiteMs = 60000): Promise<T> {
  const inicio = performance.now();
  for (;;) {
    const valor = condicao();
    if (valor) return valor;
    if (performance.now() - inicio > limiteMs) throw new Error("tempo esgotado esperando condição");
    await esperar(100);
  }
}

export async function autoteste(jogo: Phaser.Game, destino: string) {
  const relatorio: Array<{ nome: string; ok: boolean; detalhe: string }> = [];
  const checar = (nome: string, ok: unknown, detalhe = "") => {
    relatorio.push({ nome, ok: !!ok, detalhe });
    void fetch("/progresso", { method: "POST", body: `${ok ? "OK" : "FALHA"} ${nome} ${detalhe}` });
  };
  const pulso = setInterval(() => void fetch("/progresso", { method: "POST",
    body: `pulso fps=${jogo.loop.actualFps.toFixed(1)} cena=${jogo.scene.isActive("Vila")} erros=${((window as unknown as { __erros?: string[] }).__erros ?? []).join(" // ").slice(0, 1500)}` }), 5000);
  const $ = <E extends Element>(sel: string) => document.querySelector<E>(sel);
  let imagem = "";
  let imagemAntes = "";
  const capturar = () => new Promise<string>((resolver) =>
    jogo.renderer.snapshot((img) => resolver((img as HTMLImageElement).src)));

  try {
    const cena = await ate(() => (jogo.scene.isActive("Vila") ? (jogo.scene.getScene("Vila") as Vila) : null));
    const jogador = (cena as unknown as { jogador: Phaser.Physics.Arcade.Sprite }).jogador;
    const ui = jogo.registry.get("interface");
    checar("cena da Vila ativa", true, `renderizador: ${jogo.renderer.type === Phaser.WEBGL ? "WebGL" : "Canvas"}`);

    await esperar(2000);
    imagemAntes = await capturar();
    checar("quadros por segundo", jogo.loop.actualFps >= 30, `${jogo.loop.actualFps.toFixed(1)} fps`);

    const moradores = (cena as unknown as { moradores: Array<{ sprite: Phaser.GameObjects.Sprite; dados: { comportamento: string } }> }).moradores;
    const andantes = moradores.filter((m) => m.dados.comportamento !== "parado");
    const antes = andantes.map((m) => ({ x: m.sprite.x, y: m.sprite.y }));
    await esperar(4000);
    const moveram = andantes.filter((m, i) => Phaser.Math.Distance.Between(m.sprite.x, m.sprite.y, antes[i].x, antes[i].y) > 4).length;
    checar("moradores na Vila", moradores.length >= 10, `${moradores.length} moradores`);
    checar("moradores andando", moveram >= 1, `${moveram} de ${andantes.length} se moveram em 4 s`);

    const x0 = jogador.x;
    ui.toque.vetor = { x: 1, y: 0 };
    await esperar(600);
    ui.toque.vetor = { x: 0, y: 0 };
    checar("personagem anda (controle de toque)", jogador.x > x0 + 20, `${x0.toFixed(0)} → ${jogador.x.toFixed(0)}`);

    jogador.setPosition(37 * 16 + 8, 23 * 16 + 4); // ao sul da Lia
    await esperar(200);
    void cena.interagir();
    const dialogo = await ate(() => $<HTMLDivElement>(".dialogo:not([hidden])"), 3000);
    checar("diálogo com a Lia abre", dialogo.textContent?.includes("Lia"));
    const aceitar = await ate(() => {
      const botao = $<HTMLButtonElement>(".dialogo-opcoes button");
      if (!botao) dialogo.click();
      return botao;
    }, 15000);
    aceitar.click();
    await esperar(400); // o diálogo fecha e reabre com a fala seguinte
    await ate(() => $<HTMLDivElement>(".dialogo:not([hidden])"), 3000);
    await ate(() => { dialogo.click(); return dialogo.hidden ? true : null; }, 8000);
    checar("missão aceita", cena.estado.missaoAceita);

    await esperar(300);
    jogador.setPosition(40 * 16 + 8, 21 * 16 + 6); // em frente ao painel do moinho
    await esperar(200);
    void cena.interagir();
    const titulo = await ate(() => $<HTMLElement>(".terminal-missao h2"), 90000);
    checar("terminal abre com a missão", titulo.textContent, titulo.textContent ?? "");
    const editorEl = await ate(() => $<HTMLElement>(".cm-editor"), 5000);
    const editor = EditorView.findFromDOM(editorEl)!;
    const escrever = (codigo: string) =>
      editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: codigo } });

    escrever('Print("oi")\n');
    $<HTMLButtonElement>("[data-acao=enviar]")!.click();
    const falha = await ate(() => $<HTMLElement>(".console.falha .erro"), 10000);
    checar("erro traduzido no terminal", falha.textContent?.includes("minúsculas"), falha.textContent ?? "");
    checar("tentativas não aparecem durante a missão", !document.querySelector(".terminal")!.textContent!.includes("Tentativa"));

    const esperada = $<HTMLElement>(".bloco.saida")!.textContent!.replace(/\n$/, "");
    escrever(esperada.split("\n").map((l) => (l ? `print(${JSON.stringify(l)})` : "print()")).join("\n") + "\n");
    $<HTMLButtonElement>("[data-acao=enviar]")!.click();
    const conclusao = await ate(() => $<HTMLElement>(".conclusao"), 10000);
    checar("conclusão mostra tentativas e energia", /Tentativas\s*2/.test(conclusao.textContent ?? "")
      && conclusao.textContent!.includes("kWh"), conclusao.textContent!.replace(/\s+/g, " ").trim());

    $<HTMLButtonElement>("[data-acao=voltar]")!.click();
    await esperar(2500);
    checar("terminal fecha e volta ao mapa", !ui.terminal.aberto);
    checar("Vila acende", cena.estado.acesa, `energia: ${cena.estado.energia} kWh`);
    const moinhos = (cena as unknown as { moinhos: Phaser.GameObjects.Sprite[] }).moinhos;
    checar("moinhos girando", moinhos.length >= 4 && moinhos.every((m) => m.anims.isPlaying), `${moinhos.length} moinhos`);
    checar("HUD atualizado", $(".hud-energia b")!.textContent === String(cena.estado.energia));

    jogador.setPosition(36 * 16, 24 * 16);
    await esperar(1500);
    imagem = await capturar();
  } catch (e) {
    checar("exceção no autoteste", false, String(e));
  }
  const erros = (window as unknown as { __erros?: string[] }).__erros ?? [];
  checar("sem erros na página", erros.length === 0, erros.slice(0, 5).join(" | "));
  clearInterval(pulso);
  await fetch(destino, { method: "POST", body: JSON.stringify({ relatorio, imagem, imagemAntes }) });
}
