"""Base dos desafios: registro de modelos, geração por semente e avaliação.

Um modelo é uma função que recebe um `random.Random` e devolve uma `Missao`.
A saída esperada nunca é escrita à mão: ela vem de rodar a `solucao` do
modelo com cada lista de entradas. Assim o gabarito não pode divergir do enunciado.
"""

import hashlib
import random
from dataclasses import dataclass, field
from typing import Callable

from ilha.comparador import OpcoesComparacao, primeira_diferenca
from ilha.erros import ErroAmigavel
from ilha.execucao import executar

FORMATOS = ("prever", "completar", "detetive", "programa")
LACUNA = "___"


class ConteudoInvalido(Exception):
    """O modelo gerou uma missão inconsistente (erro do conteúdo, não do aluno)."""


@dataclass
class Missao:
    titulo: str
    enunciado: str
    solucao: str
    codigo: str = ""                     # código mostrado ao aluno (com lacunas ou com erro)
    entradas: list[list[str]] = field(default_factory=lambda: [[]])
    preenchimento: list[str] = field(default_factory=list)  # respostas certas das lacunas
    erradas: list[str] = field(default_factory=list)        # soluções típicas que devem falhar
    dicas: list[str] = field(default_factory=list)          # pista, exemplo, explicação
    opcoes: OpcoesComparacao = field(default_factory=OpcoesComparacao)


@dataclass
class Caso:
    entradas: list[str]
    esperada: str


@dataclass
class MissaoGerada:
    id: str
    regiao: str
    formato: str
    conceitos: list[str]
    dificuldade: int
    chefe: bool
    semente: int
    missao: Missao
    casos: list[Caso]

    @property
    def saida_exemplo(self) -> str:
        return self.casos[0].esperada


@dataclass
class Modelo:
    id: str
    regiao: str
    formato: str
    conceitos: list[str]
    dificuldade: int
    chefe: bool
    funcao: Callable[[random.Random], Missao]


@dataclass
class Resultado:
    passou: bool
    mensagem: str
    erro: ErroAmigavel | None = None
    entradas: list[str] | None = None
    esperada: str | None = None
    obtida: str | None = None
    linha_diferente: int | None = None


MODELOS: dict[str, Modelo] = {}


def desafio(*, id: str, regiao: str, formato: str, conceitos: list[str],
            dificuldade: int = 1, chefe: bool = False):
    """Registra uma função como modelo de desafio."""
    if formato not in FORMATOS:
        raise ValueError(f"formato desconhecido: {formato}")

    def registrar(funcao):
        if id in MODELOS:
            raise ValueError(f"id de desafio repetido: {id}")
        MODELOS[id] = Modelo(id, regiao, formato, conceitos, dificuldade, chefe, funcao)
        return funcao

    return registrar


def semente_para(*partes) -> int:
    """Semente estável a partir de aluno, missão, semana etc."""
    texto = "|".join(str(p) for p in partes)
    return int.from_bytes(hashlib.sha256(texto.encode("utf-8")).digest()[:8], "big")


def gerar(id_modelo: str, semente: int) -> MissaoGerada:
    modelo = MODELOS[id_modelo]
    missao = modelo.funcao(random.Random(semente))
    if modelo.formato == "prever" and not missao.codigo:
        missao.codigo = missao.solucao

    casos = []
    for entradas in missao.entradas:
        execucao = executar(missao.solucao, entradas)
        if not execucao.ok:
            raise ConteudoInvalido(
                f"{id_modelo} (semente {semente}): a solução de referência falhou: "
                f"{execucao.erro.original} na linha {execucao.erro.linha}"
            )
        casos.append(Caso(entradas=[str(e) for e in entradas], esperada=execucao.saida))

    return MissaoGerada(modelo.id, modelo.regiao, modelo.formato, modelo.conceitos,
                        modelo.dificuldade, modelo.chefe, semente, missao, casos)


def montar_lacunas(codigo: str, preenchimento: list[str]) -> str:
    partes = codigo.split(LACUNA)
    if len(preenchimento) != len(partes) - 1:
        raise ValueError(f"esperado {len(partes) - 1} lacunas, recebido {len(preenchimento)}")
    montado = partes[0]
    for valor, parte in zip(preenchimento, partes[1:]):
        montado += valor + parte
    return montado


def _avaliar_codigo(gerada: MissaoGerada, codigo: str) -> Resultado:
    for caso in gerada.casos:
        execucao = executar(codigo, caso.entradas)
        if not execucao.ok:
            return Resultado(False, "O programa parou com um erro.", erro=execucao.erro,
                             entradas=caso.entradas, esperada=caso.esperada,
                             obtida=execucao.saida)
        diferenca = primeira_diferenca(execucao.saida, caso.esperada, gerada.missao.opcoes)
        if diferenca:
            return Resultado(False, _mensagem_diferenca(diferenca.linha, diferenca.esperada,
                                                        diferenca.obtida, caso.entradas),
                             entradas=caso.entradas, esperada=caso.esperada,
                             obtida=execucao.saida, linha_diferente=diferenca.linha)
    return Resultado(True, "Tudo certo! O sistema respondeu como esperado.")


def _mensagem_diferenca(linha: int, esperada: str, obtida: str, entradas: list[str]) -> str:
    contexto = f"Com as entradas {', '.join(entradas)}, n" if entradas else "N"
    if not obtida:
        return f"{contexto}a linha {linha} era esperado \"{esperada}\", mas o programa não mostrou nada."
    if not esperada:
        return f"{contexto}a linha {linha} o programa mostrou \"{obtida}\", mas não era esperado mais nada."
    return f"{contexto}a linha {linha} era esperado \"{esperada}\", mas o programa mostrou \"{obtida}\"."


def avaliar(gerada: MissaoGerada, resposta) -> Resultado:
    """Avalia a resposta do aluno.

    prever: texto com a saída prevista.
    completar: lista com o conteúdo de cada lacuna, na ordem.
    detetive e programa: o código completo.
    """
    if gerada.formato == "prever":
        diferenca = primeira_diferenca(str(resposta), gerada.saida_exemplo, gerada.missao.opcoes)
        if diferenca:
            return Resultado(False, f"A linha {diferenca.linha} da sua previsão não confere. "
                                    "Releia o código linha por linha, na ordem em que o Python executa.",
                             linha_diferente=diferenca.linha)
        return Resultado(True, "Previsão certa!")

    if gerada.formato == "completar":
        try:
            codigo = montar_lacunas(gerada.missao.codigo, list(resposta))
        except ValueError:
            return Resultado(False, "Preencha todas as lacunas antes de enviar.")
        return _avaliar_codigo(gerada, codigo)

    return _avaliar_codigo(gerada, str(resposta))
