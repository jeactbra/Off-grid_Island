import unittest

from ilha.execucao import executar


def erro(codigo, entradas=None):
    return executar(codigo, entradas).erro


class TestTraducaoErros(unittest.TestCase):
    def test_print_maiusculo(self):
        e = erro('Print("oi")')
        self.assertEqual(e.conceito, "maiusculas")
        self.assertIn("print", e.dica)
        self.assertEqual(e.linha, 1)

    def test_texto_sem_aspas(self):
        e = erro("print(Painel ligado)")
        self.assertEqual(e.tipo, "SyntaxError")
        self.assertEqual(e.conceito, "aspas")

    def test_aspas_nao_fechadas(self):
        self.assertEqual(erro('print("oi)').conceito, "aspas")

    def test_aspas_tortas(self):
        self.assertEqual(erro("print(“oi”)").conceito, "aspas")

    def test_parentese_aberto(self):
        self.assertEqual(erro('print("oi"').conceito, "parenteses")

    def test_texto_mais_numero(self):
        e = erro('print("Total: " + 10)')
        self.assertEqual(e.conceito, "concatenacao")

    def test_falta_dois_pontos(self):
        self.assertEqual(erro("if 1 > 0\n    print(1)").conceito, "dois_pontos")

    def test_indentacao(self):
        self.assertEqual(erro("if 1 > 0:\nprint(1)").conceito, "indentacao")
        self.assertEqual(erro("x = 1\n    print(x)").conceito, "indentacao")

    def test_variavel_inexistente(self):
        e = erro("total = 5\nprint(totl)")
        self.assertEqual(e.conceito, "variaveis")
        self.assertEqual(e.linha, 2)
        self.assertIn("totl", e.mensagem)

    def test_conversao_invalida(self):
        self.assertEqual(erro("int(input())", ["abc"]).conceito, "tipos")

    def test_divisao_por_zero(self):
        self.assertEqual(erro("print(5 / 0)").tipo, "ZeroDivisionError")

    def test_indice(self):
        self.assertEqual(erro("x = [1]\nprint(x[3])").conceito, "indices")

    def test_chave(self):
        self.assertEqual(erro('d = {}\nprint(d["a"])').conceito, "dicionarios")

    def test_comparacao_texto_numero(self):
        self.assertEqual(erro('x = input()\nif x > 5:\n    print(x)', ["7"]).conceito, "tipos")

    def test_mensagem_original_preservada(self):
        self.assertTrue(erro("print(1 / 0)").original.startswith("ZeroDivisionError"))


if __name__ == "__main__":
    unittest.main()
