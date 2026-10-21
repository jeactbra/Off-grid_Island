"""Tradução das mensagens de erro do Python para explicações em português.

Cada tradução diz o que aconteceu, onde, e o que conferir, sem julgar.
O campo `conceito` aponta o conceito a revisar, usado pelas dicas.
"""

import re
import traceback
from dataclasses import dataclass

ARQUIVO_ALUNO = "<aluno>"


@dataclass
class ErroAmigavel:
    tipo: str
    linha: int | None
    mensagem: str
    dica: str
    conceito: str
    original: str

    def para_dict(self) -> dict:
        return {
            "tipo": self.tipo,
            "linha": self.linha,
            "mensagem": self.mensagem,
            "dica": self.dica,
            "conceito": self.conceito,
            "original": self.original,
        }


def _linha_do_aluno(exc: BaseException) -> int | None:
    if isinstance(exc, SyntaxError):
        return exc.lineno
    linha = None
    for quadro in traceback.extract_tb(exc.__traceback__):
        if quadro.filename == ARQUIVO_ALUNO:
            linha = quadro.lineno
    return linha


def _trecho(codigo: str, linha: int | None) -> str:
    if not linha:
        return ""
    linhas = codigo.splitlines()
    if 1 <= linha <= len(linhas):
        return linhas[linha - 1]
    return ""


def _sintaxe(msg: str, trecho: str) -> tuple[str, str, str]:
    if "unterminated string literal" in msg or "unterminated triple-quoted" in msg:
        return ("Um texto foi aberto com aspas, mas não foi fechado.",
                "Todo texto começa e termina com aspas do mesmo tipo: \"assim\" ou 'assim'.",
                "aspas")
    if "invalid character" in msg and ("“" in msg or "”" in msg or "‘" in msg or "’" in msg):
        return ("Há aspas tortas (“ ” ou ‘ ’), comuns quando o texto é copiado de outro lugar.",
                "Apague essas aspas e digite de novo usando a tecla de aspas do teclado.",
                "aspas")
    if "was never closed" in msg:
        return ("Um parêntese, colchete ou chave foi aberto e não foi fechado.",
                "Conte os ( e os ) da linha: precisam ser iguais em número.",
                "parenteses")
    if "unmatched" in msg or "does not match opening parenthesis" in msg:
        return ("Há um parêntese, colchete ou chave fechando sem ter sido aberto.",
                "Confira se cada ) tem o seu ( correspondente.",
                "parenteses")
    if "Missing parentheses in call to 'print'" in msg:
        return ("O print precisa de parênteses em volta do que será mostrado.",
                "Escreva print(\"texto\") em vez de print \"texto\".",
                "print")
    if "expected ':'" in msg:
        return ("Faltam os dois-pontos (:) no fim da linha.",
                "Linhas com if, elif, else, for e while terminam com :",
                "dois_pontos")
    if "Perhaps you forgot a comma" in msg:
        return ("O Python encontrou palavras soltas onde esperava um valor ou uma vírgula.",
                "Se for um texto, coloque entre aspas. Se forem vários valores, separe com vírgula.",
                "aspas")
    if "cannot assign to" in msg:
        return ("Do lado esquerdo do = precisa haver um nome de variável.",
                "Escreva nome = valor, com o nome sempre à esquerda.",
                "variaveis")
    if "invalid decimal literal" in msg:
        return ("Um nome começa com número ou um número está grudado em letras.",
                "Nomes de variáveis não podem começar com número. Números decimais usam ponto: 3.5.",
                "variaveis")
    return ("O Python não conseguiu entender esta linha.",
            "Confira aspas, parênteses, vírgulas e dois-pontos.",
            "sintaxe")


def _indentacao(msg: str) -> tuple[str, str, str]:
    if "expected an indented block" in msg:
        return ("Depois de uma linha que termina com :, o bloco de baixo precisa estar recuado.",
                "Recue as linhas de dentro do bloco com 4 espaços (ou Tab).",
                "indentacao")
    if "unexpected indent" in msg:
        return ("Esta linha está recuada sem motivo.",
                "Só recue linhas que estão dentro de um if, for, while ou similar.",
                "indentacao")
    return ("O recuo desta linha não combina com o das linhas de cima.",
            "Use sempre o mesmo recuo (4 espaços) para linhas do mesmo bloco.",
            "indentacao")


def _nome(msg: str, trecho: str) -> tuple[str, str, str]:
    achado = re.search(r"name '(\w+)' is not defined", msg)
    nome = achado.group(1) if achado else "?"
    if nome.lower() in {"print", "input", "int", "float", "str", "len", "range"} and nome != nome.lower():
        return (f"`{nome}` não existe: funções do Python são escritas em minúsculas.",
                f"Troque `{nome}` por `{nome.lower()}`.",
                "maiusculas")
    if f"{nome}" in trecho and (f"({nome}" in trecho or f" {nome} " in f" {trecho} "):
        dica = (f"Se `{nome}` era para ser um texto, coloque entre aspas: \"{nome}\". "
                "Se é uma variável, confira se ela foi criada antes desta linha, com o mesmo nome.")
    else:
        dica = "Confira se a variável foi criada antes desta linha e se o nome está igual, letra por letra."
    return (f"O nome `{nome}` foi usado, mas não existe.", dica, "variaveis")


def _tipo(msg: str) -> tuple[str, str, str]:
    if "can only concatenate str" in msg or ("unsupported operand type(s) for +" in msg and "str" in msg):
        return ("O + tentou juntar texto com número, e o Python não mistura os dois.",
                "No print, separe com vírgula: print(\"Total:\", 10). Ou converta: \"Total: \" + str(10).",
                "concatenacao")
    if "unsupported operand type" in msg:
        return ("A operação foi feita entre tipos que não combinam (por exemplo, texto e número).",
                "Confira se os valores lidos com input() foram convertidos com int() ou float().",
                "tipos")
    if "object is not callable" in msg:
        return ("Algo que não é função foi usado com parênteses, como se fosse uma.",
                "Confira se você não criou uma variável com o nome de uma função (por exemplo, print = ...).",
                "funcoes")
    if "not supported between instances" in msg:
        return ("A comparação foi feita entre texto e número.",
                "Converta o valor lido com int() ou float() antes de comparar.",
                "tipos")
    return ("Um valor foi usado de um jeito que o tipo dele não permite.",
            "Confira o tipo de cada valor da linha com type().",
            "tipos")


def _valor(msg: str) -> tuple[str, str, str]:
    if "invalid literal for int()" in msg or "could not convert string to float" in msg:
        return ("Um texto que não é número foi convertido com int() ou float().",
                "Confira o valor digitado e se int() é o certo (números com ponto pedem float()).",
                "tipos")
    return ("Um valor recebido não é aceito por esta operação.",
            "Confira o valor que chega nesta linha.",
            "tipos")


def traduzir(exc: BaseException, codigo: str) -> ErroAmigavel:
    tipo = type(exc).__name__
    linha = _linha_do_aluno(exc)
    trecho = _trecho(codigo, linha)
    msg = str(exc.msg if isinstance(exc, SyntaxError) else exc)

    if tipo in ("IndentationError", "TabError"):
        mensagem, dica, conceito = _indentacao(msg)
    elif isinstance(exc, SyntaxError):
        mensagem, dica, conceito = _sintaxe(msg, trecho)
    elif tipo == "NameError":
        mensagem, dica, conceito = _nome(msg, trecho)
    elif tipo == "TypeError":
        mensagem, dica, conceito = _tipo(msg)
    elif tipo == "ValueError":
        mensagem, dica, conceito = _valor(msg)
    elif tipo == "ZeroDivisionError":
        mensagem, dica, conceito = ("Houve uma divisão por zero.",
                                    "Confira o divisor antes de dividir, por exemplo com um if.",
                                    "operadores")
    elif tipo == "IndexError":
        mensagem, dica, conceito = ("Foi usada uma posição que não existe.",
                                    "As posições começam em 0 e vão até len(...) - 1.",
                                    "indices")
    elif tipo == "KeyError":
        mensagem, dica, conceito = (f"A chave {msg} não existe no dicionário.",
                                    "Confira o nome da chave, letra por letra, ou use .get().",
                                    "dicionarios")
    elif tipo == "SemEntradas":
        mensagem, dica, conceito = ("O programa pediu mais entradas com input() do que a missão fornece.",
                                    "Confira quantas vezes o input() é chamado; o enunciado diz quantas entradas existem.",
                                    "input")
        msg = "input() chamado sem entradas restantes"
    elif tipo == "LimiteExecucao":
        mensagem, dica, conceito = ("O programa não terminou: provavelmente está num laço infinito.",
                                    "Confira se a condição do while muda dentro do laço até ficar falsa.",
                                    "lacos")
        msg = "limite de execução atingido"
    elif tipo == "ImportError" or tipo == "ModuleNotFoundError":
        mensagem, dica, conceito = (msg, "Nesta missão não é preciso importar módulos.", "modulos")
    else:
        mensagem, dica, conceito = (f"O Python encontrou um erro do tipo {tipo}.",
                                    "Leia a mensagem original abaixo e confira a linha indicada.",
                                    "geral")

    original = f"{tipo}: {msg}" if msg else tipo
    return ErroAmigavel(tipo=tipo, linha=linha, mensagem=mensagem, dica=dica,
                        conceito=conceito, original=original)
