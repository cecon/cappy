/**
 * @fileoverview Unit tests for SessionStore.
 * @module tests/session-store
 */

import { describe, expect, it } from 'vitest'
import { SessionStore } from '../../src/nivel2/application/session/SessionStore'

describe('SessionStore', () => {
  it('cria sessão com modo inicial', () => {
    const store = new SessionStore()
    const session = store.createSession('planning')

    expect(session.id).toContain('session-')
    expect(session.mode).toBe('planning')
    expect(session.messages).toHaveLength(0)
  })

  it('adiciona mensagens e mantém histórico', () => {
    const store = new SessionStore()
    const session = store.createSession('planning')

    store.appendMessage(session.id, { role: 'user', content: 'hello', mode: 'planning' })
    store.appendMessage(session.id, { role: 'assistant', content: 'world', mode: 'planning' })

    const sessions = store.listSessions()
    expect(sessions[0].messages).toHaveLength(2)
    expect(sessions[0].messages[0].role).toBe('user')
    expect(sessions[0].messages[1].role).toBe('assistant')
  })
})

