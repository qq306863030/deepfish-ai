const fs = require('fs-extra')
const path = require('path')

// 阿里百炼官方推荐 Base URL (OpenAI 兼容模式)
const REQUIRED_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'

function ok(data = null) {
	return { success: true, data }
}

function fail(error, data = null) {
	return {
		success: false,
		error: error?.message || String(error),
		data,
	}
}

function getAiConfig(ctx) {
	const aiConfig = ctx?.agentRobot?.aiConfig || {}
	const baseUrl = String(aiConfig.baseUrl || '').trim()
	const apiKey = String(aiConfig.apiKey || '').trim()

	if (!baseUrl) {
		throw new Error('aiConfig.baseUrl is empty, please configure AI baseUrl first')
	}
	if (!apiKey) {
		throw new Error('aiConfig.apiKey is empty, please configure AI apiKey first')
	}
	return { baseUrl, apiKey }
}

function checkSkillAvailability(ctx) {
	const { baseUrl } = getAiConfig(ctx)
	// 检查是否包含 dashscope.aliyuncs.com
	const normalized = String(baseUrl || '').toLowerCase()
	const canUse = normalized.includes('dashscope.aliyuncs.com')
	return {
		canUse,
		baseUrl,
		requiredBaseUrl: REQUIRED_BASE_URL,
		reason: canUse
			? 'AliBailian skill is available.'
			: `AliBailian skill is unavailable. aiConfig.baseUrl must contain 'dashscope.aliyuncs.com'.`,
	}
}

function assertSkillAvailability(ctx) {
	const checkResult = checkSkillAvailability(ctx)
	if (!checkResult.canUse) {
		throw new Error(checkResult.reason)
	}
}

function getRootBaseUrl(baseUrl) {
	const normalized = String(baseUrl || '').replace(/\/+$/, '')
	// 移除兼容模式路径后缀，获取根域名
	return normalized.replace(/\/compatible-mode\/v1$/i, '')
}

function joinUrl(baseUrl, endpoint) {
	return `${String(baseUrl || '').replace(/\/+$/, '')}/${String(endpoint || '').replace(/^\/+/, '')}`
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

function buildImageDataUrl(imagePath) {
	const fullPath = path.resolve(process.cwd(), imagePath)
	if (!fs.existsSync(fullPath)) {
		throw new Error(`Image file does not exist: ${fullPath}`)
	}
	const ext = path.extname(fullPath).toLowerCase()
	const mimeTypeMap = {
		'.png': 'image/png',
		'.jpg': 'image/jpeg',
		'.jpeg': 'image/jpeg',
		'.webp': 'image/webp',
		'.gif': 'image/gif',
		'.bmp': 'image/bmp',
	}
	const mimeType = mimeTypeMap[ext] || 'application/octet-stream'
	const base64 = fs.readFileSync(fullPath).toString('base64')
	return {
		dataUrl: `data:${mimeType};base64,${base64}`,
		fullPath,
	}
}

async function postJson(ctx, url, body, timeout = 180000, headers = {}) {
	const { apiKey } = getAiConfig(ctx)
	const defaultHeaders = {
		Authorization: `Bearer ${apiKey}`,
		'Content-Type': 'application/json',
		'X-DashScope-Async': 'enable', // 默认开启异步任务（适用于生图/生视频）
		...headers,
	}
	const response = await ctx.axios.post(url, body, {
		headers: defaultHeaders,
		timeout,
	})
	return response.data
}

async function getJson(ctx, url, timeout = 120000) {
	const { apiKey } = getAiConfig(ctx)
	const headers = {
		Authorization: `Bearer ${apiKey}`,
	}
	const response = await ctx.axios.get(url, { headers, timeout })
	return response.data
}

function parseTaskId(data) {
	return (
		data?.output?.task_id ||
		data?.output?.taskId ||
		data?.task_id ||
		data?.taskId ||
		data?.request_id ||
		''
	)
}

function parseTaskStatus(data) {
	return (
		data?.output?.task_status ||
		data?.output?.taskStatus ||
		data?.task_status ||
		data?.taskStatus ||
		''
	)
}

async function pollTaskResult(ctx, taskId, intervalMs = 3000, maxPoll = 40) {
	const { baseUrl } = getAiConfig(ctx)
	const rootBaseUrl = getRootBaseUrl(baseUrl)
	const taskUrl = joinUrl(rootBaseUrl, `api/v1/tasks/${taskId}`)

	let lastData = null
	for (let i = 0; i < maxPoll; i += 1) {
		const data = await getJson(ctx, taskUrl)
		lastData = data
		const status = String(parseTaskStatus(data)).toUpperCase()
		if (!status) {
			await sleep(intervalMs)
			continue
		}
		if (['SUCCEEDED', 'SUCCESS', 'COMPLETED'].includes(status)) {
			return ok({
				taskId,
				status,
				task: data,
			})
		}
		if (['FAILED', 'CANCELED', 'CANCELLED', 'ERROR'].includes(status)) {
			return fail('Task failed', {
				taskId,
				status,
				task: data,
			})
		}
		await sleep(intervalMs)
	}

	return fail('Task polling timeout', {
		taskId,
		task: lastData,
	})
}

/**
 * 阿里百炼文生图
 * 接口: POST /api/v1/services/aigc/text2image/image-synthesis
 */
async function aliBailianTextToImage(
	prompt,
	model = 'wanx2.1-t2i-turbo',
	size = '1024*1024',
	n = 1,
	autoPoll = true,
) {
	try {
		assertSkillAvailability(this)
		if (!prompt) {
			return fail('prompt is required')
		}
		const { baseUrl } = getAiConfig(this)
		const rootBaseUrl = getRootBaseUrl(baseUrl)
		const url = joinUrl(rootBaseUrl, 'api/v1/services/aigc/text2image/image-synthesis')
		const body = {
			model,
			input: { prompt },
			parameters: {
				size,
				n: Number(n) > 0 ? Number(n) : 1,
			},
		}
		const data = await postJson(this, url, body)
		const taskId = parseTaskId(data)

		if (!autoPoll || !taskId) {
			return ok({
				taskId,
				status: parseTaskStatus(data) || 'PENDING',
				response: data,
			})
		}
		return pollTaskResult(this, taskId)
	} catch (error) {
		return fail(error, { prompt, model, size, n, autoPoll })
	}
}

/**
 * 阿里百炼文生视频
 * 接口: POST /api/v1/services/aigc/video-generation/video-synthesis
 */
async function aliBailianTextToVideo(
	prompt,
	model = 'wanx2.1-t2v-turbo',
	size = '1280*720',
	duration = 5,
	autoPoll = true,
) {
	try {
		assertSkillAvailability(this)
		if (!prompt) {
			return fail('prompt is required')
		}
		const { baseUrl } = getAiConfig(this)
		const rootBaseUrl = getRootBaseUrl(baseUrl)
		const url = joinUrl(rootBaseUrl, 'api/v1/services/aigc/video-generation/video-synthesis')
		const body = {
			model,
			input: { prompt },
			parameters: {
				size,
				duration: Number(duration) > 0 ? Number(duration) : 5,
			},
		}
		const data = await postJson(this, url, body, 240000)
		const taskId = parseTaskId(data)

		if (!autoPoll || !taskId) {
			return ok({
				taskId,
				status: parseTaskStatus(data) || 'PENDING',
				response: data,
			})
		}
		return pollTaskResult(this, taskId, 5000, 60)
	} catch (error) {
		return fail(error, { prompt, model, size, duration, autoPoll })
	}
}

/**
 * 阿里百炼图片识别 (多模态对话)
 * 接口: POST /compatible-mode/v1/chat/completions
 */
async function aliBailianImageRecognition(
	imagePath,
	question = '请详细描述这张图片内容。',
	model = 'qwen-vl-max',
) {
	try {
		assertSkillAvailability(this)
		if (!imagePath) {
			return fail('imagePath is required')
		}

		const { dataUrl, fullPath } = buildImageDataUrl(imagePath)
		const { baseUrl } = getAiConfig(this)
		// 直接使用 baseUrl，因为 baseUrl 通常是 compatible-mode/v1
		const chatUrl = joinUrl(baseUrl, 'chat/completions')

		const body = {
			model,
			messages: [
				{
					role: 'user',
					content: [
						{
							type: 'text',
							text: question,
						},
						{
							type: 'image_url',
							image_url: {
								url: dataUrl,
							},
						},
					],
				},
			],
			stream: false,
		}

		// 多模态对话通常不需要 X-DashScope-Async 头，直接同步返回
		const { apiKey } = getAiConfig(this)
		const headers = {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		}
		const response = await this.axios.post(chatUrl, body, { headers, timeout: 180000 })
		const data = response.data
		const content = data?.choices?.[0]?.message?.content || ''
		return ok({
			imagePath: fullPath,
			question,
			model,
			content,
			response: data,
		})
	} catch (error) {
		return fail(error, { imagePath, question, model })
	}
}

async function aliBailianGetTaskResult(taskId) {
	try {
		assertSkillAvailability(this)
		if (!taskId) {
			return fail('taskId is required')
		}
		return pollTaskResult(this, taskId, 0, 1)
	} catch (error) {
		return fail(error, { taskId })
	}
}

function aliBailianReadme() {
	try {
		const checkResult = checkSkillAvailability(this)
		const statusText = checkResult.canUse ? 'Available' : 'Unavailable'
		const usageNote = checkResult.canUse
			? 'You can call aliBailianTextToImage, aliBailianTextToVideo, aliBailianImageRecognition and aliBailianGetTaskResult directly.'
			: `This skill is disabled because aiConfig.baseUrl must contain 'dashscope.aliyuncs.com'. Please update your AI config first.`

		return `# AliBailian Skill Guide\n\n- Status: ${statusText}\n- Current baseUrl: ${checkResult.baseUrl || '(empty)'}\n- Required baseUrl: ${checkResult.requiredBaseUrl}\n\n${usageNote}`
	} catch (error) {
		return `# AliBailian Skill Guide\n\n- Status: Unavailable\n- Reason: ${error?.message || String(error)}`
	}
}

const descriptions = [
	{
		type: 'function',
		function: {
			name: 'aliBailianReadme',
			description:
				'阿里百炼说明与可用性检测：先判断当前aiConfig.baseUrl是否配置正确，再返回工具说明。调用本工具前建议先调用此函数确认可用性。',
			parameters: {
				type: 'object',
				properties: {},
				required: [],
			},
		},
	},
	{
		type: 'function',
		function: {
			name: 'aliBailianTextToImage',
			description:
				'阿里百炼文生图：根据文本提示词生成图片。自动读取 this.agentRobot.aiConfig 中的 baseUrl 和 apiKey 进行调用。',
			parameters: {
				type: 'object',
				properties: {
					prompt: {
						type: 'string',
						description: '图片提示词。',
					},
					model: {
						type: 'string',
						description: '文生图模型名，默认 wanx2.1-t2i-turbo。',
					},
					size: {
						type: 'string',
						description: '图片尺寸，默认 1024*1024。',
					},
					n: {
						type: 'number',
						description: '生成图片数量，默认 1。',
					},
					autoPoll: {
						type: 'boolean',
						description: '是否自动轮询任务结果，默认 true。',
					},
				},
				required: ['prompt'],
			},
		},
	},
	{
		type: 'function',
		function: {
			name: 'aliBailianTextToVideo',
			description:
				'阿里百炼文生视频：根据文本提示词生成视频。自动读取 this.agentRobot.aiConfig 中的 baseUrl 和 apiKey 进行调用。',
			parameters: {
				type: 'object',
				properties: {
					prompt: {
						type: 'string',
						description: '视频提示词。',
					},
					model: {
						type: 'string',
						description: '文生视频模型名，默认 wanx2.1-t2v-turbo。',
					},
					size: {
						type: 'string',
						description: '视频尺寸，默认 1280*720。',
					},
					duration: {
						type: 'number',
						description: '视频时长（秒），默认 5。',
					},
					autoPoll: {
						type: 'boolean',
						description: '是否自动轮询任务结果，默认 true。',
					},
				},
				required: ['prompt'],
			},
		},
	},
	{
		type: 'function',
		function: {
			name: 'aliBailianImageRecognition',
			description:
				'阿里百炼图片识别：输入本地图片路径和问题，返回识别与理解结果。自动读取 this.agentRobot.aiConfig 中的 baseUrl 和 apiKey 进行调用。',
			parameters: {
				type: 'object',
				properties: {
					imagePath: {
						type: 'string',
						description: '本地图片路径（相对路径或绝对路径）。',
					},
					question: {
						type: 'string',
						description: '关于图片的问题，默认“请详细描述这张图片内容。”。',
					},
					model: {
						type: 'string',
						description: '多模态模型名，默认 qwen-vl-max。',
					},
				},
				required: ['imagePath'],
			},
		},
	},
	{
		type: 'function',
		function: {
			name: 'aliBailianGetTaskResult',
			description: '阿里百炼任务查询：根据 taskId 查询一次任务当前状态与结果。',
			parameters: {
				type: 'object',
				properties: {
					taskId: {
						type: 'string',
						description: '阿里百炼异步任务ID。',
					},
				},
				required: ['taskId'],
			},
		},
	},
]

const functions = {
	aliBailianReadme,
	aliBailianTextToImage,
	aliBailianTextToVideo,
	aliBailianImageRecognition,
	aliBailianGetTaskResult,
}

const AliBailianTool = {
	name: 'AliBailianTool',
	description:
		'提供阿里百炼多模态能力，包括文生图、文生视频、图片识别与任务查询，统一使用当前AI配置的baseUrl/apiKey。',
	platform: 'all',
	descriptions,
	functions,
	isSystem: true,
}

module.exports = AliBailianTool
