"""Testes do mapa da Vila gerado por ferramentas/importar_sunnyside.py."""

import json
import unittest
from collections import deque
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
T = 16


class TestMapaVila(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mapa = json.loads((RAIZ / "mapas" / "vila.tmj").read_text(encoding="utf-8"))
        camadas = {c["name"]: c for c in cls.mapa["layers"]}
        cls.largura, cls.altura = cls.mapa["width"], cls.mapa["height"]
        cls.colisao = camadas["colisao"]["data"]
        cls.objetos = camadas["objetos"]["objects"]
        cls.decoracao = camadas["decoracao"]["objects"]
        cls.manifesto = json.loads((RAIZ / "arte" / "sunnyside" / "sprites.json").read_text(encoding="utf-8"))

        inicio = next(o for o in cls.objetos if o["type"] == "inicio")
        origem = (int(inicio["x"] // T), int(inicio["y"] // T))
        cls.alcancaveis = {origem}
        fila = deque([origem])
        while fila:
            x, y = fila.popleft()
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if (0 <= nx < cls.largura and 0 <= ny < cls.altura and (nx, ny) not in cls.alcancaveis
                        and not cls.colisao[ny * cls.largura + nx]):
                    cls.alcancaveis.add((nx, ny))
                    fila.append((nx, ny))

    def perto_de_alcancavel(self, tx, ty):
        return any((tx + dx, ty + dy) in self.alcancaveis for dx in (-1, 0, 1) for dy in (-1, 0, 1))

    def test_inicio_livre(self):
        self.assertGreater(len(self.alcancaveis), 500)

    def test_todos_os_objetos_alcancaveis(self):
        for o in self.objetos:
            with self.subTest(objeto=o["name"]):
                self.assertTrue(self.perto_de_alcancavel(int(o["x"] // T), int(o["y"] // T)))

    def test_rotas_dos_moradores_alcancaveis(self):
        for o in self.objetos:
            props = {p["name"]: p["value"] for p in o.get("properties", [])}
            for tx, ty in json.loads(props.get("rota", "[]")):
                with self.subTest(morador=o["name"], ponto=(tx, ty)):
                    self.assertTrue(self.perto_de_alcancavel(tx, ty))

    def test_tem_moradores_e_painel(self):
        tipos = [o["type"] for o in self.objetos]
        self.assertGreaterEqual(tipos.count("npc"), 10)
        self.assertIn("terminal", tipos)
        self.assertIn("portao", tipos)

    def test_visuais_dos_moradores_existem(self):
        for o in self.objetos:
            if o["type"] != "npc":
                continue
            props = {p["name"]: p["value"] for p in o.get("properties", [])}
            with self.subTest(morador=o["name"]):
                self.assertIn(f"{props['visual']}_idle", self.manifesto["personagens"])
                self.assertIn(f"{props['visual']}_walk", self.manifesto["personagens"])

    def test_decoracao_tem_sprite(self):
        for o in self.decoracao:
            self.assertIn(o["name"], self.manifesto["sprites"])

    def alcance(self, origem, fechada=None):
        vistos, fila = {origem}, deque([origem])
        while fila:
            x, y = fila.popleft()
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                n = (x + dx, y + dy)
                if (0 <= n[0] < self.largura and 0 <= n[1] < self.altura and n not in vistos and n != fechada
                        and not self.colisao[n[1] * self.largura + n[0]]):
                    vistos.add(n)
                    fila.append(n)
        return vistos

    def test_portao_bloqueia_a_ponte_oeste(self):
        """O planalto da fazenda (futuro Campo Solar) só se alcança passando pelo portão."""
        portao = next(o for o in self.objetos if o["type"] == "portao")
        celula_portao = (int(portao["x"] // T), int(portao["y"] // T))
        inicio = next(o for o in self.objetos if o["type"] == "inicio")
        origem = (int(inicio["x"] // T), int(inicio["y"] // T))
        fazenda = (10, 10)
        self.assertIn(fazenda, self.alcance(origem))
        self.assertNotIn(fazenda, self.alcance(origem, fechada=celula_portao))


if __name__ == "__main__":
    unittest.main()
