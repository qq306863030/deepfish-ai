import type { ReactAgent } from "langchain";

export async function getLastCheckPointId(agentId: string, agent: ReactAgent<any>) {
    console.log('getLastCheckPointId agentId:', agentId);
  const threadConfig = { configurable: { thread_id: agentId } };
  const history = [];
  // 关键：agent.graph 才是原生编译后的 LangGraph 实例
  const compiledGraph = agent.graph;
  // 遍历历史快照
  for await (const state of compiledGraph.getStateHistory(threadConfig)) {
    history.push(state);
  }
  // 找走完END(next为空)的快照
  const finishSnap = history.find(s => s.next.length === 0);
  return finishSnap?.config.configurable?.['checkpoint_id'] || null;
}