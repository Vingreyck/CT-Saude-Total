import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { normalizarTelefone, podeReceberWhatsapp } from './telefone.js'

const e164 = (s: string) => {
  const r = normalizarTelefone(s)
  return r.valido ? r.e164 : `INVALIDO(${r.motivo})`
}

describe('formatos que a recepção digita de verdade', () => {
  it('aceita todos e devolve o mesmo E.164', () => {
    const mesmos = [
      '(11) 99999-8888',
      '11999998888',
      '+55 11 99999-8888',
      '55 11 99999 8888',
      '011 99999-8888',
      '11 9 9999 8888',
    ]
    for (const t of mesmos) {
      assert.equal(e164(t), '+5511999998888', `falhou em: ${t}`)
    }
  })
})

describe('cadastro antigo sem o nono digito', () => {
  it('recoloca o 9 em celular', () => {
    assert.equal(e164('(11) 9999-8888'), '+5511999998888')
  })

  it('nao mexe em telefone fixo', () => {
    assert.equal(e164('(11) 3333-4444'), '+551133334444')
  })
})

describe('lixo de cadastro', () => {
  it('recusa vazio e curto', () => {
    assert.ok(e164('').startsWith('INVALIDO'))
    assert.ok(e164('9999').startsWith('INVALIDO'))
  })

  it('recusa DDD que nao existe', () => {
    assert.ok(e164('(00) 99999-8888').startsWith('INVALIDO'))
    assert.ok(e164('(10) 99999-8888').startsWith('INVALIDO'))
  })

  it('recusa digito repetido', () => {
    assert.ok(e164('11999999999').startsWith('INVALIDO'))
  })

  it('recusa numero longo demais', () => {
    assert.ok(e164('11999998888777').startsWith('INVALIDO'))
  })
})

describe('quem entra no disparo', () => {
  it('celular entra, fixo nao', () => {
    assert.equal(podeReceberWhatsapp('(11) 99999-8888'), true)
    assert.equal(podeReceberWhatsapp('(11) 3333-4444'), false)
    assert.equal(podeReceberWhatsapp(null), false)
  })
})
