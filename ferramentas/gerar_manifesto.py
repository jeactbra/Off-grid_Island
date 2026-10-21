"""Gera python/arquivos.json: a lista de arquivos que o navegador carrega no Pyodide.

Rodar sempre que um arquivo .py ou .toml for criado ou removido em python/.
Uso: python3 ferramentas/gerar_manifesto.py
"""

import json
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent / "python"

arquivos = sorted(
    str(p.relative_to(RAIZ)).replace("\\", "/")
    for p in RAIZ.rglob("*")
    if p.suffix in {".py", ".toml"} and "__pycache__" not in p.parts
)
(RAIZ / "arquivos.json").write_text(json.dumps(arquivos, indent=2) + "\n", encoding="utf-8")
print(f"{len(arquivos)} arquivos em python/arquivos.json")
