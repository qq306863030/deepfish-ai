const axios = require('axios')
const { program } = require('commander')
const aiInquirer = require('../AgentRobot/BaseAgentRobot/utils/aiInquirer.js')
const aiConsole = require('../AgentRobot/BaseAgentRobot/utils/aiConsole.js')
const ConfigManager = require('./ConfigManager.js')
const { GlobalVariable } = require('./GlobalVariable.js')

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function secondsToISO(seconds) {
  if (!seconds || Number(seconds) <= 0) {
    return ''
  }
  return new Date(Date.now() + Number(seconds) * 1000).toISOString()
}

function getConfigManager() {
  return GlobalVariable.configManager || new ConfigManager()
}

async function githubDeviceLogin({
  configManager,
  targetName,
  currentAuth = {},
  saveToConfig = true,
} = {}) {
  const manager = configManager || getConfigManager()
  let aiConfig = null

  if (saveToConfig) {
    if (!targetName) {
      aiConsole.logError('No target AI configuration. Please pass a config name or set current AI first.')
      return null
    }
    aiConfig = manager.getAiConfig(targetName)
    if (!aiConfig) {
      aiConsole.logError(`Configuration with name "${targetName}" not found.`)
      return null
    }
    if (aiConfig.type !== 'github-models') {
      aiConsole.logError(
        `Configuration "${targetName}" is type "${aiConfig.type}". GitHub login only supports "github-models" type.`,
      )
      return null
    }
  }

  const authSeed = saveToConfig ? (aiConfig.githubAuth || {}) : (currentAuth || {})
  const questions = [
    {
      type: 'input',
      name: 'clientId',
      message: 'Enter GitHub OAuth App Client ID:',
      default: authSeed.clientId || process.env.GITHUB_OAUTH_CLIENT_ID || '',
      validate: (value) => !!String(value || '').trim() || 'Client ID is required',
    },
    {
      type: 'password',
      name: 'clientSecret',
      message: 'Enter GitHub OAuth App Client Secret (optional, needed for refresh in some OAuth app settings):',
      mask: '*',
      default: authSeed.clientSecret || process.env.GITHUB_OAUTH_CLIENT_SECRET || '',
    },
    {
      type: 'input',
      name: 'scope',
      message: 'Enter OAuth scope:',
      default: authSeed.scope || 'models:read',
    },
  ]

  const answers = await aiInquirer.askAny(questions)
  const clientId = String(answers.clientId || '').trim()
  const clientSecret = String(answers.clientSecret || '').trim()
  const scope = String(answers.scope || 'models:read').trim()

  let deviceCodeResponse
  try {
    const form = new URLSearchParams()
    form.set('client_id', clientId)
    form.set('scope', scope)

    const res = await axios.post(
      'https://github.com/login/device/code',
      form.toString(),
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 20000,
      },
    )
    deviceCodeResponse = res.data
  } catch (error) {
    const message = error?.response?.data?.error_description || error.message
    aiConsole.logError(`Failed to request GitHub device code: ${message}`)
    return null
  }

  const deviceCode = deviceCodeResponse.device_code
  const userCode = deviceCodeResponse.user_code
  const verificationUri = deviceCodeResponse.verification_uri || 'https://github.com/login/device'
  const expiresIn = Number(deviceCodeResponse.expires_in || 900)
  let intervalSec = Number(deviceCodeResponse.interval || 5)

  aiConsole.logSuccess('Please complete GitHub login in browser:')
  aiConsole.logInfo(`URL: ${verificationUri}`)
  aiConsole.logInfo(`Code: ${userCode}`)

  const deadline = Date.now() + expiresIn * 1000

  while (Date.now() < deadline) {
    await sleep(intervalSec * 1000)
    try {
      const form = new URLSearchParams()
      form.set('client_id', clientId)
      form.set('device_code', deviceCode)
      form.set('grant_type', 'urn:ietf:params:oauth:grant-type:device_code')

      const res = await axios.post(
        'https://github.com/login/oauth/access_token',
        form.toString(),
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 20000,
        },
      )
      const tokenData = res.data || {}

      if (tokenData.error) {
        if (tokenData.error === 'authorization_pending') {
          continue
        }
        if (tokenData.error === 'slow_down') {
          intervalSec = Number(tokenData.interval || intervalSec + 5)
          continue
        }
        if (tokenData.error === 'expired_token') {
          aiConsole.logError('Device code expired. Please run the login command again.')
          return null
        }
        if (tokenData.error === 'access_denied') {
          aiConsole.logError('GitHub authorization denied by user.')
          return null
        }
        aiConsole.logError(tokenData.error_description || tokenData.error)
        return null
      }

      if (!tokenData.access_token) {
        aiConsole.logError('GitHub login failed: no access_token returned.')
        return null
      }

      const githubAuthPatch = {
        provider: 'github-oauth-device',
        clientId,
        clientSecret,
        scope,
        tokenType: tokenData.token_type || 'bearer',
        accessTokenExpiresAt: secondsToISO(tokenData.expires_in),
        refreshToken: tokenData.refresh_token || '',
        refreshTokenExpiresAt: secondsToISO(tokenData.refresh_token_expires_in),
        lastUpdatedAt: new Date().toISOString(),
      }

      if (saveToConfig) {
        manager.updateAiConfigByName(targetName, (current) => {
          return {
            ...current,
            apiKey: tokenData.access_token,
            githubAuth: {
              ...(current.githubAuth || {}),
              ...githubAuthPatch,
            },
          }
        })
      }

      aiConsole.logSuccess('GitHub login success.')
      if (githubAuthPatch.accessTokenExpiresAt) {
        aiConsole.logInfo(`Access token expires at: ${githubAuthPatch.accessTokenExpiresAt}`)
      }
      if (!githubAuthPatch.refreshToken) {
        aiConsole.logInfo('No refresh token returned. Re-login may be required after access token expires.')
      }

      return {
        accessToken: tokenData.access_token,
        githubAuth: githubAuthPatch,
      }
    } catch (error) {
      const message = error?.response?.data?.error_description || error.message
      aiConsole.logError(`Polling GitHub token failed: ${message}`)
      return null
    }
  }

  aiConsole.logError('GitHub login timeout. Please run the command again.')
  return null
}

const authCommand = program
  .command('auth')
  .description('Authenticate third-party model providers')

authCommand
  .command('github-login [name]')
  .description('Login with GitHub account (Device Flow) and store short-lived token into a github-models config')
  .action(async (name) => {
    const configManager = getConfigManager()
    const targetName = name || configManager.getCurrentAi()
    const res = await githubDeviceLogin({
      configManager,
      targetName,
      saveToConfig: true,
    })
    if (res) {
      aiConsole.logSuccess(`Token has been saved to AI config "${targetName}".`)
    }
  })

module.exports = {
  githubDeviceLogin,
}
