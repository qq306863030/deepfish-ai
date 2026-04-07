import test from 'node:test'
import assert from 'node:assert/strict'
import MessageCompresser from '../src/AgentRobot/BaseAgentRobot/utils/MessageCompresser.js'

function createRobotBrain() {
  return {
    maxContextLength: 0.001,
    emit: () => {},
    thinkSkill: async (_systemPrompt, summaryPrompt) => {
      return `[SUMMARY] ${summaryPrompt.slice(0, 40)}`
    },
  }
}

test('compress 保留第一条 system、最后一条 user 与最后两条消息，其余做摘要', async () => {
  const robotBrain = createRobotBrain()
  const compresser = new MessageCompresser(robotBrain)

  const messages = [
    { role: 'system', content: 'S1-old-system' },
    { role: 'user', content: 'U1-old-user' },
    { role: 'assistant', content: 'A1-old-assistant' },
    { role: 'system', content: 'S2-last-system' },
    { role: 'user', content: 'U2-last-user' },
    { role: 'assistant', content: 'A2-keep-last-2-first' },
    { role: 'tool', content: 'T2-keep-last-2-second' },
  ]

  await compresser.compress(messages)

  const contents = messages.map((m) => m.content)

  assert.ok(contents.includes('S1-old-system'))
  assert.ok(contents.includes('U2-last-user'))
  assert.ok(contents.includes('A2-keep-last-2-first'))
  assert.ok(contents.includes('T2-keep-last-2-second'))

  assert.ok(
    messages.some((m) => m.role === 'user' && String(m.content) !== 'U2-last-user'),
    '应产生至少一条摘要消息',
  )

  const lastTwo = messages.slice(-2)
  assert.deepEqual(lastTwo, [
    { role: 'assistant', content: 'A2-keep-last-2-first' },
    { role: 'tool', content: 'T2-keep-last-2-second' },
  ])
})
