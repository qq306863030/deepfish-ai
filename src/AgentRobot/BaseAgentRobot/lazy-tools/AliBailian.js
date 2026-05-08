const fs = require('fs-extra')
const path = require('path')

// 阿里百炼官方推荐 Base URL (OpenAI 兼容模式)
const REQUIRED_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'

// 模型常量
const MODEL_TEXT_TO_IMAGE = 'wanx2.1-t2i-turbo'
const MODEL_TEXT_TO_VIDEO = 'wanx2.1-t2v-turbo'
const MODEL_IMAGE_RECOGNITION = 'qwen-vl-max'
const MODEL_TEXT_TO_SPEECH = 'qwen-tts'
const MODEL_SPEECH_TO_TEXT = 'qwen-audio-asr'

// 音频默认参数
const DEFAULT_TTS_VOICE = 'Cherry'
const DEFAULT_TTS_FORMAT = 'mp3'

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
	const lower = normalized.toLowerCase()
	// coding 子域用于 OpenAI 兼容调用，AIGC 服务接口需走 dashscope 主域
	if (lower.includes('coding.dashscope.aliyuncs.com')) {
		return 'https://dashscope.aliyuncs.com'
	}
	if (lower.endsWith('/compatible-mode/v1')) {
		return normalized.replace(/\/compatible-mode\/v1$/i, '')
	}
	if (lower.endsWith('/v1')) {
		return normalized.replace(/\/v1$/i, '')
	}
	return normalized
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

function getExtFromUrl(url) {
	try {
		const u = new URL(url)
		const ext = path.extname(u.pathname || '').toLowerCase()
		if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'].includes(ext)) {
			return ext
		}
		return '.png'
	} catch {
		return '.png'
	}
}

function getMediaExtFromUrl(url, fallbackExt = '.bin') {
	try {
		const u = new URL(url)
		const ext = path.extname(u.pathname || '').toLowerCase()
		return ext || fallbackExt
	} catch {
		return fallbackExt
	}
}

function collectImageUrls(payload) {
	const urls = new Set()

	function visit(node) {
		if (!node) return
		if (typeof node === 'string') {
			if (/^https?:\/\//i.test(node) && /\.(png|jpe?g|webp|gif|bmp)(\?|$)/i.test(node)) {
				urls.add(node)
			}
			return
		}
		if (Array.isArray(node)) {
			node.forEach((item) => visit(item))
			return
		}
		if (typeof node === 'object') {
			const directCandidates = [
				node.url,
				node.image_url,
				node.imageUrl,
				node.result_url,
				node.resultUrl,
			]
			directCandidates.forEach((item) => visit(item))
			Object.values(node).forEach((value) => visit(value))
		}
	}

	visit(payload)
	return Array.from(urls)
}

function collectMediaUrls(payload, type = 'video') {
	const urls = new Set()
	const regexByType = {
		video: /\.(mp4|mov|m4v|webm|avi|mkv)(\?|$)/i,
		audio: /\.(mp3|wav|pcm|opus|aac|flac|m4a)(\?|$)/i,
	}
	const matcher = regexByType[type] || regexByType.video

	function visit(node) {
		if (!node) return
		if (typeof node === 'string') {
			if (/^https?:\/\//i.test(node) && matcher.test(node)) {
				urls.add(node)
			}
			return
		}
		if (Array.isArray(node)) {
			node.forEach((item) => visit(item))
			return
		}
		if (typeof node === 'object') {
			Object.values(node).forEach((value) => visit(value))
		}
	}

	visit(payload)
	return Array.from(urls)
}

async function downloadImagesToCwd(ctx, imageUrls = []) {
	const cwd = process.cwd()
	const downloadedFiles = []

	for (let i = 0; i < imageUrls.length; i += 1) {
		const url = imageUrls[i]
		const ext = getExtFromUrl(url)
		const fileName = `bailian_image_${Date.now()}_${i + 1}${ext}`
		const outputPath = path.join(cwd, fileName)
		const response = await ctx.axios.get(url, {
			responseType: 'arraybuffer',
			timeout: 180000,
		})
		fs.writeFileSync(outputPath, response.data)
		downloadedFiles.push(outputPath)
	}

	return downloadedFiles
}

async function downloadMediaToCwd(ctx, mediaUrls = [], prefix = 'bailian_media', fallbackExt = '.bin') {
	const cwd = process.cwd()
	const downloadedFiles = []

	for (let i = 0; i < mediaUrls.length; i += 1) {
		const url = mediaUrls[i]
		const ext = getMediaExtFromUrl(url, fallbackExt)
		const fileName = `${prefix}_${Date.now()}_${i + 1}${ext}`
		const outputPath = path.join(cwd, fileName)
		const response = await ctx.axios.get(url, {
			responseType: 'arraybuffer',
			timeout: 240000,
		})
		fs.writeFileSync(outputPath, response.data)
		downloadedFiles.push(outputPath)
	}

	return downloadedFiles
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

function getAudioExt(format = DEFAULT_TTS_FORMAT) {
	const fmt = String(format || '').toLowerCase()
	if (['mp3', 'wav', 'pcm', 'opus', 'aac', 'flac'].includes(fmt)) {
		return fmt === 'pcm' ? 'pcm' : fmt
	}
	return DEFAULT_TTS_FORMAT
}

async function saveAudioToCwd(buffer, format = DEFAULT_TTS_FORMAT, outputFileName = '') {
	const cwd = process.cwd()
	const ext = getAudioExt(format)
	const fileName = outputFileName
		? outputFileName
		: `bailian_audio_${Date.now()}.${ext}`
	const outputPath = path.join(cwd, fileName)
	fs.writeFileSync(outputPath, buffer)
	return outputPath
}

async function saveTextToCwd(text, prefix = 'bailian_text', ext = '.txt') {
	const outputPath = path.join(process.cwd(), `${prefix}_${Date.now()}${ext}`)
	fs.writeFileSync(outputPath, String(text || ''), 'utf8')
	return outputPath
}

async function saveJsonToCwd(data, prefix = 'bailian_result') {
	const outputPath = path.join(process.cwd(), `${prefix}_${Date.now()}.json`)
	fs.writeJsonSync(outputPath, data, { spaces: 2 })
	return outputPath
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
	model = MODEL_TEXT_TO_IMAGE,
	size = '1024*1024',
	n = 1,
	autoPoll = true,
	autoDownload = true,
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
			const imageUrls = collectImageUrls(data)
			let downloadedFiles = []
			const savedResultFile = await saveJsonToCwd(data, 'bailian_image_result')
			if (autoDownload && imageUrls.length > 0) {
				downloadedFiles = await downloadImagesToCwd(this, imageUrls)
			}
			return ok({
				taskId,
				status: parseTaskStatus(data) || 'PENDING',
				imageUrls,
				downloadedFiles,
				savedResultFile,
				response: data,
			})
		}
		const pollResult = await pollTaskResult(this, taskId)
		if (!pollResult.success) {
			return pollResult
		}
		const imageUrls = collectImageUrls(pollResult.data?.task)
		let downloadedFiles = []
		const savedResultFile = await saveJsonToCwd(
			pollResult.data?.task || {},
			'bailian_image_result',
		)
		if (autoDownload && imageUrls.length > 0) {
			downloadedFiles = await downloadImagesToCwd(this, imageUrls)
		}
		return ok({
			...pollResult.data,
			imageUrls,
			downloadedFiles,
			savedResultFile,
		})
	} catch (error) {
		return fail(error, { prompt, model, size, n, autoPoll, autoDownload })
	}
}

/**
 * 阿里百炼文生视频
 * 接口: POST /api/v1/services/aigc/video-generation/video-synthesis
 */
async function aliBailianTextToVideo(
	prompt,
	model = MODEL_TEXT_TO_VIDEO,
	size = '1280*720',
	duration = 5,
	autoPoll = true,
	autoDownload = true,
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
			const videoUrls = collectMediaUrls(data, 'video')
			let downloadedFiles = []
			const savedResultFile = await saveJsonToCwd(data, 'bailian_video_result')
			if (autoDownload && videoUrls.length > 0) {
				downloadedFiles = await downloadMediaToCwd(this, videoUrls, 'bailian_video', '.mp4')
			}
			return ok({
				taskId,
				status: parseTaskStatus(data) || 'PENDING',
				videoUrls,
				downloadedFiles,
				savedResultFile,
				response: data,
			})
		}
		const pollResult = await pollTaskResult(this, taskId, 5000, 60)
		if (!pollResult.success) {
			return pollResult
		}
		const videoUrls = collectMediaUrls(pollResult.data?.task, 'video')
		let downloadedFiles = []
		const savedResultFile = await saveJsonToCwd(
			pollResult.data?.task || {},
			'bailian_video_result',
		)
		if (autoDownload && videoUrls.length > 0) {
			downloadedFiles = await downloadMediaToCwd(this, videoUrls, 'bailian_video', '.mp4')
		}
		return ok({
			...pollResult.data,
			videoUrls,
			downloadedFiles,
			savedResultFile,
		})
	} catch (error) {
		return fail(error, { prompt, model, size, duration, autoPoll, autoDownload })
	}
}

/**
 * 阿里百炼图片识别 (多模态对话)
 * 接口: POST /compatible-mode/v1/chat/completions
 */
async function aliBailianImageRecognition(
	imagePath,
	question = '请详细描述这张图片内容。',
	model = MODEL_IMAGE_RECOGNITION,
	autoSave = true,
	outputFileName = '',
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
		let savedTextFile = ''
		let savedResultFile = ''
		if (autoSave) {
			savedTextFile = outputFileName
				? path.join(process.cwd(), outputFileName)
				: await saveTextToCwd(content, 'bailian_image_recognition', '.txt')
			if (outputFileName) {
				fs.writeFileSync(savedTextFile, String(content || ''), 'utf8')
			}
			savedResultFile = await saveJsonToCwd(data, 'bailian_image_recognition_result')
		}
		return ok({
			imagePath: fullPath,
			question,
			model,
			content,
			savedTextFile,
			savedResultFile,
			response: data,
		})
	} catch (error) {
		return fail(error, { imagePath, question, model, autoSave, outputFileName })
	}
}

/**
 * 阿里百炼文字转语音 (OpenAI 兼容音频接口)
 * 接口: POST /audio/speech
 */
async function aliBailianTextToSpeech(
	text,
	model = MODEL_TEXT_TO_SPEECH,
	voice = DEFAULT_TTS_VOICE,
	format = DEFAULT_TTS_FORMAT,
	autoDownload = true,
	outputFileName = '',
) {
	try {
		assertSkillAvailability(this)
		if (!text) {
			return fail('text is required')
		}
		const { baseUrl, apiKey } = getAiConfig(this)
		const url = joinUrl(baseUrl, 'audio/speech')
		const response = await this.axios.post(
			url,
			{
				model,
				input: text,
				voice,
				format,
			},
			{
				headers: {
					Authorization: `Bearer ${apiKey}`,
					'Content-Type': 'application/json',
				},
				responseType: 'arraybuffer',
				timeout: 180000,
			},
		)

		const audioBuffer = Buffer.from(response.data)
		let downloadedFile = ''
		if (autoDownload) {
			downloadedFile = await saveAudioToCwd(audioBuffer, format, outputFileName)
		}

		return ok({
			model,
			voice,
			format: getAudioExt(format),
			audioSize: audioBuffer.length,
			downloadedFile,
		})
	} catch (error) {
		return fail(error, {
			text,
			model,
			voice,
			format,
			autoDownload,
			outputFileName,
		})
	}
}

/**
 * 阿里百炼语音转文字 (OpenAI 兼容音频接口)
 * 接口: POST /audio/transcriptions
 */
async function aliBailianSpeechToText(
	audioPath,
	model = MODEL_SPEECH_TO_TEXT,
	language = 'zh',
	prompt = '',
	autoSave = true,
	outputFileName = '',
) {
	try {
		assertSkillAvailability(this)
		if (!audioPath) {
			return fail('audioPath is required')
		}
		const fullPath = path.resolve(process.cwd(), audioPath)
		if (!fs.existsSync(fullPath)) {
			return fail(`Audio file does not exist: ${fullPath}`)
		}
		if (typeof FormData === 'undefined' || typeof Blob === 'undefined') {
			return fail('Current Node.js runtime does not support FormData/Blob for audio upload')
		}

		const { baseUrl, apiKey } = getAiConfig(this)
		const url = joinUrl(baseUrl, 'audio/transcriptions')
		const fileBuffer = fs.readFileSync(fullPath)
		const form = new FormData()
		form.append('file', new Blob([fileBuffer]), path.basename(fullPath))
		form.append('model', model)
		if (language) {
			form.append('language', language)
		}
		if (prompt) {
			form.append('prompt', prompt)
		}

		const extraHeaders =
			typeof form.getHeaders === 'function' ? form.getHeaders() : {}
		const response = await this.axios.post(url, form, {
			headers: {
				Authorization: `Bearer ${apiKey}`,
				...extraHeaders,
			},
			timeout: 180000,
		})
		const data = response.data || {}
		let savedTextFile = ''
		let savedResultFile = ''
		if (autoSave) {
			savedTextFile = outputFileName
				? path.join(process.cwd(), outputFileName)
				: await saveTextToCwd(data.text || '', 'bailian_stt', '.txt')
			if (outputFileName) {
				fs.writeFileSync(savedTextFile, String(data.text || ''), 'utf8')
			}
			savedResultFile = await saveJsonToCwd(data, 'bailian_stt_result')
		}

		return ok({
			audioPath: fullPath,
			model,
			language,
			text: data.text || '',
			savedTextFile,
			savedResultFile,
			response: data,
		})
	} catch (error) {
		return fail(error, { audioPath, model, language, prompt, autoSave, outputFileName })
	}
}

async function aliBailianGetTaskResult(taskId, autoDownload = true) {
	try {
		assertSkillAvailability(this)
		if (!taskId) {
			return fail('taskId is required')
		}
		const result = await pollTaskResult(this, taskId, 0, 1)
		if (!result.success) {
			return result
		}
		const taskPayload = result.data?.task || {}
		const imageUrls = collectImageUrls(taskPayload)
		const videoUrls = collectMediaUrls(taskPayload, 'video')
		const savedResultFile = await saveJsonToCwd(taskPayload, 'bailian_task_result')
		let downloadedImageFiles = []
		let downloadedVideoFiles = []
		if (autoDownload && imageUrls.length > 0) {
			downloadedImageFiles = await downloadImagesToCwd(this, imageUrls)
		}
		if (autoDownload && videoUrls.length > 0) {
			downloadedVideoFiles = await downloadMediaToCwd(this, videoUrls, 'bailian_video', '.mp4')
		}
		return ok({
			...result.data,
			imageUrls,
			videoUrls,
			downloadedImageFiles,
			downloadedVideoFiles,
			savedResultFile,
		})
	} catch (error) {
		return fail(error, { taskId, autoDownload })
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
			name: 'aliBailianTextToSpeech',
			description:
				'阿里百炼文字转语音：将文本合成为语音。默认自动下载到当前工作目录。',
			parameters: {
				type: 'object',
				properties: {
					text: {
						type: 'string',
						description: '要合成语音的文本内容。',
					},
					model: {
						type: 'string',
						description: `文字转语音模型名，默认 ${MODEL_TEXT_TO_SPEECH}。`,
					},
					voice: {
						type: 'string',
						description: `音色名称，默认 ${DEFAULT_TTS_VOICE}。`,
					},
					format: {
						type: 'string',
						description: `音频格式（mp3/wav/opus 等），默认 ${DEFAULT_TTS_FORMAT}。`,
					},
					autoDownload: {
						type: 'boolean',
						description: '是否自动下载到当前工作目录，默认 true。',
					},
					outputFileName: {
						type: 'string',
						description: '可选，自定义输出文件名（如 my_tts.mp3）。',
					},
				},
				required: ['text'],
			},
		},
	},
	{
		type: 'function',
		function: {
			name: 'aliBailianSpeechToText',
			description:
				'阿里百炼语音转文字：上传本地音频文件并返回识别文本。',
			parameters: {
				type: 'object',
				properties: {
					audioPath: {
						type: 'string',
						description: '本地音频路径（相对路径或绝对路径）。',
					},
					model: {
						type: 'string',
						description: `语音转文字模型名，默认 ${MODEL_SPEECH_TO_TEXT}。`,
					},
					language: {
						type: 'string',
						description: '识别语言，默认 zh。',
					},
					prompt: {
						type: 'string',
						description: '可选，识别提示词。',
					},
					autoSave: {
						type: 'boolean',
						description: '是否自动保存识别文本和原始结果到当前工作目录，默认 true。',
					},
					outputFileName: {
						type: 'string',
						description: '可选，自定义转写文本文件名。',
					},
				},
				required: ['audioPath'],
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
						description: `文生图模型名，默认 ${MODEL_TEXT_TO_IMAGE}。`,
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
					autoDownload: {
						type: 'boolean',
						description: '是否自动下载生成图片到当前工作目录，默认 true。',
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
						description: `文生视频模型名，默认 ${MODEL_TEXT_TO_VIDEO}。`,
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
					autoDownload: {
						type: 'boolean',
						description: '是否自动下载生成视频到当前工作目录，默认 true。',
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
						description: `多模态模型名，默认 ${MODEL_IMAGE_RECOGNITION}。`,
					},
					autoSave: {
						type: 'boolean',
						description: '是否自动保存识别文本和原始结果到当前工作目录，默认 true。',
					},
					outputFileName: {
						type: 'string',
						description: '可选，自定义识别文本文件名。',
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
					autoDownload: {
						type: 'boolean',
						description: '是否自动下载任务中的图片/视频并保存结果JSON到当前工作目录，默认 true。',
					},
				},
				required: ['taskId'],
			},
		},
	},
]

const functions = {
	aliBailianReadme,
	aliBailianTextToSpeech,
	aliBailianSpeechToText,
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
