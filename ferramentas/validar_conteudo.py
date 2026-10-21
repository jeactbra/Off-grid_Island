"""Valida todos os modelos de desafio antes de publicar.

Para cada modelo, gera missões com N sementes e confere que:
- a solução de referência roda sem erro e passa na própria avaliação;
- o formato está consistente (lacunas preenchíveis, código do detetive realmente falha);
- as soluções erradas típicas declaradas pelo modelo falham;
- há variedade suficiente entre as missões geradas.

Uso: python3 ferramentas/validar_conteudo.py [--sementes 500] [--modelo ID]
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "python"))

import conteudo  # noqa: E402,F401
from ilha import desafio as d  # noqa: E402

VARIEDADE_MINIMA = 10


def validar_missao(gerada: d.MissaoGerada) -> list[str]:
    problemas = []
    missao = gerada.missao
    if not missao.titulo.strip() or not missao.enunciado.strip():
        problemas.append("título ou enunciado vazio")
    if not gerada.casos or not any(c.esperada.strip() for c in gerada.casos):
        problemas.append("saída esperada vazia")

    if gerada.formato == "prever":
        if not d.avaliar(gerada, gerada.saida_exemplo).passou:
            problemas.append("a resposta certa do prever não passa")
    elif gerada.formato == "completar":
        lacunas = missao.codigo.count(d.LACUNA)
        if lacunas == 0:
            problemas.append("completar sem lacunas")
        elif len(missao.preenchimento) != lacunas:
            problemas.append(f"{lacunas} lacunas, mas {len(missao.preenchimento)} preenchimentos")
        else:
            resultado = d.avaliar(gerada, missao.preenchimento)
            if not resultado.passou:
                problemas.append(f"o preenchimento certo não passa: {resultado.mensagem}")
    else:
        resultado = d.avaliar(gerada, missao.solucao)
        if not resultado.passou:
            problemas.append(f"a solução de referência não passa: {resultado.mensagem}")
        if gerada.formato == "detetive" and d.avaliar(gerada, missao.codigo).passou:
            problemas.append("o código com defeito do detetive passa nos testes")

    for i, errada in enumerate(missao.erradas):
        if gerada.formato == "prever":
            passou = d.avaliar(gerada, errada).passou
        else:
            passou = d._avaliar_codigo(gerada, errada).passou
        if passou:
            problemas.append(f"a solução errada nº {i + 1} passa nos testes")
    return problemas


def validar_modelo(id_modelo: str, sementes: int) -> tuple[list[str], int]:
    problemas = []
    saidas = set()
    for semente in range(sementes):
        try:
            gerada = d.gerar(id_modelo, semente)
        except Exception as exc:  # qualquer falha do modelo é problema de conteúdo
            problemas.append(f"semente {semente}: {type(exc).__name__}: {exc}")
            continue
        saidas.add(gerada.saida_exemplo)
        for problema in validar_missao(gerada):
            problemas.append(f"semente {semente}: {problema}")
        if len(problemas) > 20:
            problemas.append("... muitos problemas, parando este modelo")
            break
    if len(saidas) < min(VARIEDADE_MINIMA, sementes):
        problemas.append(f"pouca variedade: só {len(saidas)} saídas diferentes em {sementes} sementes")
    return problemas, len(saidas)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--sementes", type=int, default=500)
    parser.add_argument("--modelo", help="valida só este id")
    args = parser.parse_args()

    ids = [args.modelo] if args.modelo else list(d.MODELOS)
    total_problemas = 0
    for id_modelo in ids:
        problemas, variedade = validar_modelo(id_modelo, args.sementes)
        situacao = "OK  " if not problemas else "FALHA"
        print(f"{situacao} {id_modelo:28} {variedade:4} saídas diferentes")
        for problema in problemas:
            print(f"      - {problema}")
        total_problemas += len(problemas)

    print(f"\n{len(ids)} modelos, {args.sementes} sementes cada, {total_problemas} problemas.")
    return 1 if total_problemas else 0


if __name__ == "__main__":
    sys.exit(main())
