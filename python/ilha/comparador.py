"""Comparação tolerante entre a saída do aluno e a saída esperada.

Ignora espaços sobrando, linhas em branco no fim e, por padrão, acentos.
Números são comparados por valor (35 == 35.0) com tolerância para decimais.
"""

import math
import re
import unicodedata
from dataclasses import dataclass

_NUMERO = re.compile(r"-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?")


@dataclass
class Diferenca:
    linha: int  # 1-based
    esperada: str
    obtida: str


@dataclass
class OpcoesComparacao:
    ignorar_maiusculas: bool = False
    ignorar_acentos: bool = True
    tolerancia_relativa: float = 1e-6
    tolerancia_absoluta: float = 1e-9


def _sem_acentos(texto: str) -> str:
    decomposto = unicodedata.normalize("NFD", texto)
    return "".join(c for c in decomposto if unicodedata.category(c) != "Mn")


def _normalizar_linha(linha: str, opcoes: OpcoesComparacao) -> str:
    linha = " ".join(linha.split())
    if opcoes.ignorar_acentos:
        linha = _sem_acentos(linha)
    if opcoes.ignorar_maiusculas:
        linha = linha.lower()
    return linha


def _linhas(texto: str, opcoes: OpcoesComparacao) -> list[str]:
    linhas = [_normalizar_linha(l, opcoes) for l in texto.replace("\r\n", "\n").split("\n")]
    while linhas and linhas[-1] == "":
        linhas.pop()
    while linhas and linhas[0] == "":
        linhas.pop(0)
    return linhas


def _linhas_iguais(a: str, b: str, opcoes: OpcoesComparacao) -> bool:
    if a == b:
        return True
    if _NUMERO.sub("#", a) != _NUMERO.sub("#", b):
        return False
    numeros_a = [float(n) for n in _NUMERO.findall(a)]
    numeros_b = [float(n) for n in _NUMERO.findall(b)]
    return all(
        math.isclose(x, y, rel_tol=opcoes.tolerancia_relativa, abs_tol=opcoes.tolerancia_absoluta)
        for x, y in zip(numeros_a, numeros_b)
    )


def primeira_diferenca(obtida: str, esperada: str,
                       opcoes: OpcoesComparacao | None = None) -> Diferenca | None:
    """Devolve a primeira linha diferente, ou None se as saídas forem equivalentes."""
    opcoes = opcoes or OpcoesComparacao()
    linhas_obtidas = _linhas(obtida, opcoes)
    linhas_esperadas = _linhas(esperada, opcoes)
    originais_obtidas = [l.strip() for l in obtida.strip("\n").split("\n")]
    originais_esperadas = [l.strip() for l in esperada.strip("\n").split("\n")]

    for i in range(max(len(linhas_obtidas), len(linhas_esperadas))):
        a = linhas_obtidas[i] if i < len(linhas_obtidas) else None
        b = linhas_esperadas[i] if i < len(linhas_esperadas) else None
        if a is None or b is None or not _linhas_iguais(a, b, opcoes):
            return Diferenca(
                linha=i + 1,
                esperada=originais_esperadas[i] if i < len(originais_esperadas) else "",
                obtida=originais_obtidas[i] if i < len(originais_obtidas) else "",
            )
    return None


def equivalentes(obtida: str, esperada: str, opcoes: OpcoesComparacao | None = None) -> bool:
    return primeira_diferenca(obtida, esperada, opcoes) is None
