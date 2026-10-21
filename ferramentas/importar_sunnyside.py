"""Importa o pacote de arte Sunnyside World para o jogo.

Lê o projeto GameMaker que vem no pacote (a cena de exemplo e os tilesets) e gera:
- arte/sunnyside/: tilesets, sprites decorativos em tiras, personagens montados
  (corpo + cabelo + ferramentas) e sprites.json com tamanhos, origens e velocidades;
- mapas/vila.tmj: o mapa no formato do Tiled, com as camadas da cena, as animações
  de tiles, uma camada de colisão e os objetos do jogo (mapas/vila_jogo.json).

Arte: Sunnyside World, de Daniel Diggle (https://danieldiggle.itch.io/sunnyside).
A licença permite uso em projetos e redistribuição em cursos com o link acima.

Uso:
  python3 ferramentas/importar_sunnyside.py CAMINHO_DO_PACOTE [--previa ARQUIVO.png]
CAMINHO_DO_PACOTE é a pasta Sunnyside_World_ASSET_PACK_V2.1 (descompactada) ou o .zip.
"""

import argparse
import json
import re
import shutil
import sys
import tempfile
import zipfile
from pathlib import Path

from PIL import Image, ImageDraw

RAIZ = Path(__file__).resolve().parent.parent
DESTINO_ARTE = RAIZ / "arte" / "sunnyside"
DESTINO_MAPA = RAIZ / "mapas" / "vila.tmj"
OBJETOS_JOGO = RAIZ / "mapas" / "vila_jogo.json"
AJUSTES = RAIZ / "mapas" / "vila_ajustes.json"   # pontes e escadas acrescentadas para ligar as áreas

T = 16                      # tamanho do tile no mapa
VAZIO = -2147483648         # célula vazia no formato do GameMaker
FLAG_H, FLAG_V, FLAG_D = 0x80000000, 0x40000000, 0x20000000

# camadas de tiles, de baixo para cima; as duas últimas ficam acima do jogador
CAMADAS = ["sea", "clouds_02", "land", "paths", "shadows", "decoration_01", "forest",
           "building", "walls", "decoration_02", "decoration_03", "cloud_shadow", "clouds_01"]
ACIMA_DO_JOGADOR = {"cloud_shadow", "clouds_01"}

# --- regras de passagem (ver docs: tiles conferidos visualmente) ---
TERRA_BLOQUEIA = {
    101, 147, 148, 149, 150, 151, 200, 202, 203, 211, 212, 215, 260, 262, 263, 264, 266, 267,
    268, 332, 339, 340, 341, 394, 396, 403, 405, 414, 416, 418, 470, 471, 472, 474, 478, 534,
    542, 543, 544, 545, 859,
}
PRANCHAS = {205, 206, 207, 334, 336, 357, 358, 360, 397, 398, 399, 400, 424, 650, 743, 744,
            745, 808, 810, 871, 872, 142, 143}
ESCADAS = {746, 810, 874}   # escada de mão (topo, meio, base): sempre liberam a passagem
CAMINHO_BLOQUEIA = {135, 136, 137, 138, 139, 140}   # entradas de caverna


DECORACAO_PASSA = {495, 496, 560, 561, 498}   # trilhos de mina e cogumelos


def cobertura(imagem: Image.Image, indice: int, colunas: int) -> float:
    """Fração de pixels opacos de um tile de 16 px."""
    x, y = (indice % colunas) * T, (indice // colunas) * T
    alfa = imagem.crop((x, y, x + T, y + T)).getchannel("A").getdata()
    return sum(1 for a in alfa if a > 128) / (T * T)


def decoracao_bloqueia(tileset: Image.Image, indice: int) -> bool:
    """Cercas, muros, poços e árvores ficam nas colunas 36-63, linhas 0-8 do tileset;
    peças quase transparentes (bordas de copa, flores) não bloqueiam."""
    linha, coluna = divmod(indice, 64)
    if indice in DECORACAO_PASSA or not (linha <= 8 and coluna >= 36):
        return False
    return cobertura(tileset, indice, 64) >= 0.2


# sprites da cena que são personagens: saem do mapa (viram moradores de verdade no jogo)
PERSONAGENS_DA_CENA = re.compile(
    r"^(spr_(idle|carry|doing|swimming|attack|jump|roll|mining|watering|dig|axe|run|reeling|walk|"
    r"hurt|death|caught|waiting|casting|hamering|hammering|walking)|skeleton_.*|goblin_.*|expression_.*|happiness_.*)$")
# sprites decorativos que bloqueiam a passagem (pela base)
SOLIDOS = re.compile(r"(tree|rock|windmill|well|barrel|crate|chest|minecart|trough|statue|"
                     r"coracle_land|sign|stump|anvil|furnace|ore_)")

CABELOS = ["shorthair", "bowlhair", "curlyhair", "longhair", "mophair", "spikeyhair"]
ACOES = {  # pasta do pacote -> nome curto
    "IDLE": "idle", "WALKING": "walk", "RUN": "run", "WATERING": "watering",
    "HAMMERING": "hammering", "DOING": "doing", "CARRY": "carry", "CASTING": "casting",
    "WAITING": "waiting", "MINING": "mining", "AXE": "axe", "DIG": "dig", "REELING": "reeling",
}
FPS_PERSONAGEM = {"idle": 8, "walk": 10, "run": 12}


def carregar_yy(caminho: Path) -> dict:
    texto = caminho.read_text(encoding="utf-8")
    return json.loads(re.sub(r",(\s*[}\]])", r"\1", texto))


def decodificar(dados_tiles: dict) -> list[int]:
    if "TileSerialiseData" in dados_tiles:
        return dados_tiles["TileSerialiseData"]
    comprimido, saida, i = dados_tiles["TileCompressedData"], [], 0
    while i < len(comprimido):
        n = comprimido[i]
        if n < 0:
            saida += [comprimido[i + 1]] * (-n)
            i += 2
        else:
            saida += comprimido[i + 1:i + 1 + n]
            i += 1 + n
    return saida


def separar(valor: int) -> tuple[int, int, int, int]:
    """Índice e flags (espelho, inversão, rotação) de um tile do GameMaker."""
    if valor in (VAZIO, 0):
        return 0, 0, 0, 0
    valor &= 0xFFFFFFFF
    return valor & 0x7FFFF, (valor >> 28) & 1, (valor >> 29) & 1, (valor >> 30) & 1


def gid_tiled(indice: int, primeiro: int, espelho: int, inverte: int, roda: int) -> int:
    """GameMaker gira 90° e depois espelha/inverte; no Tiled: D=rotação, H=rotação^espelho, V=inversão."""
    if indice == 0:
        return 0
    gid = indice + primeiro
    if roda:
        gid |= FLAG_D
    if roda ^ espelho:
        gid |= FLAG_H
    if inverte:
        gid |= FLAG_V
    return gid


def localizar_pacote(caminho: Path, temporario: Path) -> Path:
    if caminho.suffix == ".zip":
        with zipfile.ZipFile(caminho) as z:
            z.extractall(temporario)
        caminho = temporario
    candidatos = list(caminho.rglob("Sunnyside_World_Gamemaker"))
    if not candidatos:
        sys.exit(f"Projeto GameMaker não encontrado em {caminho}")
    return candidatos[0].parent


def exportar_sprite(gm: Path, nome: str, destino: Path) -> dict | None:
    pasta = gm / "sprites" / nome
    yy = pasta / f"{nome}.yy"
    if not yy.exists():
        return None
    dados = carregar_yy(yy)
    quadros = [Image.open(pasta / f"{q['name']}.png").convert("RGBA") for q in dados["frames"]]
    w, h = dados["width"], dados["height"]
    tira = Image.new("RGBA", (w * len(quadros), h))
    for i, q in enumerate(quadros):
        tira.paste(q, (i * w, 0))
    tira.save(destino / f"{nome}.png", optimize=True)
    seq = dados["sequence"]
    fps = seq["playbackSpeed"] if seq["playbackSpeedType"] == 0 else seq["playbackSpeed"] * 60
    return {"arquivo": f"sprites/{nome}.png", "w": w, "h": h, "ox": seq["xorigin"], "oy": seq["yorigin"],
            "quadros": len(quadros), "fps": fps,
            "base": [dados["bbox_left"], dados["bbox_right"], dados["bbox_bottom"]]}


def exportar_personagens(assets: Path, destino: Path) -> dict:
    humano = assets / "Characters" / "Human"
    manifesto = {}
    for pasta, acao in ACOES.items():
        arquivos = list((humano / pasta).glob("base_*_strip*.png"))
        if not arquivos:
            continue
        sufixo = arquivos[0].name[len("base"):]          # _idle_strip9.png
        n = int(re.search(r"strip(\d+)", sufixo).group(1))
        base = Image.open(humano / pasta / f"base{sufixo}").convert("RGBA")
        ferramentas = humano / pasta / f"tools{sufixo}"
        for cabelo in CABELOS:
            img = base.copy()
            arquivo_cabelo = humano / pasta / f"{cabelo}{sufixo}"
            if arquivo_cabelo.exists():
                img.alpha_composite(Image.open(arquivo_cabelo).convert("RGBA"))
            if ferramentas.exists():
                img.alpha_composite(Image.open(ferramentas).convert("RGBA"))
            img.save(destino / f"{cabelo}_{acao}.png", optimize=True)
            manifesto[f"{cabelo}_{acao}"] = {"arquivo": f"personagens/{cabelo}_{acao}.png",
                                             "w": img.width // n, "h": img.height, "quadros": n,
                                             "fps": FPS_PERSONAGEM.get(acao, 10)}
    # origem nos pés, calculada a partir do primeiro quadro parado
    parado = Image.open(destino / "shorthair_idle.png").crop((0, 0, 96, 64))
    _, _, _, fundo = parado.getbbox()
    for item in manifesto.values():
        item["ox"], item["oy"] = 48, fundo - 1
    return manifesto


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("pacote", type=Path)
    parser.add_argument("--previa", type=Path, help="salva uma imagem do mapa com a colisão marcada")
    args = parser.parse_args()

    with tempfile.TemporaryDirectory() as tmp:
        raiz_pacote = localizar_pacote(args.pacote.resolve(), Path(tmp))
        gm = raiz_pacote / "Sunnyside_World_Gamemaker"
        assets = raiz_pacote / "Sunnyside_World_Assets"
        sala = carregar_yy(gm / "rooms" / "Room1" / "Room1.yy")
        tileset_gm = carregar_yy(gm / "tilesets" / "tileset_sunnysideworld" / "tileset_sunnysideworld.yy")

        if DESTINO_ARTE.exists():
            shutil.rmtree(DESTINO_ARTE)
        (DESTINO_ARTE / "sprites").mkdir(parents=True)
        (DESTINO_ARTE / "personagens").mkdir()
        shutil.copy(assets / "Tileset" / "spr_tileset_sunnysideworld_16px.png", DESTINO_ARTE / "tileset_16.png")
        shutil.copy(assets / "Tileset" / "spr_tileset_sunnysideworld_forest_32px.png", DESTINO_ARTE / "floresta.png")
        Image.new("RGBA", (T, T), (255, 40, 40, 110)).save(DESTINO_ARTE / "colisao.png")

        camadas_gm = {c["name"]: c for c in sala["layers"]}
        largura = camadas_gm["land"]["tiles"]["SerialiseWidth"]
        altura = camadas_gm["land"]["tiles"]["SerialiseHeight"]
        n_celulas = largura * altura
        PRIMEIRO_FLORESTA = 1 + 4096
        PRIMEIRO_COLISAO = PRIMEIRO_FLORESTA + 20 * 36

        brutos = {}
        for nome in CAMADAS:
            brutos[nome] = [separar(v) for v in decodificar(camadas_gm[nome]["tiles"])]

        # floresta: tiles de 32 px viram 4 tiles de 16 px (imagem lida como 20 colunas de 16 px)
        floresta = [(0, 0, 0, 0)] * n_celulas
        largura_f = camadas_gm["forest"]["tiles"]["SerialiseWidth"]
        for k, (indice, esp, inv, rod) in enumerate(brutos["forest"]):
            if not indice:
                continue
            fx, fy = k % largura_f, k // largura_f
            cx, cy = indice % 10, indice // 10
            for dy in (0, 1):
                for dx in (0, 1):
                    sx, sy = dx, dy
                    if rod:
                        sx, sy = sy, 1 - sx
                    if esp:
                        sx = 1 - sx
                    if inv:
                        sy = 1 - sy
                    alvo = (2 * fy + sy) * largura + 2 * fx + sx
                    floresta[alvo] = ((2 * cy + dy) * 20 + 2 * cx + dx, esp, inv, rod)
        brutos["forest"] = floresta

        ajustes = json.loads(AJUSTES.read_text(encoding="utf-8")) if AJUSTES.exists() else {}
        for t in ajustes.get("tiles", []):
            brutos[t["camada"]][t["y"] * largura + t["x"]] = (t["tile"], 0, 0, 0)

        # colisão
        imagem_ts = Image.open(DESTINO_ARTE / "tileset_16.png").convert("RGBA")
        imagem_fl = Image.open(DESTINO_ARTE / "floresta.png").convert("RGBA")
        colisao = [0] * n_celulas
        for k in range(n_celulas):
            terra = brutos["land"][k][0]
            caminho = brutos["paths"][k][0]
            bloqueia = terra == 0 or terra in TERRA_BLOQUEIA
            if caminho in PRANCHAS:
                bloqueia = False
            if caminho in CAMINHO_BLOQUEIA:
                bloqueia = True
            if brutos["building"][k][0] or brutos["walls"][k][0]:
                bloqueia = True
            if brutos["forest"][k][0] and cobertura(imagem_fl, brutos["forest"][k][0], 20) >= 0.5:
                bloqueia = True
            for deco in ("decoration_01", "decoration_02", "decoration_03"):
                if brutos[deco][k][0] and decoracao_bloqueia(imagem_ts, brutos[deco][k][0]):
                    bloqueia = True
            if any(brutos[c][k][0] in ESCADAS for c in ("paths", "decoration_01", "decoration_02", "decoration_03")):
                bloqueia = False
            colisao[k] = PRIMEIRO_COLISAO if bloqueia else 0
        for x, y in ajustes.get("livre", []):
            colisao[y * largura + x] = 0
        for x, y in ajustes.get("bloqueado", []):
            colisao[y * largura + x] = PRIMEIRO_COLISAO

        camadas_tiled = []
        for i, nome in enumerate(CAMADAS):
            primeiro = PRIMEIRO_FLORESTA if nome == "forest" else 1
            dados = [gid_tiled(ind, primeiro, e, v, r) for ind, e, v, r in brutos[nome]]
            camadas_tiled.append({
                "id": i + 1, "name": nome, "type": "tilelayer", "width": largura, "height": altura,
                "x": 0, "y": 0, "opacity": 1, "visible": True, "data": dados,
                "properties": [{"name": "acima", "type": "bool", "value": nome in ACIMA_DO_JOGADOR}],
            })
        camadas_tiled.append({"id": len(CAMADAS) + 1, "name": "colisao", "type": "tilelayer",
                              "width": largura, "height": altura, "x": 0, "y": 0, "opacity": 0.5,
                              "visible": False, "data": colisao})

        # sprites decorativos da cena (sem os personagens, que viram moradores no jogo)
        posicoes_removidas = []
        decoracao, usados = [], set()
        for nome_camada, profundidade in (("Assets_2", "fundo"), ("Assets_1", "ordenado")):
            for a in camadas_gm[nome_camada]["assets"]:
                nome = a["spriteId"]["name"]
                if PERSONAGENS_DA_CENA.match(nome):
                    posicoes_removidas.append((a["x"], a["y"]))
                    continue
                decoracao.append((a, nome, profundidade))
        objetos_deco = []
        for a, nome, profundidade in decoracao:
            if nome == "spr_deco_charactershadow" and any(
                    abs(a["x"] - x) < 14 and abs(a["y"] - y) < 14 for x, y in posicoes_removidas):
                continue
            usados.add(nome)
            objetos_deco.append({
                "id": 1000 + len(objetos_deco), "name": nome, "type": "sprite", "x": a["x"], "y": a["y"],
                "width": 0, "height": 0, "point": True, "rotation": 0, "visible": True,
                "properties": [
                    {"name": "quadro", "type": "int", "value": int(a["headPosition"])},
                    {"name": "escala_x", "type": "float", "value": a["scaleX"]},
                    {"name": "escala_y", "type": "float", "value": a["scaleY"]},
                    {"name": "velocidade", "type": "float", "value": a["animationSpeed"]},
                    {"name": "profundidade", "type": "string", "value": profundidade},
                    {"name": "solido", "type": "bool", "value": bool(SOLIDOS.search(nome))},
                ],
            })

        manifesto = {"sprites": {}, "personagens": {}, "animacoes_tiles": {}}
        for nome in sorted(usados):
            item = exportar_sprite(gm, nome, DESTINO_ARTE / "sprites")
            if item:
                manifesto["sprites"][nome] = item
        manifesto["personagens"] = exportar_personagens(assets, DESTINO_ARTE / "personagens")

        fps_tiles = tileset_gm.get("tileAnimationSpeed", 5)
        animacoes_tiled = []
        for anim in tileset_gm["tileAnimationFrames"]:
            quadros = anim["frames"]
            manifesto["animacoes_tiles"][str(quadros[0])] = {"quadros": quadros, "fps": fps_tiles}
            animacoes_tiled.append({"id": quadros[0], "animation": [
                {"tileid": q, "duration": int(1000 / fps_tiles)} for q in quadros]})
        (DESTINO_ARTE / "sprites.json").write_text(json.dumps(manifesto, indent=1), encoding="utf-8")

        objetos_jogo = json.loads(OBJETOS_JOGO.read_text(encoding="utf-8")) if OBJETOS_JOGO.exists() else []
        for i, o in enumerate(objetos_jogo):
            o.setdefault("id", 5000 + i)
            o.setdefault("width", 0)
            o.setdefault("height", 0)
            o.setdefault("point", True)
            o.setdefault("rotation", 0)
            o.setdefault("visible", True)
            o["properties"] = [{"name": k, "type": "string", "value": json.dumps(v) if not isinstance(v, str) else v}
                               for k, v in o.pop("props", {}).items()]

        mapa = {
            "type": "map", "version": "1.10", "tiledversion": "1.10.2", "orientation": "orthogonal",
            "renderorder": "right-down", "infinite": False, "width": largura, "height": altura,
            "tilewidth": T, "tileheight": T, "nextlayerid": len(CAMADAS) + 4, "nextobjectid": 9000,
            "properties": [{"name": "regiao", "type": "string", "value": "vila"}],
            "tilesets": [
                {"firstgid": 1, "name": "sunnyside", "tilewidth": T, "tileheight": T, "tilecount": 4096,
                 "columns": 64, "margin": 0, "spacing": 0, "image": "../arte/sunnyside/tileset_16.png",
                 "imagewidth": 1024, "imageheight": 1024, "tiles": animacoes_tiled},
                {"firstgid": PRIMEIRO_FLORESTA, "name": "floresta", "tilewidth": T, "tileheight": T,
                 "tilecount": 720, "columns": 20, "margin": 0, "spacing": 0,
                 "image": "../arte/sunnyside/floresta.png", "imagewidth": 320, "imageheight": 576},
                {"firstgid": PRIMEIRO_COLISAO, "name": "colisao", "tilewidth": T, "tileheight": T,
                 "tilecount": 1, "columns": 1, "margin": 0, "spacing": 0,
                 "image": "../arte/sunnyside/colisao.png", "imagewidth": T, "imageheight": T},
            ],
            "layers": camadas_tiled + [
                {"id": len(CAMADAS) + 2, "name": "decoracao", "type": "objectgroup", "x": 0, "y": 0,
                 "opacity": 1, "visible": True, "draworder": "topdown", "objects": objetos_deco},
                {"id": len(CAMADAS) + 3, "name": "objetos", "type": "objectgroup", "x": 0, "y": 0,
                 "opacity": 1, "visible": True, "draworder": "topdown", "objects": objetos_jogo},
            ],
        }
        DESTINO_MAPA.write_text(json.dumps(mapa, ensure_ascii=False), encoding="utf-8")
        (DESTINO_ARTE / "CREDITOS.md").write_text(
            "# Créditos da arte\n\nSunnyside World, de Daniel Diggle: https://danieldiggle.itch.io/sunnyside\n\n"
            "Usada conforme a licença do autor (uso em projetos e redistribuição em cursos com este link).\n"
            "Não é permitido revender os arquivos nem usá-los para treinar IA.\n", encoding="utf-8")

        print(f"mapa {largura}x{altura} tiles · {len(objetos_deco)} decorações · "
              f"{len(manifesto['sprites'])} sprites · {len(manifesto['personagens'])} tiras de personagem · "
              f"{len(objetos_jogo)} objetos do jogo")

        if args.previa:
            gerar_previa(mapa, brutos, colisao, objetos_deco, manifesto, objetos_jogo, args.previa)


def gerar_previa(mapa, brutos, colisao, objetos_deco, manifesto, objetos_jogo, destino):
    """Imagem 2x do mapa com a colisão em vermelho, grade a cada 5 tiles e os objetos do jogo."""
    largura, altura = mapa["width"], mapa["height"]
    ts = Image.open(DESTINO_ARTE / "tileset_16.png").convert("RGBA")
    fl = Image.open(DESTINO_ARTE / "floresta.png").convert("RGBA")
    img = Image.new("RGBA", (largura * T, altura * T), (0, 0, 0, 255))
    for nome in CAMADAS:
        if nome in ACIMA_DO_JOGADOR:
            continue
        fonte, colunas = (fl, 20) if nome == "forest" else (ts, 64)
        for k, (ind, esp, inv, rod) in enumerate(brutos[nome]):
            if not ind:
                continue
            t = fonte.crop(((ind % colunas) * T, (ind // colunas) * T, (ind % colunas + 1) * T, (ind // colunas + 1) * T))
            if nome != "forest":
                if rod:
                    t = t.transpose(Image.ROTATE_270)
                if esp:
                    t = t.transpose(Image.FLIP_LEFT_RIGHT)
                if inv:
                    t = t.transpose(Image.FLIP_TOP_BOTTOM)
            img.alpha_composite(t, ((k % largura) * T, (k // largura) * T))
    for o in sorted(objetos_deco, key=lambda o: o["y"]):
        s = manifesto["sprites"].get(o["name"])
        if not s:
            continue
        tira = Image.open(DESTINO_ARTE / s["arquivo"]).convert("RGBA")
        q = tira.crop((0, 0, s["w"], s["h"]))
        img.alpha_composite(q, (int(o["x"] - s["ox"]), int(o["y"] - s["oy"])))
    camada = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(camada)
    for k, v in enumerate(colisao):
        if v:
            x, y = (k % largura) * T, (k // largura) * T
            d.rectangle((x, y, x + T - 1, y + T - 1), fill=(255, 0, 0, 70))
    for x in range(0, largura, 5):
        d.line((x * T, 0, x * T, altura * T), fill=(255, 255, 255, 60))
        d.text((x * T + 2, 2), str(x), fill=(255, 255, 0, 255))
    for y in range(0, altura, 5):
        d.line((0, y * T, largura * T, y * T), fill=(255, 255, 255, 60))
        d.text((2, y * T + 2), str(y), fill=(255, 255, 0, 255))
    for o in objetos_jogo:
        d.ellipse((o["x"] - 4, o["y"] - 4, o["x"] + 4, o["y"] + 4), fill=(0, 255, 255, 255))
        d.text((o["x"] + 6, o["y"] - 6), o["name"], fill=(0, 255, 255, 255))
    img.alpha_composite(camada)
    img = img.resize((img.width * 2, img.height * 2), Image.NEAREST)
    img.save(destino)
    print(f"prévia salva em {destino}")


if __name__ == "__main__":
    main()
