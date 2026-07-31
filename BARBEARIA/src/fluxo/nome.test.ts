import { describe, expect, it } from 'vitest';
import { capitalizar, juntarNome, lerNome, palavrasReais, primeiroNome } from './nome.js';

const nomeDe = (texto: string): string => {
  const leitura = lerNome(texto);
  if (leitura.tipo !== 'nome') throw new Error(`esperava nome, veio ${leitura.tipo}`);
  return leitura.nome;
};

const motivoDe = (texto: string): string => {
  const leitura = lerNome(texto);
  if (leitura.tipo !== 'invalido') throw new Error(`esperava invalido, veio ${leitura.tipo}`);
  return leitura.motivo;
};

describe('lerNome — o que passa', () => {
  it('aceita nome completo, limpando espaco e capitalizando', () => {
    expect(nomeDe('  victor   santos ')).toBe('Victor Santos');
    expect(nomeDe('VICTOR SANTOS')).toBe('Victor Santos');
  });

  it('aceita UMA palavra — recusar prende o cliente redigitando o proprio nome', () => {
    expect(nomeDe('Victor')).toBe('Victor');
  });

  it('aceita os nomes que uma regra esperta recusaria', () => {
    // O custo de recusar um nome de verdade cai justo em quem tem nome menos comum.
    expect(nomeDe("victor sant'anna")).toBe("Victor Sant'anna");
    expect(nomeDe('ana-clara souza')).toBe('Ana-clara Souza');
    expect(nomeDe('José Ítalo Nuñez')).toBe('José Ítalo Nuñez');
    expect(nomeDe('Ed Sá')).toBe('Ed Sá');
  });

  it('mantem particula minuscula no meio, e maiuscula no comeco', () => {
    expect(nomeDe('victor da silva e souza')).toBe('Victor da Silva e Souza');
    // Quem se chama "Espirito Santo" nao vira "espirito Santo".
    expect(nomeDe('do carmo pereira')).toBe('Do Carmo Pereira');
  });

  it('corta o prefixo de apresentacao e fica com o nome', () => {
    expect(nomeDe('meu nome é Victor Santos')).toBe('Victor Santos');
    expect(nomeDe('na verdade é Victor')).toBe('Victor');
    expect(nomeDe('me chamo victor santos')).toBe('Victor Santos');
  });
});

describe('lerNome — o que nao passa, e por que', () => {
  it('devolve o motivo, que e o que o n8n calculava e jogava fora', () => {
    expect(motivoDe('')).toBe('vazio');
    expect(motivoDe('   ')).toBe('vazio');
    expect(motivoDe('x')).toBe('curto');
    expect(motivoDe('Victor 2')).toBe('tem_numero');
    expect(motivoDe('11999998888')).toBe('tem_numero');
    expect(motivoDe('😀')).toBe('caracter_invalido');
    expect(motivoDe('https://insta.com/victor')).toBe('caracter_invalido');
  });

  it('recusa as respostas genericas que gente de verdade digitou', () => {
    for (const generica of ['ok', 'sim', 'blz', 'oi', 'bom dia', 'confirmo', 'valeu']) {
      expect(motivoDe(generica)).toBe('resposta_generica');
    }
  });
});

describe('lerNome — "errei o nome" escrito em vez de tocado', () => {
  it('reconhece a intencao de corrigir sem nome junto', () => {
    for (const frase of ['errei', 'errei meu nome', 'ta errado', 'não é isso', 'corrige aí']) {
      expect(lerNome(frase).tipo).toBe('quer_corrigir');
    }
  });

  it('quando a frase traz o nome junto, vale o nome — nao a intencao', () => {
    // "meu nome é Victor Santos" e a frase mais comum de todas: carrega as duas
    // coisas, e o nome e o que importa.
    expect(nomeDe('meu nome é Victor Santos')).toBe('Victor Santos');
  });
});

describe('juntarNome — acrescentar x corrigir', () => {
  it('palavra nova e sem parecenca e sobrenome: acrescimo', () => {
    expect(juntarNome('Victor', 'Santos')).toEqual({ tipo: 'acrescimo', nome: 'Victor Santos' });
  });

  it('palavra parecida com a que ja esta la e correcao de digitacao', () => {
    // Sem isto, a regra ingenua produziria "Vicctor Victor" — e agendaria com ele.
    expect(juntarNome('Vicctor', 'Victor')).toEqual({ tipo: 'correcao', nome: 'Victor' });
    expect(juntarNome('Victor Sanntos', 'Santos')).toEqual({
      tipo: 'correcao',
      nome: 'Victor Santos',
    });
  });

  it('duas ou mais palavras reescrevem tudo', () => {
    expect(juntarNome('Vicctor', 'Victor Santos')).toEqual({
      tipo: 'correcao',
      nome: 'Victor Santos',
    });
  });

  it('sem nada pendente, o primeiro texto e o nome', () => {
    expect(juntarNome(undefined, 'Victor')).toEqual({ tipo: 'correcao', nome: 'Victor' });
  });

  it('nomes curtos e diferentes NAO viram correcao um do outro', () => {
    // `Ana` e `Ivo` diferem em 3 de 3 letras: sem teto proporcional, um viraria
    // correcao do outro e o sobrenome se perderia.
    expect(juntarNome('Ana', 'Ivo').tipo).toBe('acrescimo');
    expect(juntarNome('Ana', 'Sá').tipo).toBe('acrescimo');
  });
});

describe('primeiro nome e contagem', () => {
  it('o bot chama pelo primeiro nome; o banco guarda o completo', () => {
    expect(primeiroNome('Victor Santos')).toBe('Victor');
    expect(primeiroNome('Victor')).toBe('Victor');
  });

  it('particula nao conta como palavra real', () => {
    expect(palavrasReais('Victor')).toBe(1);
    expect(palavrasReais('Victor da Silva')).toBe(2);
    expect(capitalizar('victor')).toBe('Victor');
  });
});
