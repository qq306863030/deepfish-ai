const path = require('path')
const fs = require('fs-extra')

export default class AgentTree {
  content = null
  constructor(agentRobot) {
    this.agentRobot = agentRobot
    this.agentTreeFilePath = path.join(
      this.agentRobot.agentSpace,
      'agentTree.json',
    )
    this.parentAgentTree = this.agentRobot.parent.agentTree
    this.rootAgentTree = this.agentRobot.root.agentTree
  }
  init() {
    if (!this.rootAgentTree && !fs.pathExistsSync(this.agentTreeFilePath)) {
      fs.writeJsonSync(
        this.agentTreeFilePath,
        { agentId: this.agentRobot.id, children: [] },
        { spaces: 2 },
      )
    }
    if (!this.rootAgentTree) {
      this.content = fs.readJsonSync(this.agentTreeFilePath)
    } else {
      if (this.parentAgentTree && this.parentAgentTree.content.children) {
        this.content = this.parentAgentTree.content.children.find(
          (child) => child.agentId === this.agentRobot.id,
        )
        if (!this.content) {
          this.content = {
            agentId: this.agentRobot.id,
            children: [],
            type: this.agentRobot.type,
          }
          this.parentAgentTree.content.children.push(this.content)
          fs.writeJsonSync(this.agentTreeFilePath, this.rootAgentTree.content, {
            spaces: 2,
          })
        }
      }
    }
  }

  clear() {
    if (this.rootAgentTree) {
      if (this.parentAgentTree && this.parentAgentTree.content.children) {
        const currentNode = this.parentAgentTree.content.children.findIndex(
          (child) => child.agentId === this.agentRobot.id,
        )
        if (currentNode !== -1) {
          this.parentAgentTree.content.children.splice(currentNode, 1)
          fs.writeJsonSync(this.agentTreeFilePath, this.rootAgentTree.content, {
            spaces: 2,
          })
        }
      }
      // 清除子memory
      this.agentRobot.memoryFilePath &&
        fs.removeSync(this.agentRobot.memoryFilePath)
    }
  }
}
