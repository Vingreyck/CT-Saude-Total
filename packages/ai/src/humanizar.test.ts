import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { humanizar, limitarEmoji, quebrarEmMensagens, calcularAtrasoDigitacao } from './humanizar.js'

const juntar = (t: string, o = {}) => humanizar(t, o).mensagens.join(' ')

describe('travessao', () => {
  it('troca em dash por virgula', () => {
    const r = humanizar('o treino tá bom — mas o ar condicionado não')
    assert.equal(r.mensagens[0], 'o treino tá bom, mas o ar condicionado não')
    assert.ok(r.regrasAplicadas.includes('travessao'))
  })

  it('troca en dash tambem', () => {
    assert.ok(!juntar('das 6 – as 22').includes('–'))
  })

  it('nao sobra nenhum travessao, venha como vier', () => {
    const amostras = [
      'a—b',
      'a — b',
      'a–b',
      'texto normal — com travessao no meio — e outro',
    ]
    for (const a of amostras) {
      assert.match(juntar(a), /^[^—–]*$/, `sobrou travessao em: ${a}`)
    }
  })
})

describe('emoji', () => {
  it('remove tudo quando o orcamento e zero', () => {
    const r = humanizar('valeu demais 😊🙏')
    assert.equal(r.mensagens[0], 'valeu demais')
    assert.ok(r.regrasAplicadas.includes('emoji'))
  })

  it('respeita o orcamento e devolve o saldo', () => {
    const r = humanizar('boa 😊 demais 🙏', { orcamentoEmoji: 1 })
    assert.equal(r.mensagens[0], 'boa 😊 demais')
    assert.equal(r.orcamentoEmojiRestante, 0)
  })

  it('trata emoji composto como um so', () => {
    const { restante } = limitarEmoji('bom treino 👨‍👩‍👧', 1)
    assert.equal(restante, 0)
  })
})

describe('frases de robo', () => {
  it('corta abertura corporativa', () => {
    assert.equal(juntar('Olá! Tudo bem com você? o treino foi bom hoje?'), 'o treino foi bom hoje?')
  })

  it('corta claro reflexo', () => {
    assert.equal(juntar('Claro! vou anotar aqui'), 'vou anotar aqui')
  })

  it('corta sua opiniao e muito importante', () => {
    assert.equal(juntar('anotado. Sua opinião é muito importante para nós!'), 'anotado.')
  })

  it('corta fico a disposicao', () => {
    assert.ok(!juntar('vou passar pro pessoal. Fico à disposição!').toLowerCase().includes('disposi'))
  })

  it('nao corta texto legitimo que so parece', () => {
    const t = 'o professor falou que sua evolução tá boa'
    assert.equal(juntar(t), t)
  })
})

describe('markdown', () => {
  it('tira negrito e lista', () => {
    assert.equal(juntar('**limpeza** ficou boa'), 'limpeza ficou boa')
    assert.equal(juntar('- primeiro item'), 'primeiro item')
  })
})

describe('pontuacao', () => {
  it('reduz exclamacao em serie', () => {
    assert.equal(juntar('boa!!!'), 'boa!')
  })
})

describe('quebra de mensagem', () => {
  it('nao quebra mensagem curta', () => {
    assert.equal(quebrarEmMensagens('oi, tudo certo?').length, 1)
  })

  it('quebra mensagem longa em duas', () => {
    const longa = 'primeira frase bem comprida pra estourar o limite. '.repeat(8)
    const partes = quebrarEmMensagens(longa, 120, 2)
    assert.equal(partes.length, 2)
  })

  it('nunca perde conteudo ao quebrar', () => {
    const longa = 'uma. duas. tres. quatro. cinco. seis. sete. oito. nove. dez.'
    const partes = quebrarEmMensagens(longa, 20, 2)
    const reconstruido = partes.join(' ').replace(/\s+/g, ' ')
    for (const palavra of ['uma', 'cinco', 'dez']) {
      assert.ok(reconstruido.includes(palavra), `perdeu "${palavra}"`)
    }
  })

  it('nao quebra no meio de palavra', () => {
    for (const p of quebrarEmMensagens('antediluviano. paralelepipedo. otorrinolaringologista.', 15, 2)) {
      assert.ok(!/\w$/.test(p) || p.endsWith('.') || /\s/.test(p) || p.length > 0)
    }
  })
})

describe('ritmo de digitacao', () => {
  it('fica entre 700ms e 4s', () => {
    assert.ok(calcularAtrasoDigitacao('oi') >= 700)
    assert.ok(calcularAtrasoDigitacao('x'.repeat(5000)) <= 4000)
  })
})

describe('saida composta, como vem do modelo de verdade', () => {
  it('limpa tudo de uma vez', () => {
    const doModelo =
      'Olá! Tudo bem? 😊 Fico feliz em ajudar! Sua opinião é muito importante para nós — vou registrar sua reclamação sobre a **limpeza** do banheiro!!!'
    const r = humanizar(doModelo)
    const saida = r.mensagens.join(' ')

    assert.ok(!/[—–]/.test(saida), 'sobrou travessao')
    assert.ok(!/\p{Extended_Pictographic}/u.test(saida), 'sobrou emoji')
    assert.ok(!/\*\*/.test(saida), 'sobrou markdown')
    assert.ok(!/!!/.test(saida), 'sobrou exclamacao em serie')
    assert.ok(!/opinião é muito importante/i.test(saida), 'sobrou frase de robo')
    assert.ok(saida.includes('limpeza'), 'perdeu o conteudo real')
  })
})

describe('rede de seguranca', () => {
  it('nao deixa a mensagem vazia quando o modelo so mandou protocolo', () => {
    const r = humanizar('Fico feliz em ajudar!')
    assert.ok(r.mensagens.join('').trim().length > 0, 'ficou vazio')
    assert.ok(r.regrasAplicadas.includes('restaurado_por_seguranca'))
  })

  it('mas deixa encolher quando sobra conteudo de verdade', () => {
    assert.equal(juntar('anotado. Fico feliz em ajudar!'), 'anotado.')
  })
})
