/**
 * O tratamento do nome — o unico lugar do fluxo onde texto livre vira dado.
 *
 * Em todo o resto o bot roteia por id de botao, que nos mesmos escrevemos: o
 * conjunto de respostas possiveis e fechado e nao ha o que interpretar. Aqui nao:
 * a pessoa digita o que quiser, e nao ha LLM pra entender. Entao o desenho troca de
 * objetivo — em vez de **acertar sempre**, ele garante que **todo erro seja visivel
 * e custe um toque**, porque quem sabe o nome esta do outro lado olhando pro cartao.
 *
 * Dai as duas regras que parecem frouxas e sao deliberadas:
 *
 *  - **Uma palavra e aceita.** Recusar um nome de verdade prende o cliente
 *    redigitando o proprio nome enquanto o bot insiste que esta errado — e cai justo
 *    em quem tem nome menos comum. Aceitar uma bobagem aparece no cartao e morre ali.
 *  - **A validacao so barra o que com certeza nao e nome.** Digito, caractere solto,
 *    simbolo, e a lista de respostas genericas.
 *
 * A lista de genericas e as regras de limpeza vem do no `Nome - Tratamento` do fluxo
 * n8n (ver `ANEXO_FLUXO_N8N_AGENDAMENTO.md`, secao 9). Aquilo nao e teoria: cada
 * item esta la porque gente de verdade digitou aquilo.
 */

/** Particulas que ficam minusculas no meio do nome. */
const PARTICULAS = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);

/**
 * O que uma pessoa responde quando NAO esta respondendo a pergunta. Herdada do n8n
 * e estendida com o vocabulario de correcao, que e a outra metade do mesmo problema.
 */
const GENERICAS = new Set([
  'ok',
  'okay',
  'blz',
  'beleza',
  'sim',
  'nao',
  'não',
  'oi',
  'ola',
  'olá',
  'opa',
  'bom dia',
  'boa tarde',
  'boa noite',
  'confirmar',
  'confirmo',
  'obrigado',
  'obrigada',
  'valeu',
]);

/**
 * Frases que anunciam correcao. Sao prefixos porque o caso mais comum de todos
 * carrega a intencao E o nome na mesma mensagem ("meu nome e Victor Santos") — cortar
 * o prefixo conhecido resolve os dois de uma vez.
 */
const PREFIXOS_DE_CORRECAO = [
  'meu nome e',
  'meu nome é',
  'na verdade e',
  'na verdade é',
  'na verdade',
  'me chamo',
  'e ',
  'é ',
];

/** Frases que anunciam correcao SEM trazer nome junto. */
const SO_CORRECAO = [
  'errei',
  'errado',
  'ta errado',
  'tá errado',
  'esta errado',
  'está errado',
  'nao e esse',
  'não é esse',
  'nao e isso',
  'não é isso',
  'corrige',
  'corrigir',
  'troca',
  'trocar',
  'desconsidera',
  'apaga',
];

export type MotivoInvalido =
  | 'vazio'
  | 'curto'
  | 'tem_numero'
  | 'caracter_invalido'
  | 'resposta_generica';

export type Leitura =
  | { tipo: 'nome'; nome: string }
  /** "Errei" sem dizer o certo — vale o mesmo que tocar em *Corrigir nome*. */
  | { tipo: 'quer_corrigir' }
  | { tipo: 'invalido'; motivo: MotivoInvalido };

/**
 * Le uma mensagem de texto na etapa do nome.
 *
 * Devolve o `motivo` do invalido em vez de um booleano porque o fluxo n8n calculava
 * exatamente isto e **jogava fora**, mandando sempre a mesma frase generica de erro.
 * A precisao ja estava paga; so faltava gastar.
 */
export function lerNome(texto: string): Leitura {
  const limpo = limpar(texto);

  if (!limpo) return { tipo: 'invalido', motivo: 'vazio' };

  const minusculo = limpo.toLowerCase();

  // "Errei o nome" antes de tudo: sem isto, tres palavras que nao sao nome nenhum
  // virariam o nome do cliente.
  if (SO_CORRECAO.some((frase) => minusculo.startsWith(frase))) {
    return { tipo: 'quer_corrigir' };
  }

  const semPrefixo = tirarPrefixo(limpo);
  if (!semPrefixo) return { tipo: 'quer_corrigir' };

  const conteudo = semPrefixo.toLowerCase();
  if (GENERICAS.has(conteudo)) return { tipo: 'invalido', motivo: 'resposta_generica' };
  if (/\d/.test(semPrefixo)) return { tipo: 'invalido', motivo: 'tem_numero' };
  if (!/^[A-Za-zÀ-ÿ'\- ]+$/.test(semPrefixo)) {
    return { tipo: 'invalido', motivo: 'caracter_invalido' };
  }
  // Uma letra sozinha nao e nome em lingua nenhuma. Duas ja e (`Ed`, `Bo`).
  if (semPrefixo.replace(/[^A-Za-zÀ-ÿ]/g, '').length < 2) {
    return { tipo: 'invalido', motivo: 'curto' };
  }

  return { tipo: 'nome', nome: capitalizar(semPrefixo) };
}

/** `NFC`, espacos colapsados, `trim`. Mesmo preparo do n8n. */
function limpar(texto: string): string {
  return texto.normalize('NFC').replace(/\s+/g, ' ').trim();
}

function tirarPrefixo(texto: string): string {
  const minusculo = texto.toLowerCase();

  for (const prefixo of PREFIXOS_DE_CORRECAO) {
    if (minusculo.startsWith(prefixo)) {
      return texto.slice(prefixo.length).replace(/^[\s:,]+/, '').trim();
    }
  }

  return texto;
}

export function capitalizar(nome: string): string {
  return nome
    .split(' ')
    .map((palavra, indice) => {
      const minuscula = palavra.toLowerCase();
      // Particula so fica minuscula no MEIO: "Silva e Souza" sim, "E Silva" nao —
      // quem se chama "Espirito Santo" nao vira "espirito Santo".
      if (indice > 0 && PARTICULAS.has(minuscula)) return minuscula;
      return minuscula.charAt(0).toUpperCase() + minuscula.slice(1);
    })
    .join(' ');
}

/** Quantas palavras de verdade — particula nao conta. */
export function palavrasReais(nome: string): number {
  return nome.split(' ').filter((palavra) => !PARTICULAS.has(palavra.toLowerCase())).length;
}

/** O nome pelo qual o bot chama a pessoa. O completo fica pro banco e pro painel. */
export function primeiroNome(nome: string): string {
  return nome.split(' ')[0] ?? nome;
}

export type Juncao =
  /** Sobrenome chegando: informacao NOVA, o nome cresce. */
  | { tipo: 'acrescimo'; nome: string }
  /** O cliente reescreveu o que ja tinha mandado. */
  | { tipo: 'correcao'; nome: string };

/**
 * Junta o que acabou de chegar com o nome que ja estava pendente.
 *
 * A distincao entre acrescentar e corrigir nao e detalhe de implementacao: e ela que
 * decide se o bot **agenda direto** (o cliente completou a informacao) ou **reimprime
 * o cartao** (o bot pode ter entendido errado, e quem sabe precisa ver antes).
 *
 * `Vicctor` -> `Victor` e correcao, e a semelhanca e o que denuncia. Sem isso, a
 * regra ingenua de "uma palavra soma" produziria `Vicctor Victor` — e pior, agendaria
 * com esse nome sem mostrar.
 */
export function juntarNome(pendente: string | undefined, novo: string): Juncao {
  if (!pendente) return { tipo: 'correcao', nome: novo };

  // Duas ou mais palavras e reescrita: quem manda o nome inteiro esta trocando, nao
  // completando.
  if (palavrasReais(novo) > 1) return { tipo: 'correcao', nome: novo };

  const partes = pendente.split(' ');
  const parecida = partes.findIndex((parte) => pareceCorrecaoDe(parte, novo));

  if (parecida >= 0) {
    partes[parecida] = novo;
    return { tipo: 'correcao', nome: partes.join(' ') };
  }

  return { tipo: 'acrescimo', nome: `${pendente} ${novo}` };
}

/**
 * "Uma e versao errada da outra?" — distancia de edicao com teto proporcional.
 *
 * Palavra curta tolera 1 erro, longa tolera 2. Sem o teto, `Ana` e `Ivo` (distancia
 * 3 em 3 letras) passariam por correcao uma da outra.
 */
function pareceCorrecaoDe(a: string, b: string): boolean {
  const x = a.toLowerCase();
  const y = b.toLowerCase();

  if (x === y) return true;
  if (Math.abs(x.length - y.length) > 2) return false;

  const teto = Math.max(x.length, y.length) >= 6 ? 2 : 1;
  return distancia(x, y, teto) <= teto;
}

/** Levenshtein com corte: para de contar assim que passa do teto. */
function distancia(a: string, b: string, teto: number): number {
  let anterior = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i += 1) {
    const atual = [i];
    let menor = i;

    for (let j = 1; j <= b.length; j += 1) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      const valor = Math.min(
        (atual[j - 1] ?? 0) + 1,
        (anterior[j] ?? 0) + 1,
        (anterior[j - 1] ?? 0) + custo,
      );
      atual.push(valor);
      if (valor < menor) menor = valor;
    }

    if (menor > teto) return teto + 1;
    anterior = atual;
  }

  return anterior[b.length] ?? teto + 1;
}
