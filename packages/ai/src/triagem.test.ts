import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { triar } from './triagem.js'

const acao = (t: string) => triar(t).acao

describe('opt-out, que é obrigação legal', () => {
  it('pega as formas diretas', () => {
    for (const t of ['parar', 'PARE', 'sair', 'stop', 'Parar.', 'remover']) {
      assert.equal(acao(t), 'opt_out', `nao pegou: ${t}`)
    }
  })

  it('pega as formas que a pessoa escreve de verdade', () => {
    const frases = [
      'não quero mais receber essas mensagens',
      'nao quero receber mais nada',
      'para de me mandar mensagem',
      'pare de me encher',
      'me tira dessa lista',
      'me tire da lista por favor',
      'quero descadastrar',
      'cancelar o envio das mensagens',
      'não me mande mais mensagem',
    ]
    for (const t of frases) {
      assert.equal(acao(t), 'opt_out', `nao pegou: ${t}`)
    }
  })

  it('responde na hora, sem depender de IA', () => {
    const r = triar('parar')
    assert.ok(r.resposta && r.resposta.length > 10)
    assert.equal(r.motivo, 'pedido de opt-out')
  })

  it('NAO confunde cancelar o plano com sair da lista', () => {
    // Numa academia isso e quase sempre o contrato, nao a mensagem. Tratar
    // como opt-out silenciaria justo quem o dono mais precisa ouvir.
    for (const t of ['quero cancelar', 'como faço pra cancelar meu plano', 'vou cancelar a matrícula']) {
      assert.notEqual(acao(t), 'opt_out', `virou opt-out por engano: ${t}`)
    }
  })

  it('nao dispara em conversa normal', () => {
    for (const t of ['vou parar de faltar', 'saindo do trabalho agora', 'o aparelho parou de funcionar']) {
      assert.notEqual(acao(t), 'opt_out', `falso positivo: ${t}`)
    }
  })
})

describe('aluno irritado', () => {
  it('para de coletar e oferece humano', () => {
    const frases = [
      'que porra é essa',
      'tô de saco cheio dessa academia',
      'quero falar com o dono',
      'vou reclamar com o gerente',
      'isso é um lixo de atendimento',
      'vou no procon',
    ]
    for (const t of frases) {
      assert.equal(acao(t), 'chamar_humano', `nao pegou: ${t}`)
    }
  })

  it('reclamação comum não vira escalonamento', () => {
    for (const t of ['o ar condicionado tá ruim', 'o banheiro tava sujo ontem', 'achei o preço meio alto']) {
      assert.equal(acao(t), 'seguir', `escalou sem precisar: ${t}`)
    }
  })
})

describe('perguntou se é robô', () => {
  it('reconhece as formas comuns', () => {
    const frases = [
      'você é um robô?',
      'vc eh bot?',
      'isso é ia?',
      'você é humano?',
      'tô falando com uma pessoa ou com uma máquina',
      'vc é gente de verdade?',
    ]
    for (const t of frases) {
      assert.equal(acao(t), 'responder_robo', `nao pegou: ${t}`)
    }
  })

  it('a resposta assume que é automático, sem mentir', () => {
    const r = triar('você é um robô?')
    assert.match(r.resposta ?? '', /autom[áa]tico|sistema/i)
    assert.doesNotMatch(r.resposta ?? '', /sou (uma )?pessoa|sou humano/i)
  })
})

describe('conversa normal segue para a IA', () => {
  it('não intercepta o que é resposta de pesquisa', () => {
    for (const t of ['8', 'oito', 'pode sim', 'a climatização tá ruim de tarde', 'o professor Diego é gente boa']) {
      assert.equal(acao(t), 'seguir', `interceptou sem precisar: ${t}`)
    }
  })

  it('texto vazio não quebra', () => {
    assert.equal(acao(''), 'seguir')
    assert.equal(acao('   '), 'seguir')
  })
})
