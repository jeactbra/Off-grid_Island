import unittest

import conteudo  # noqa: F401
from ilha import desafio as d


class TestSementes(unittest.TestCase):
    def test_mesma_semente_mesma_missao(self):
        s = d.semente_para("aluno-1", "vila_programa_status", "semana-1")
        self.assertEqual(d.gerar("vila_programa_status", s).saida_exemplo,
                         d.gerar("vila_programa_status", s).saida_exemplo)

    def test_alunos_diferentes_missoes_diferentes(self):
        pares = 200
        iguais = 0
        for i in range(pares):
            a = d.gerar("vila_chefe_relatorio", d.semente_para(f"aluno-{i}", "chefe", "s1"))
            b = d.gerar("vila_chefe_relatorio", d.semente_para(f"aluno-{i}-b", "chefe", "s1"))
            iguais += a.saida_exemplo == b.saida_exemplo
        self.assertLess(iguais / pares, 0.10)


class TestAvaliacao(unittest.TestCase):
    def test_programa_certo_e_errado(self):
        g = d.gerar("vila_programa_status", 7)
        self.assertTrue(d.avaliar(g, g.missao.solucao).passou)
        r = d.avaliar(g, 'print("nada")')
        self.assertFalse(r.passou)
        self.assertEqual(r.linha_diferente, 1)

    def test_erro_traduzido_na_avaliacao(self):
        g = d.gerar("vila_programa_status", 7)
        r = d.avaliar(g, 'Print("x")')
        self.assertFalse(r.passou)
        self.assertEqual(r.erro.conceito, "maiusculas")

    def test_prever(self):
        g = d.gerar("vila_prever_painel", 3)
        self.assertTrue(d.avaliar(g, g.saida_exemplo).passou)
        self.assertFalse(d.avaliar(g, "qualquer coisa").passou)

    def test_completar(self):
        g = d.gerar("vila_completar_painel", 3)
        self.assertTrue(d.avaliar(g, g.missao.preenchimento).passou)
        self.assertFalse(d.avaliar(g, ["print"]).passou)

    def test_detetive_codigo_original_falha(self):
        for semente in range(50):
            g = d.gerar("vila_detetive_painel", semente)
            self.assertFalse(d.avaliar(g, g.missao.codigo).passou)

    def test_tentativas_nao_alteram_resultado(self):
        g = d.gerar("vila_programa_status", 11)
        for _ in range(5):
            d.avaliar(g, "print(1)")
        self.assertTrue(d.avaliar(g, g.missao.solucao).passou)


if __name__ == "__main__":
    unittest.main()
