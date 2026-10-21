# Ilha Off-Grid

Jogo web 2D para praticar Python, feito para calouros de Engenharia de Energias Renováveis.
O design completo está em `../docs/Ilha_Off-Grid_Documento_de_Design.md`.

## Estado atual: Fase 2 concluída, com arte definitiva da Vila

O jogo já abre no navegador com a Vila explorável, no estilo Stardew/Pokémon (arte Sunnyside World):
ilha de contorno orgânico, rio, pontes, planaltos com escadas, animais e 10 moradores (alguns parados
fazendo algo, outros vagando ou seguindo rotas). O aluno conversa com a técnica Lia, aceita a missão,
usa o painel do Moinho G1 (editor de código com Python de verdade) e, ao concluir, os moinhos voltam a
girar e a Vila sai do escuro.

| Pasta | O que tem |
| --- | --- |
| `motor/` | Jogo em Phaser 3 + TypeScript: cenas, texturas provisórias, interface (HUD, diálogo, terminal, toque) |
| `mapas/` | `vila.tmj` (formato do Tiled, gerado), `vila_jogo.json` (moradores, painel, portão) e `vila_ajustes.json` (pontes e escadas acrescentadas) |
| `arte/sunnyside/` | Arte importada do pacote Sunnyside World: tilesets, sprites, personagens e `sprites.json` (ver `CREDITOS.md`) |
| `python/ilha/` | Núcleo em Python: execução segura do código do aluno, tradução de erros, comparação de saídas, base dos desafios |
| `python/conteudo/` | Uma subpasta por região, com os modelos de desafio (`desafios.py`) e os metadados (`regiao.toml`) |
| `executor/` | Web Worker que roda o núcleo Python no navegador com Pyodide, e o cliente JS |
| `laboratorio/` | Bancada de teste das missões (não é a tela do aluno) |
| `ferramentas/` | Validação dos modelos, manifesto de arquivos Python e importador da arte (`importar_sunnyside.py`) |
| `testes/` | Testes automáticos do núcleo Python e do mapa (unittest, sem dependências) |

## Como usar

Na primeira vez, instale as dependências do jogo (precisa de Node.js 18 ou mais novo):

```bash
npm install
```

Jogar em modo de desenvolvimento (recarrega sozinho ao editar o código):

```bash
npm run dev
# abra o endereço mostrado, normalmente http://localhost:5173
# o laboratório fica em http://localhost:5173/laboratorio/
```

Controles: setas ou WASD para andar, **Shift** para correr, **E** ou **Espaço** para interagir,
**Esc** fecha o terminal.
No celular aparecem um joystick e o botão de ação. Parâmetros de URL úteis:
`?toque=1` (força os controles de toque), `?debug=1` (tecla L acende a região), `?fisica=1` (mostra colisões).

Gerar a versão de publicação (pasta `dist/`, pronta para o GitHub Pages):

```bash
npm run build
```

Rodar os testes do núcleo Python e validar o conteúdo (cada modelo com 500 sementes):

```bash
python3 -m unittest discover -s testes -t .
python3 ferramentas/validar_conteudo.py
```

O primeiro carregamento baixa o Pyodide (cerca de 10 MB) e pode levar alguns segundos;
o jogo começa a carregá-lo enquanto o aluno explora o mapa.

## Arte e mapa

A arte vem do pacote [Sunnyside World](https://danieldiggle.itch.io/sunnyside), de Daniel Diggle,
usado conforme a licença do autor (uso em projetos e redistribuição em cursos com o link da página).
O pacote original fica fora do repositório (`../Art_package/`). Para reimportar depois de mudar
`mapas/vila_jogo.json` ou `mapas/vila_ajustes.json`:

```bash
python3 ferramentas/importar_sunnyside.py ../Art_package/sunrise/Sunnyside_World_ASSET_PACK_V2.1.zip
python3 -m unittest testes.test_mapa      # confere se tudo continua alcançável
```

O importador converte a cena de exemplo do pacote (projeto GameMaker) para o formato do Tiled,
calcula a colisão (água, penhascos, casas, cercas e árvores bloqueiam; pontes e escadas liberam),
monta os personagens por camadas (corpo + cabelo + ferramentas) e tira da cena os personagens
desenhados, que viram moradores de verdade. O mapa gerado também abre no editor Tiled.

Para mudar moradores, falas, rotas e objetos, edite `mapas/vila_jogo.json`. Cada morador tem
`visual` (cabelo: shorthair, bowlhair, curlyhair, longhair, mophair, spikeyhair), `comportamento`
(`parado`, `vagar` com `raio` em tiles, ou `rota` com pontos em tiles), `acao` quando parado
(idle, watering, hammering, reeling, mining, axe, waiting, carry, casting, dig, doing) e `falas`.

## Como criar uma missão nova

1. Escreva uma função em `python/conteudo/<regiao>/desafios.py` com o decorador `@desafio`.
2. Ela recebe `rnd` (um `random.Random`) e devolve uma `Missao` com `titulo`, `enunciado`,
   `solucao` e, conforme o formato, `codigo`, `entradas`, `preenchimento`, `erradas` e `dicas`.
3. A saída esperada não é escrita à mão: o jogo roda a `solucao` com cada lista de `entradas`.
4. Rode `python3 ferramentas/validar_conteudo.py`.
5. Se criou ou removeu arquivos, rode `python3 ferramentas/gerar_manifesto.py`.
6. Para a missão aparecer no mundo, ligue-a a um objeto do mapa (propriedade `missao` no Tiled).

Formatos: `prever` (aluno escreve a saída), `completar` (lacunas `___`), `detetive`
(código com defeito para consertar) e `programa` (programa completo).

## Autoria dos commits

Todos os commits deste repositório usam a autoria:

```
jeactbra <jean.constant@hotmail.com>
```

O repositório já está configurado assim (`git config user.name` / `user.email` locais).
Confira antes de commitar em uma máquina nova.

## Histórico

Registro datado das decisões de projeto e das mudanças de código. Entradas mais recentes no topo.

### 2026-10-20 — Arte definitiva da Vila (Sunnyside World) e moradores vivos

- **Decisão:** visual no estilo Stardew/Pokémon com o pacote Sunnyside World (Daniel Diggle). O Ninja
  Adventure (CC0) também foi avaliado; fica como reserva (tem sons e música CC0 para usar depois).
- Novo importador `ferramentas/importar_sunnyside.py`: decodifica a cena do projeto GameMaker do pacote
  (13 camadas, tiles espelhados/girados, floresta em tiles de 32 px), gera `mapas/vila.tmj`, a camada de
  colisão, as animações de água e os sprites decorativos (419 objetos, 82 sprites animados).
- Colisão definida por regras conferidas visualmente (água, penhascos, rio, casas, cercas e árvores
  bloqueiam; pontes, cais e escadas liberam). Ajustes de level design em `mapas/vila_ajustes.json`:
  ponte de tábuas ligando a rua principal à praça do moinho e escada descendo para a mina.
- 10 moradores com personagens em camadas (6 cabelos, 13 ações): Lia (técnica), Rosa (horta),
  Tito (pescador), Bruna (ferreira), Nico (criança que vaga), Seu Jair, Davi (rota pela rua principal),
  Mara (pastora), Caio (lenhador) e Lu (mineira). Viram para o jogador e param para conversar.
- A missão agora é no painel do Moinho G1: antes da missão, Vila no escuro e moinhos parados;
  ao concluir, a câmera vai até o moinho, os 5 moinhos voltam a girar e a Vila clareia.
- Portão trancado na ponte oeste: o planalto da fazenda (futuro Campo Solar) fica visível mas fechado.
- Jogador com caminhada e corrida (Shift), balão de interação, tela de carregamento.
- Testes: 7 testes novos do mapa (tudo alcançável a partir do início, portão de fato fecha a ponte,
  visuais dos moradores existem); autoteste do jogo com 16 verificações, todas passando a ~60 fps.
- Removido o gerador de mapa provisório (`ferramentas/gerar_mapa_vila.py`).

### 2026-10-20 — Fase 2: mundo 2D da Vila

- Projeto Phaser 3.87 + TypeScript 5.6 + Vite 5.4 (`npm run dev` / `npm run build`), com CodeMirror 6 no terminal.
- Mapa da Vila (40x30 tiles de 32 px) no formato do Tiled, gerado por `ferramentas/gerar_mapa_vila.py`:
  casas, caminhos, pátio cercado do Gerador G1, postes, quadro de avisos e o portão para o Campo Solar.
- Arte provisória desenhada por código (`motor/texturas.ts`), trocável depois por um pacote de arte
  mantendo as mesmas chaves de textura.
- Personagem com teclado (setas/WASD) e toque (joystick + botão), colisão, câmera que acompanha e zoom
  conforme o tamanho da tela.
- Diálogo com a técnica Lia (aceitar ou recusar a missão), quadro de avisos e portão com falas.
- Terminal sobre o jogo: missão, saída esperada, editor Python, Rodar, Enviar e dicas da mentora Iara.
  Tentativas contadas em silêncio e mostradas só na conclusão, com bônus de persistência.
- Região apagada/acesa: ao concluir, gerador liga, postes e janelas acendem e a energia vai para o HUD.
- Teste de ponta a ponta no Firefox headless (`motor/autoteste.ts`, ativado com `?autoteste=URL`):
  12 verificações, a 60 quadros por segundo, com WebGL.
- Integração contínua passa a checar também tipos e build do jogo, e se o mapa gerado está atualizado.
- Página inicial (`index.html`) agora é o jogo; o laboratório continua em `laboratorio/`.

### 2026-10-20 — Formatos novos, fragmentos colecionáveis e início da Fase 2

- **Decisão:** os 4 formatos iniciais (prever, completar, detetive, programa) não bastam para manter o interesse.
  O design passou a ter 12 formatos: montar blocos, código que controla o mundo, raio-X do código,
  ligar os cabos, modificar, caminho da decisão, teste de estresse e eficiência (opcional), além dos 4 originais.
- **Decisão:** regra de variedade: nunca o mesmo formato duas vezes seguidas, prioridade aos menos jogados,
  pelo menos 5 formatos por região. O raio-X (passo a passo) vira botão em toda missão de código.
- **Decisão:** fragmentos de código colecionáveis, achados no mapa, dados por chefes e por bônus.
  Cada região tem uma montagem secreta (5 a 8 fragmentos); a coleção final "Núcleo da Ilha" aciona o final do jogo.
  Os fragmentos alimentam o "Caderno do Engenheiro", consultável durante as missões. Nada se perde, cada aluno
  recebe sua variação e as montagens não contam para a nota.
- **Decisão:** todo o histórico de decisões e mudanças fica registrado neste README, com data.
- Node.js 18.19 instalado na máquina de desenvolvimento; início da Fase 2 (mundo 2D).

### 2026-10-20 — Acesso por matrícula e repositório

- **Decisão:** o aluno entra só com a matrícula. O professor cadastra as matrículas no painel e envia, por e-mail
  e fora da plataforma, um link de uso único (7 dias) para o aluno criar a senha. Nenhum nome ou e-mail é
  guardado; não há recuperação de senha pela plataforma: o professor gera e reenvia um novo link.
- Repositório publicado em https://github.com/jeactbra/Off-grid_Island (público, envio por SSH).
- Página inicial (`index.html`) redireciona ao laboratório; README com o comando do servidor usando `--directory`.

### 2026-10-20 — Fase 1: executor Python e formato de conteúdo

- Núcleo Python (`python/ilha/`): execução isolada com `input()` simulado, limite de 500 mil passos ou 3 s
  contra laço infinito, `import` restrito a `math` e `random`, tradução de erros para português com dica e
  conceito, comparador tolerante (espaços, acentos, números por valor).
- Base de desafios com 4 formatos e sementes estáveis por aluno + missão + semana. A saída esperada é sempre
  gerada pela solução de referência, nunca escrita à mão.
- Região 1 (Vila): 5 modelos (prever, completar, detetive, programa e chefe).
- Navegador: Pyodide 0.26.4 num Web Worker (`executor/`) e página de laboratório (`laboratorio/`).
- Qualidade: 42 testes automáticos, validação de cada modelo com 500 sementes, teste de integração no Firefox
  headless (15 verificações) e GitHub Actions.
- **Decisão:** as missões praticam o conceito central de cada aula, sem copiar exercícios, exemplos ou a ordem
  dos notebooks do curso.

### 2026-10-20 — Documento de design

- Documento de design criado (https://claude.ai/artifact/KCQCqwBWv59dSvDtNkaGQZ; cópia em `../docs/`).
- **Decisões:** jogo 2D de mundo aberto no navegador, tema "Ilha Off-Grid" (energias renováveis), prática fora
  da sala, regiões liberadas pelo professor conforme as aulas, atividade semanal com prazo e nota por região.
- **Decisão:** nenhuma penalidade por tentativa. O número de tentativas aparece só na tela de conclusão,
  sempre com bonificação (bônus de persistência a partir de 4 tentativas).
- **Decisão:** duas moedas: energia (kWh, ligada à conclusão e à nota) e certificados de energia renovável
  (RECs, por solução com autoria própria; não afetam a nota). Certificação sem nunca acusar o aluno.
- **Decisão:** painel do professor com Supabase (gratuito) e hospedagem no GitHub Pages.
