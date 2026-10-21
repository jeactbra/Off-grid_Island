import unittest

from ilha.execucao import executar


class TestExecucao(unittest.TestCase):
    def test_captura_print(self):
        r = executar('print("Olá")\nprint("Tensão:", 220)')
        self.assertTrue(r.ok)
        self.assertEqual(r.saida, "Olá\nTensão: 220\n")

    def test_input_simulado_sem_prompt_na_saida(self):
        r = executar('n = int(input("Valor: "))\nprint(n * 2)', ["21"])
        self.assertTrue(r.ok)
        self.assertEqual(r.saida, "42\n")
        self.assertEqual(r.prompts, ["Valor: "])

    def test_varias_entradas(self):
        r = executar("a = input()\nb = input()\nprint(b, a)", ["1", "2"])
        self.assertEqual(r.saida, "2 1\n")

    def test_entradas_acabam(self):
        r = executar("input()\ninput()", ["1"])
        self.assertEqual(r.erro.tipo, "SemEntradas")
        self.assertEqual(r.erro.linha, 2)

    def test_laco_infinito_interrompido(self):
        r = executar("while True:\n    pass")
        self.assertEqual(r.erro.tipo, "LimiteExecucao")

    def test_import_bloqueado(self):
        r = executar("import os\nprint(os.getcwd())")
        self.assertEqual(r.erro.tipo, "ImportError")

    def test_import_permitido(self):
        r = executar("import math\nprint(math.sqrt(16))")
        self.assertEqual(r.saida, "4.0\n")

    def test_open_indisponivel(self):
        r = executar('open("x.txt")')
        self.assertEqual(r.erro.tipo, "NameError")

    def test_saida_parcial_antes_do_erro(self):
        r = executar('print("antes")\nprint(1 / 0)')
        self.assertEqual(r.saida, "antes\n")
        self.assertEqual(r.erro.tipo, "ZeroDivisionError")

    def test_execucoes_isoladas(self):
        executar("x = 5")
        r = executar("print(x)")
        self.assertEqual(r.erro.tipo, "NameError")


if __name__ == "__main__":
    unittest.main()
