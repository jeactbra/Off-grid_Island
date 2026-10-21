"""Execução do código do aluno.

Roda o código num namespace isolado, com input() simulado e saída capturada.
O mesmo módulo roda no CPython (testes locais) e no Pyodide (navegador).
Um limite de passos e de tempo interrompe laços infinitos nos dois ambientes.
"""

import builtins
import contextlib
import io
import sys
import time
from dataclasses import dataclass, field

from ilha.erros import ErroAmigavel, traduzir

ARQUIVO_ALUNO = "<aluno>"
LIMITE_PASSOS = 500_000
LIMITE_SEGUNDOS = 3.0
MODULOS_PERMITIDOS = {"math", "random"}


class SemEntradas(Exception):
    """O programa chamou input() mais vezes do que há entradas."""


class LimiteExecucao(Exception):
    """O programa passou do limite de passos ou de tempo."""


@dataclass
class Execucao:
    saida: str
    erro: ErroAmigavel | None = None
    prompts: list[str] = field(default_factory=list)
    passos: int = 0

    @property
    def ok(self) -> bool:
        return self.erro is None


def _import_restrito(nome, *args, **kwargs):
    if nome.split(".")[0] not in MODULOS_PERMITIDOS:
        raise ImportError(f"O módulo '{nome}' não está disponível na ilha.")
    return builtins.__import__(nome, *args, **kwargs)


def _builtins_seguros(entrada):
    seguros = dict(vars(builtins))
    for nome in ("open", "exec", "eval", "compile", "breakpoint", "exit", "quit", "help"):
        seguros.pop(nome, None)
    seguros["__import__"] = _import_restrito
    seguros["input"] = entrada
    return seguros


def executar(codigo: str, entradas: list[str] | None = None) -> Execucao:
    """Executa `codigo` e devolve a saída de print() e o erro traduzido, se houver.

    Os textos passados a input() não entram na saída: ficam em `prompts`,
    para que a comparação olhe só o que o programa imprime.
    """
    fila = [str(e) for e in (entradas or [])]
    prompts: list[str] = []

    def entrada(prompt=""):
        prompts.append(str(prompt))
        if not fila:
            raise SemEntradas()
        return fila.pop(0)

    try:
        compilado = compile(codigo, ARQUIVO_ALUNO, "exec")
    except SyntaxError as exc:
        return Execucao(saida="", erro=traduzir(exc, codigo))

    passos = 0
    inicio = time.monotonic()

    def rastrear_linha(frame, evento, arg):
        nonlocal passos
        if evento == "line":
            passos += 1
            if passos > LIMITE_PASSOS or (
                passos % 1000 == 0 and time.monotonic() - inicio > LIMITE_SEGUNDOS
            ):
                raise LimiteExecucao()
        return rastrear_linha

    def rastrear(frame, evento, arg):
        if frame.f_code.co_filename == ARQUIVO_ALUNO:
            return rastrear_linha
        return None

    buffer = io.StringIO()
    namespace = {"__builtins__": _builtins_seguros(entrada), "__name__": "__main__"}
    erro = None
    rastreador_anterior = sys.gettrace()
    try:
        with contextlib.redirect_stdout(buffer):
            sys.settrace(rastrear)
            try:
                exec(compilado, namespace)
            finally:
                sys.settrace(rastreador_anterior)
    except BaseException as exc:  # o código do aluno pode levantar qualquer coisa
        if isinstance(exc, KeyboardInterrupt):
            raise
        erro = traduzir(exc, codigo)

    return Execucao(saida=buffer.getvalue(), erro=erro, prompts=prompts, passos=passos)
