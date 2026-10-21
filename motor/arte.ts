// Recursos de arte gerados por ferramentas/importar_sunnyside.py.

import manifestoJson from "../arte/sunnyside/sprites.json";

export interface InfoSprite {
  arquivo: string;
  w: number;
  h: number;
  ox: number;
  oy: number;
  quadros: number;
  fps: number;
  base?: [number, number, number]; // esquerda, direita e fundo da área desenhada
}

export interface Manifesto {
  sprites: Record<string, InfoSprite>;
  personagens: Record<string, InfoSprite>;
  animacoes_tiles: Record<string, { quadros: number[]; fps: number }>;
}

export const manifesto = manifestoJson as unknown as Manifesto;

const urls = import.meta.glob("../arte/sunnyside/**/*.png", { eager: true, query: "?url", import: "default" }) as
  Record<string, string>;

export function urlArte(arquivo: string): string {
  const url = urls[`../arte/sunnyside/${arquivo}`];
  if (!url) throw new Error(`arte não encontrada: ${arquivo}`);
  return url;
}

/** Chave da animação de um personagem, com recuo para "parado" se a ação não existir. */
export function chavePersonagem(visual: string, acao: string): string {
  const chave = `${visual}_${acao}`;
  return manifesto.personagens[chave] ? chave : `${visual}_idle`;
}
