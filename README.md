# Ilha Off-Grid

Jogo web 2D para praticar Python, feito para calouros de Engenharia de Energias Renováveis.
O design completo está em `../docs/Ilha_Off-Grid_Documento_de_Design.md`.

## Estado atual: Fase 1 (executor e formato de conteúdo)

| Pasta | O que tem |
| --- | --- |
| `python/ilha/` | Núcleo em Python: execução segura do código do aluno, tradução de erros, comparação de saídas, base dos desafios |
| `python/conteudo/` | Uma subpasta por região, com os modelos de desafio (`desafios.py`) e os metadados (`regiao.toml`) |
| `executor/` | Web Worker que roda o núcleo Python no navegador com Pyodide, e o cliente JS |
| `laboratorio/` | Página de teste: gerar missão, rodar, enviar, pedir dica |
| `ferramentas/` | Validação dos modelos e geração do manifesto de arquivos |
| `testes/` | Testes automáticos (unittest, sem dependências) |

## Como usar

Rodar os testes:

```bash
python3 -m unittest discover -s testes -t .
```

Validar o conteúdo (cada modelo com 500 sementes):

```bash
python3 ferramentas/validar_conteudo.py
```

Abrir o laboratório no navegador:

```bash
python3 -m http.server 8000 --directory /caminho/para/ilha-off-grid
# depois abra http://localhost:8000
```

O primeiro carregamento baixa o Pyodide (cerca de 10 MB) e pode levar alguns segundos.

## Como criar uma missão nova

1. Escreva uma função em `python/conteudo/<regiao>/desafios.py` com o decorador `@desafio`.
2. Ela recebe `rnd` (um `random.Random`) e devolve uma `Missao` com `titulo`, `enunciado`,
   `solucao` e, conforme o formato, `codigo`, `entradas`, `preenchimento`, `erradas` e `dicas`.
3. A saída esperada não é escrita à mão: o jogo roda a `solucao` com cada lista de `entradas`.
4. Rode `python3 ferramentas/validar_conteudo.py`.
5. Se criou ou removeu arquivos, rode `python3 ferramentas/gerar_manifesto.py`.

Formatos: `prever` (aluno escreve a saída), `completar` (lacunas `___`), `detetive`
(código com defeito para consertar) e `programa` (programa completo).

## Autoria dos commits

Todos os commits deste repositório usam a autoria:

```
jeactbra <jean.constant@hotmail.com>
```

O repositório já está configurado assim (`git config user.name` / `user.email` locais).
Confira antes de commitar em uma máquina nova.
