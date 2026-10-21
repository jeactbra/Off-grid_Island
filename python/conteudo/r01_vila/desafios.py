"""Região 1, Vila (painel de controle): print, textos, ordem de execução, vírgula e +."""

from ilha.desafio import Missao, desafio

EQUIPAMENTOS = ["Gerador G1", "Painel solar A3", "Turbina T2", "Bateria B4", "Inversor I1", "Bomba B2"]
STATUS = ["ligado", "desligado", "em teste", "religado", "em espera"]
GRANDEZAS = [  # nome, unidade, mínimo, máximo
    ("Tensão", "V", 110, 240),
    ("Potência", "kW", 5, 80),
    ("Temperatura", "°C", 20, 60),
    ("Carga", "%", 10, 100),
    ("Corrente", "A", 2, 40),
]
TECNICOS = ["Iara", "Caio", "Lia", "Davi", "Nina", "Rui"]


def _grandeza(rnd):
    nome, unidade, minimo, maximo = rnd.choice(GRANDEZAS)
    return nome, unidade, rnd.randint(minimo, maximo)


@desafio(id="vila_prever_painel", regiao="vila", formato="prever",
         conceitos=["print", "ordem", "virgula", "concatenacao"])
def prever_painel(rnd):
    equipamento = rnd.choice(EQUIPAMENTOS)
    nome, unidade, valor = _grandeza(rnd)
    status = rnd.choice(STATUS)
    separador = rnd.choice(["Status: ", "Status:"])
    linhas = [
        f'print("{equipamento}")',
        f'print("{nome}:", {valor}, "{unidade}")',
        f'print("{separador}" + "{status}")',
    ]
    rnd.shuffle(linhas)
    return Missao(
        titulo="O que o painel vai mostrar?",
        enunciado="O painel da Vila vai rodar o código abaixo. "
                  "Escreva exatamente o que vai aparecer na tela, linha por linha.",
        solucao="\n".join(linhas) + "\n",
        dicas=[
            "Cada print mostra uma linha, e o Python executa de cima para baixo.",
            'A vírgula separa valores com um espaço: print("A:", 5) mostra A: 5',
            'O + junta textos sem colocar espaço: "Status:" + "ok" vira Status:ok',
        ],
    )


@desafio(id="vila_completar_painel", regiao="vila", formato="completar",
         conceitos=["print", "aspas", "virgula"])
def completar_painel(rnd):
    equipamento = rnd.choice(EQUIPAMENTOS)
    nome, unidade, valor = _grandeza(rnd)
    status = rnd.choice(STATUS)
    codigo = (
        f'___("{equipamento}")\n'
        f'print("{nome}:", ___, "{unidade}")\n'
        f"print(___)\n"
    )
    solucao = (
        f'print("{equipamento}")\n'
        f'print("{nome}:", {valor}, "{unidade}")\n'
        f'print("Status: {status}")\n'
    )
    return Missao(
        titulo="Painel com peças faltando",
        enunciado="Complete as lacunas para o painel mostrar exatamente a saída esperada.",
        codigo=codigo,
        solucao=solucao,
        preenchimento=["print", str(valor), f'"Status: {status}"'],
        erradas=[solucao.replace(f'"Status: {status}"', f"Status: {status}")],
        dicas=[
            "Compare cada linha do código com a linha da saída esperada.",
            "A função que mostra algo na tela se chama print, toda em minúsculas.",
            'Texto precisa de aspas: print("Status: ligado"). Número não: print(220).',
        ],
    )


@desafio(id="vila_detetive_painel", regiao="vila", formato="detetive",
         conceitos=["print", "aspas", "parenteses", "maiusculas", "concatenacao"])
def detetive_painel(rnd):
    equipamento = rnd.choice(EQUIPAMENTOS)
    nome, unidade, valor = _grandeza(rnd)
    status = rnd.choice(STATUS)
    certas = [
        f'print("{equipamento}")',
        f'print("{nome}:", {valor}, "{unidade}")',
        f'print("Status: {status}")',
    ]
    erradas = list(certas)
    defeito = rnd.choice(["maiusculas", "sem_aspas", "aspas_abertas", "parenteses", "concatenacao"])
    if defeito == "maiusculas":
        erradas[0] = f'Print("{equipamento}")'
    elif defeito == "sem_aspas":
        erradas[2] = f"print(Status: {status})"
    elif defeito == "aspas_abertas":
        erradas[0] = f'print("{equipamento})'
    elif defeito == "parenteses":
        erradas[2] = f'print("Status: {status}"'
    else:
        erradas[1] = f'print("{nome}: " + {valor} + " {unidade}")'
    codigo = "\n".join(erradas) + "\n"
    return Missao(
        titulo="Detetive do painel",
        enunciado="O painel parou de funcionar. Rode o código, leia a mensagem de erro "
                  "e conserte para mostrar a saída esperada.",
        codigo=codigo,
        solucao="\n".join(certas) + "\n",
        erradas=[codigo],
        dicas=[
            "Rode o código: a mensagem de erro indica a linha do problema.",
            "Confira aspas, parênteses e letras maiúsculas na linha indicada.",
            'Para juntar texto e número no print, use vírgula: print("Tensão:", 220, "V")',
        ],
    )


@desafio(id="vila_programa_status", regiao="vila", formato="programa",
         conceitos=["print", "ordem", "virgula"])
def programa_status(rnd):
    equipamento = rnd.choice(EQUIPAMENTOS)
    nome, unidade, valor = _grandeza(rnd)
    status = rnd.choice(STATUS)
    linhas = [
        'print("=== Painel da Vila ===")',
        f'print("{equipamento}: {status}")',
        f'print("{nome}:", {valor}, "{unidade}")',
    ]
    return Missao(
        titulo="Status do gerador",
        enunciado="Escreva um programa que mostre exatamente a saída esperada, na mesma ordem.",
        codigo="# Escreva seu código aqui\n",
        solucao="\n".join(linhas) + "\n",
        erradas=[
            "\n".join([linhas[0], linhas[2], linhas[1]]) + "\n",
            "\n".join(linhas[1:]) + "\n",
        ],
        dicas=[
            "Cada linha da saída é um print.",
            "A ordem dos print no código é a ordem das linhas na tela.",
            f'Exemplo de uma linha: print("{nome}:", {valor}, "{unidade}")',
        ],
    )


@desafio(id="vila_chefe_relatorio", regiao="vila", formato="programa",
         conceitos=["print", "ordem", "virgula", "concatenacao", "linha_em_branco"],
         dificuldade=2, chefe=True)
def chefe_relatorio(rnd):
    equipamento = rnd.choice(EQUIPAMENTOS)
    nome1, unidade1, valor1 = _grandeza(rnd)
    nome2, unidade2, valor2 = _grandeza(rnd)
    while nome2 == nome1:
        nome2, unidade2, valor2 = _grandeza(rnd)
    tecnico = rnd.choice(TECNICOS)
    codigo_equipamento = f"VL-{rnd.randint(1, 99):02d}"
    linhas = [
        'print("RELATÓRIO DE RELIGAÇÃO")',
        "print()",
        f'print("Equipamento:", "{equipamento}")',
        f'print("Código: " + "{codigo_equipamento}")',
        f'print("{nome1}:", {valor1}, "{unidade1}")',
        f'print("{nome2}:", {valor2}, "{unidade2}")',
        f'print("Responsável:", "{tecnico}")',
        "print()",
        'print("Vila religada!")',
    ]
    solucao = "\n".join(linhas) + "\n"
    return Missao(
        titulo="Chefe da Vila: relatório de religação",
        enunciado="A Vila está quase religada. Escreva o programa que mostra o relatório final "
                  "exatamente como na saída esperada, incluindo as linhas em branco.",
        codigo="# Relatório de religação da Vila\n",
        solucao=solucao,
        erradas=[
            solucao.replace("print()\n", "", 1),
            "\n".join(linhas[:4] + [linhas[5], linhas[4]] + linhas[6:]) + "\n",
        ],
        dicas=[
            "Monte uma linha por vez e rode para conferir antes de seguir.",
            "Uma linha em branco na saída é um print() vazio.",
            "Use vírgula para separar texto e número; o + só junta textos.",
        ],
    )
