export enum ModelCompany {
  DeepSeek = 'DeepSeek',
  MiniMax = 'MiniMax',
  Ollama = 'Ollama',
  OpenAI = 'OpenAI',
  Anthropic = 'Anthropic',
  OpenAICompatible = 'OpenAICompatible',
}

export type ModelOpt = {
  type: ModelCompany;
  apiKey: string;
  modelName: string;
  baseUrl?: string;
  maxContextLength: number; // 单位tokens，最大上下文长度
};
