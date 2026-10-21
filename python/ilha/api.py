"""Funções chamadas pelo navegador (via Pyodide). Entradas e saídas em JSON."""

import json

from ilha import desafio as _desafio
from ilha.execucao import executar


def _carregar_conteudo():
    import conteudo  # noqa: F401  (registra os modelos de todas as regiões)


def listar() -> str:
    _carregar_conteudo()
    return json.dumps([
        {"id": m.id, "regiao": m.regiao, "formato": m.formato, "conceitos": m.conceitos,
         "dificuldade": m.dificuldade, "chefe": m.chefe}
        for m in _desafio.MODELOS.values()
    ], ensure_ascii=False)


def gerar(id_modelo: str, semente: int) -> str:
    _carregar_conteudo()
    gerada = _desafio.gerar(id_modelo, int(semente))
    missao = gerada.missao
    return json.dumps({
        "id": gerada.id,
        "regiao": gerada.regiao,
        "formato": gerada.formato,
        "chefe": gerada.chefe,
        "semente": str(gerada.semente),
        "titulo": missao.titulo,
        "enunciado": missao.enunciado,
        "codigo": missao.codigo,
        "lacunas": missao.codigo.count(_desafio.LACUNA) if gerada.formato == "completar" else 0,
        "entradas_exemplo": gerada.casos[0].entradas,
        # no "prever" a saída é a própria resposta, então não vai para a tela
        "saida_esperada": None if gerada.formato == "prever" else gerada.saida_exemplo,
        "dicas": missao.dicas,
    }, ensure_ascii=False)


def rodar(codigo: str, entradas_json: str = "[]") -> str:
    execucao = executar(codigo, json.loads(entradas_json))
    return json.dumps({
        "saida": execucao.saida,
        "prompts": execucao.prompts,
        "erro": execucao.erro.para_dict() if execucao.erro else None,
    }, ensure_ascii=False)


def avaliar(id_modelo: str, semente: int, resposta_json: str) -> str:
    _carregar_conteudo()
    gerada = _desafio.gerar(id_modelo, int(semente))
    resultado = _desafio.avaliar(gerada, json.loads(resposta_json))
    return json.dumps({
        "passou": resultado.passou,
        "mensagem": resultado.mensagem,
        "erro": resultado.erro.para_dict() if resultado.erro else None,
        "entradas": resultado.entradas,
        "esperada": resultado.esperada,
        "obtida": resultado.obtida,
        "linha_diferente": resultado.linha_diferente,
    }, ensure_ascii=False)
