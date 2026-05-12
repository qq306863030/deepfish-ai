const axios = require('axios')

async function getAvailableModels(accessToken) {
  try {
    const response = await axios.get('https://api.githubcopilot.com/models', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    })

    const models = response.data?.data || []
    console.log('\n✅ 可用的模型列表：\n')
    models.forEach((model) => {
      console.log(`  - ${model.id}: ${model.name}`)
      console.log(`    支持工具调用: ${model.capabilities?.supports?.tool_calls ?? false}`)
      console.log(`    支持视觉: ${model.capabilities?.supports?.vision ?? false}`)
      console.log()
    })

    return models.map((m) => m.id)
  } catch (error) {
    console.error('❌ 错误:', error.response?.data || error.message)
    process.exit(1)
  }
}

// 从命令行参数获取 token
const token = process.argv[2]
if (!token) {
  console.error('❌ 使用方法: node test-copilot-models.js <access_token>')
  console.error('\n示例:')
  console.error('  node test-copilot-models.js ghu_xxxxxxxxxxxxxx')
  process.exit(1)
}

getAvailableModels(token)
