function DefaultConfig() {
  return {
    ai: [],
    currentAi: "",
    maxIterations: 10, // ai完成工作流的最大迭代次数
    extensions: [],
    file: {
      encoding: "utf8",
    },
  };
}

module.exports = DefaultConfig;
