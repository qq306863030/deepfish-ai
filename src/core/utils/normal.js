const path = require("path");
const fs = require("fs-extra");

// 对象字符串转对象
function objStrToObj(str) {
  try {
    if (typeof str === 'string') {
      return eval(`(${str})`)
    } else {
      return str
    }
  } catch (error) {
    throw new Error(`对象转换失败：${error.message}`)
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// 遍历目录和子目录下所有文件
function traverseFiles() {
  try {
    const currentDir = process.cwd();
    const allFiles = [];
    const currentItems = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const item of currentItems) {
      const itemPath = path.join(currentDir, item.name);
      if (item.isFile()) {
        allFiles.push(itemPath);
        continue;
      }
      if (item.isDirectory()) {
        try {
          const subItems = fs.readdirSync(itemPath, { withFileTypes: true });
          for (const subItem of subItems) {
            if (subItem.isFile()) {
              allFiles.push(path.join(itemPath, subItem.name));
            }
          }
        } catch (subErr) {
          console.warn(`读取子目录失败 ${itemPath}：${subErr.message}`);
        }
      }
    }
    return allFiles;
  } catch (err) {
    console.error(`遍历目录失败：${err.message}`);
    return [];
  }
}

module.exports = {
  objStrToObj,
  delay,
  traverseFiles
}
