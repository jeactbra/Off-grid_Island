export interface ErroPython {
  tipo: string;
  linha: number | null;
  mensagem: string;
  dica: string;
  conceito: string;
  original: string;
}

export interface MissaoPython {
  id: string;
  regiao: string;
  formato: "prever" | "completar" | "detetive" | "programa";
  chefe: boolean;
  semente: string;
  titulo: string;
  enunciado: string;
  codigo: string;
  lacunas: number;
  entradas_exemplo: string[];
  saida_esperada: string | null;
  dicas: string[];
}

export interface Rodada {
  saida: string;
  prompts: string[];
  erro: ErroPython | null;
}

export interface Avaliacao {
  passou: boolean;
  mensagem: string;
  erro: ErroPython | null;
  entradas: string[] | null;
  esperada: string | null;
  obtida: string | null;
  linha_diferente: number | null;
}

export class ExecutorPython {
  constructor(urlWorker?: URL);
  pronto: Promise<boolean>;
  listar(): Promise<Array<{ id: string; regiao: string; formato: string; chefe: boolean }>>;
  gerar(idModelo: string, semente: string | number): Promise<MissaoPython>;
  rodar(codigo: string, entradas?: string[]): Promise<Rodada>;
  avaliar(idModelo: string, semente: string | number, resposta: string | string[]): Promise<Avaliacao>;
}
