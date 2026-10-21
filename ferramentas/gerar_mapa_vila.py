"""Gera mapas/vila.tmj no formato do Tiled (JSON).

O mapa é gerado por código nesta fase para não depender de arte externa.
O arquivo resultante pode ser aberto e editado no Tiled normalmente.
Os números dos tiles seguem motor/texturas.ts (TILES).

Uso: python3 ferramentas/gerar_mapa_vila.py
"""

import json
import random
from pathlib import Path

LARGURA, ALTURA, TILE = 40, 30, 32

# ids (gid) do tileset gerado em motor/texturas.ts
GRAMA, GRAMA_ESCURA, FLORES, CAMINHO, AREIA, AGUA = 1, 2, 3, 4, 5, 6
ARVORE, PAREDE, TELHADO, CERCA, PEDRA, JANELA, PORTA, ARBUSTO = 7, 8, 9, 10, 11, 12, 13, 14
NUM_TILES = 14

rnd = random.Random(2026)
chao = [[GRAMA] * LARGURA for _ in range(ALTURA)]
obst = [[0] * LARGURA for _ in range(ALTURA)]
reservado = [[False] * LARGURA for _ in range(ALTURA)]


def reservar(x0, y0, x1, y1):
    for y in range(max(0, y0), min(ALTURA, y1 + 1)):
        for x in range(max(0, x0), min(LARGURA, x1 + 1)):
            reservado[y][x] = True


# variação da grama
for y in range(ALTURA):
    for x in range(LARGURA):
        sorteio = rnd.random()
        if sorteio < 0.18:
            chao[y][x] = GRAMA_ESCURA
        elif sorteio < 0.22:
            chao[y][x] = FLORES

# mar nas bordas, areia em volta
for y in range(ALTURA):
    for x in range(LARGURA):
        borda = min(x, y, LARGURA - 1 - x, ALTURA - 1 - y)
        if borda <= 1:
            chao[y][x] = AREIA
            obst[y][x] = AGUA
            reservado[y][x] = True
        elif borda == 2:
            chao[y][x] = AREIA
            reservado[y][x] = True

# caminhos: eixo leste-oeste e norte-sul
CAMINHO_Y, CAMINHO_X = 15, 20
for x in range(3, LARGURA - 2):
    for y in (CAMINHO_Y, CAMINHO_Y + 1):
        chao[y][x] = CAMINHO
        reservado[y][x] = True
for y in range(3, ALTURA - 3):
    for x in (CAMINHO_X, CAMINHO_X + 1):
        chao[y][x] = CAMINHO
        reservado[y][x] = True
# a ponte para o Campo Solar atravessa a água a leste
for x in range(LARGURA - 3, LARGURA):
    for y in (CAMINHO_Y, CAMINHO_Y + 1):
        chao[y][x] = CAMINHO
        obst[y][x] = 0


def casa(x0, y0, largura=5):
    """Telhado em 2 linhas, parede com janela e porta em 2 linhas, calçada na frente."""
    for x in range(x0, x0 + largura):
        obst[y0][x] = TELHADO
        obst[y0 + 1][x] = TELHADO
        obst[y0 + 2][x] = PAREDE
        obst[y0 + 3][x] = PAREDE
    obst[y0 + 2][x0 + 1] = JANELA
    obst[y0 + 2][x0 + largura - 2] = JANELA
    obst[y0 + 3][x0 + largura // 2] = PORTA
    for y in range(y0 + 4, CAMINHO_Y):
        chao[y][x0 + largura // 2] = CAMINHO
    reservar(x0 - 1, y0 - 1, x0 + largura, y0 + 4)
    for y in range(y0 + 4, CAMINHO_Y):
        reservado[y][x0 + largura // 2] = True


casa(5, 5)
casa(24, 5)
casa(12, 6, largura=4)

# casa ao sul, com caminho subindo até o eixo
for x in range(5, 10):
    obst[20][x] = TELHADO
    obst[21][x] = TELHADO
    obst[22][x] = PAREDE
    obst[23][x] = PAREDE
obst[22][6] = JANELA
obst[22][8] = JANELA
obst[23][7] = PORTA
for y in range(CAMINHO_Y + 2, 20):
    chao[y][7] = CAMINHO
for y in range(24, 26):
    chao[y][7] = CAMINHO
reservar(4, 17, 10, 25)

# pátio do gerador, cercado, com abertura voltada ao caminho
PATIO = (26, 18, 32, 23)
x0, y0, x1, y1 = PATIO
for x in range(x0, x1 + 1):
    obst[y1][x] = CERCA
for y in range(y0, y1 + 1):
    obst[y][x0] = CERCA
    obst[y][x1] = CERCA
for x in range(x0 + 1, x1):
    chao[y0][x] = CAMINHO
    for y in range(y0 + 1, y1):
        chao[y][x] = AREIA
for y in range(CAMINHO_Y + 2, y0):
    chao[y][29] = CAMINHO
    reservado[y][29] = True
reservar(x0 - 1, y0 - 1, x1 + 1, y1 + 1)

# postes ao longo do caminho principal (fora das calçadas das casas)
POSTES = [5, 10, 18, 23, 28, 34]
for x in POSTES:
    reservar(x, 13, x, 14)
reservar(19, 21, 19, 22)

# área livre perto do início, do quadro e da técnica
reservar(6, 13, 10, 18)
reservar(15, 12, 19, 14)
reservar(22, 13, 26, 17)

# árvores, arbustos e pedras nos espaços livres
for y in range(3, ALTURA - 3):
    for x in range(3, LARGURA - 3):
        if reservado[y][x] or obst[y][x]:
            continue
        sorteio = rnd.random()
        if sorteio < 0.10:
            obst[y][x] = ARVORE
        elif sorteio < 0.13:
            obst[y][x] = ARBUSTO
        elif sorteio < 0.14:
            obst[y][x] = PEDRA


def objeto(id_, nome, tipo, tx, ty, **props):
    return {
        "id": id_, "name": nome, "type": tipo, "x": tx * TILE + TILE / 2, "y": ty * TILE + TILE / 2,
        "width": 0, "height": 0, "point": True, "rotation": 0, "visible": True,
        "properties": [{"name": k, "type": "string", "value": v} for k, v in props.items()],
    }


objetos = [
    objeto(1, "jogador", "inicio", 8, 15),
    objeto(2, "lia", "npc", 24, 14, rotulo="Lia", funcao="Técnica da Vila"),
    objeto(3, "gerador_g1", "gerador", 29, 20, missao="vila_programa_status"),
    objeto(4, "quadro_avisos", "quadro", 17, 13),
    objeto(5, "portao_campo_solar", "portao", 37, 15, destino="Campo Solar"),
]
for i, x in enumerate(POSTES):
    objetos.append(objeto(10 + i, f"poste_{i + 1}", "poste", x, 14))
objetos.append(objeto(20, "poste_sul", "poste", 19, 22))


def camada(id_, nome, dados):
    return {
        "id": id_, "name": nome, "type": "tilelayer", "width": LARGURA, "height": ALTURA,
        "x": 0, "y": 0, "opacity": 1, "visible": True,
        "data": [v for linha in dados for v in linha],
    }


mapa = {
    "type": "map", "version": "1.10", "tiledversion": "1.10.2", "orientation": "orthogonal",
    "renderorder": "right-down", "infinite": False,
    "width": LARGURA, "height": ALTURA, "tilewidth": TILE, "tileheight": TILE,
    "nextlayerid": 4, "nextobjectid": 21,
    "properties": [
        {"name": "regiao", "type": "string", "value": "vila"},
        {"name": "nome", "type": "string", "value": "Vila"},
    ],
    "tilesets": [{
        "firstgid": 1, "name": "vila", "tilewidth": TILE, "tileheight": TILE,
        "tilecount": NUM_TILES, "columns": NUM_TILES, "margin": 0, "spacing": 0,
        "image": "vila.png", "imagewidth": TILE * NUM_TILES, "imageheight": TILE,
    }],
    "layers": [
        camada(1, "chao", chao),
        camada(2, "obstaculos", obst),
        {"id": 3, "name": "objetos", "type": "objectgroup", "x": 0, "y": 0, "opacity": 1,
         "visible": True, "draworder": "topdown", "objects": objetos},
    ],
}

destino = Path(__file__).resolve().parent.parent / "mapas" / "vila.tmj"
destino.parent.mkdir(exist_ok=True)
destino.write_text(json.dumps(mapa, ensure_ascii=False), encoding="utf-8")
print(f"mapa salvo em {destino.relative_to(destino.parent.parent)} ({LARGURA}x{ALTURA} tiles)")
