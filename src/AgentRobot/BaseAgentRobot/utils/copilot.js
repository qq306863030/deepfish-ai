const axios = require('axios')
const { GlobalVariable } = require('../../../cli/GlobalVariable.js')

function isExpiring(isoTime, thresholdSec = 120) {
	if (!isoTime) {
		return false
	}
	const target = new Date(isoTime).getTime()
	if (!Number.isFinite(target)) {
		return false
	}
	return target - Date.now() <= thresholdSec * 1000
}

function secondsToISO(seconds) {
	if (!seconds || Number(seconds) <= 0) {
		return ''
	}
	return new Date(Date.now() + Number(seconds) * 1000).toISOString()
}

async function refreshGithubModelsTokenIfNeeded(aiConfig = {}) {
	if (aiConfig.type !== 'github-models' && aiConfig.type !== 'copilot') {
		return
	}
	const githubAuth = aiConfig.githubAuth || {}
	if (!isExpiring(githubAuth.accessTokenExpiresAt)) {
		return
	}
	if (!githubAuth.refreshToken) {
		throw new Error(
			'GitHub access token expired and no refresh token is available. Please run "ai auth github-login" again.',
		)
	}
	if (!githubAuth.clientId || !githubAuth.clientSecret) {
		throw new Error(
			'GitHub token refresh requires clientId and clientSecret. Please run "ai auth github-login" and provide both values.',
		)
	}
	if (isExpiring(githubAuth.refreshTokenExpiresAt, 0)) {
		throw new Error(
			'GitHub refresh token expired. Please run "ai auth github-login" again.',
		)
	}

	const form = new URLSearchParams()
	form.set('client_id', githubAuth.clientId)
	form.set('client_secret', githubAuth.clientSecret)
	form.set('grant_type', 'refresh_token')
	form.set('refresh_token', githubAuth.refreshToken)

	const response = await axios.post(
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

	const tokenData = response.data || {}
	if (!tokenData.access_token) {
		const errMessage = tokenData.error_description || tokenData.error || 'Unknown token refresh error'
		throw new Error(`GitHub token refresh failed: ${errMessage}`)
	}

	const newAuth = {
		...githubAuth,
		tokenType: tokenData.token_type || githubAuth.tokenType || 'bearer',
		accessTokenExpiresAt: secondsToISO(tokenData.expires_in),
		refreshToken: tokenData.refresh_token || githubAuth.refreshToken,
		refreshTokenExpiresAt: tokenData.refresh_token_expires_in
			? secondsToISO(tokenData.refresh_token_expires_in)
			: githubAuth.refreshTokenExpiresAt,
		lastUpdatedAt: new Date().toISOString(),
	}

	aiConfig.apiKey = tokenData.access_token
	aiConfig.githubAuth = newAuth

	const configManager = GlobalVariable.configManager
	if (configManager && aiConfig.name && configManager.updateAiConfigByName) {
		configManager.updateAiConfigByName(aiConfig.name, (current) => {
			return {
				...current,
				apiKey: tokenData.access_token,
				githubAuth: {
					...(current.githubAuth || {}),
					...newAuth,
				},
			}
		})
	}
}

function buildDefaultHeaders(aiConfig = {}) {
	if (aiConfig.type === 'github-models') {
		return {
			Accept: 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2026-03-10',
		}
	}
	if (aiConfig.type === 'copilot') {
		return {
			'Openai-Intent': 'conversation-edits',
		}
	}
	return undefined
}

module.exports = {
	refreshGithubModelsTokenIfNeeded,
	buildDefaultHeaders,
}
