import unittest

from ilha.comparador import OpcoesComparacao, equivalentes, primeira_diferenca


class TestComparador(unittest.TestCase):
    def test_espacos_e_linhas_finais(self):
        self.assertTrue(equivalentes("A:  5  \n\n\n", "A: 5\n"))

    def test_acentos_ignorados_por_padrao(self):
        self.assertTrue(equivalentes("Tensao: 220", "Tensão: 220"))

    def test_acentos_estritos(self):
        self.assertFalse(equivalentes("Tensao", "Tensão", OpcoesComparacao(ignorar_acentos=False)))

    def test_maiusculas_estritas_por_padrao(self):
        self.assertFalse(equivalentes("ligado", "Ligado"))
        self.assertTrue(equivalentes("ligado", "Ligado", OpcoesComparacao(ignorar_maiusculas=True)))

    def test_numeros_por_valor(self):
        self.assertTrue(equivalentes("35.0 kW", "35 kW"))
        self.assertTrue(equivalentes("0.30000000000000004", "0.3"))
        self.assertFalse(equivalentes("0.31", "0.3"))

    def test_texto_diferente_com_numeros(self):
        self.assertFalse(equivalentes("A 5", "B 5"))

    def test_primeira_diferenca(self):
        dif = primeira_diferenca("a\nb\nc", "a\nx\nc")
        self.assertEqual((dif.linha, dif.esperada, dif.obtida), (2, "x", "b"))

    def test_linha_faltando(self):
        dif = primeira_diferenca("a", "a\nb")
        self.assertEqual((dif.linha, dif.esperada, dif.obtida), (2, "b", ""))

    def test_linha_em_branco_interna_conta(self):
        self.assertFalse(equivalentes("a\nb", "a\n\nb"))


if __name__ == "__main__":
    unittest.main()
