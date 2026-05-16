const path = require('path')
const fs = require('fs-extra')
const aiConsole = require('./aiConsole.js')

class ModelListManager {
    // 查看模型列表 model_list.json [{model: "gpt-3.5-turbo", isAvailable: true}, ...]
    setModel(aiConfig) {
        const modelListPath = path.join(process.cwd(), 'model_list.json')
        if (!fs.existsSync(modelListPath) || !this._isModelListAvailable(modelListPath)) {
            return false
        }
        const modelList = fs.readJSONSync(modelListPath)
        // 返回第一个可用的模型
        const availableModel = modelList.find(model => model.isAvailable)
        if (availableModel) {
            aiConfig = {
                ...aiConfig,
                ...availableModel
            }
            aiConsole.logSuccess(`Switched to available model: ${availableModel.model}`)
            return aiConfig
        }
        return false
    }
    // 修改模型列表
    updateModelList(model, isAvailable) {
        const modelListPath = path.join(process.cwd(), 'model_list.json')
        if (!fs.existsSync(modelListPath) || !this._isModelListAvailable(modelListPath)) {
            return false
        }
        let modelList = fs.readJSONSync(modelListPath)
        const modelIndex = modelList.findIndex(item => item.model === model)
        if (modelIndex !== -1) {
            modelList[modelIndex].isAvailable = isAvailable
            aiConsole.logSuccess(`Model list updated: ${model} is now ${isAvailable ? 'available' : 'unavailable'}.`)
        }
        return true
    }
    // 判断模型列表是否可用
    _isModelListAvailable(modelListPath) {
        // 读取json文件
        const modelList = fs.readJSONSync(modelListPath)
        return modelList.some(model => model.isAvailable)
    }
}

exports.ModelListManager = ModelListManager