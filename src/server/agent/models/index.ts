import { ChatOpenAI } from '@langchain/openai';
import { ChatDeepSeek } from '@langchain/deepseek';
import { ChatAnthropic } from '@langchain/anthropic';
import { ModelCompany, type ModelOpt } from '@/@types/Model';

// 通过用户提供的信息获取Model对象
export function getModel(modelOpt: ModelOpt) {
  let ChatClass: any;
  if ([ModelCompany.OpenAICompatible, ModelCompany.MiniMax, ModelCompany.Ollama].some((type) => modelOpt.type === type)) {
    return new ChatOpenAI({
      model: modelOpt.modelName,
      streaming: true, // 开启流式输出
      configuration: {
        baseURL: modelOpt.baseUrl, // 通义兼容地址；本地填 http://127.0.0.1:8000/v1
        apiKey: modelOpt.apiKey, // 私有无密钥随便填"fake-key"
      },
    });
  }
  switch (modelOpt.type) {
    case ModelCompany.DeepSeek:
      ChatClass = ChatDeepSeek;
      break;
    case ModelCompany.OpenAI:
      ChatClass = ChatOpenAI;
      break;
    case ModelCompany.Anthropic:
      ChatClass = ChatAnthropic;
      break;
    default:
      throw new Error(`Unsupported model type: ${modelOpt.type}`);
  }
  const model = new ChatClass({
    apiKey: modelOpt.apiKey, // Default value.
    model: modelOpt.modelName,
    streaming: true, // 开启流式输出
  });
  return model;
}
