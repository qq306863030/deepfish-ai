/**
 * @Author: Roman 306863030@qq.com
 * @Date: 2026-03-17 11:59:19
 * @LastEditors: Roman 306863030@qq.com
 * @LastEditTime: 2026-03-20 16:52:45
 * @FilePath: \deepfish\src\core\extension\FileExtension.js
 * @Description: 文件处理扩展函数
 * @
 */
const path = require("path");
const fs = require("fs-extra");

async function createFile(filePath, content) {
  try {
    const fullPath = path.resolve(process.cwd(), filePath);
    const dirPath = path.dirname(fullPath);

    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    fs.writeFileSync(fullPath, content);
    return true;
  } catch (error) {
    return false;
  }
}

async function modifyFile(filePath, content) {
  try {
    const fullPath = path.resolve(process.cwd(), filePath);

    if (!fs.existsSync(fullPath)) {
      return false;
    }

    fs.writeFileSync(fullPath, content);
    return true;
  } catch (error) {
    return false;
  }
}

async function readFile(filePath) {
  try {
    const fullPath = path.resolve(process.cwd(), filePath);

    if (!fs.existsSync(fullPath)) {
      return null;
    }

    const content = fs.readFileSync(fullPath, "utf8");
    return content;
  } catch (error) {
    return null;
  }
}

async function appendToFile(filePath, content) {
  try {
    const fullPath = path.resolve(process.cwd(), filePath);

    if (!fs.existsSync(fullPath)) {
      return false;
    }

    fs.appendFileSync(fullPath, content);
    return true;
  } catch (error) {
    return false;
  }
}

function fileExists(filePath) {
  const fullPath = path.resolve(process.cwd(), filePath);
  return fs.existsSync(fullPath);
}

async function createDirectory(dirPath) {
  try {
    const fullPath = path.resolve(process.cwd(), dirPath);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
    return true;
  } catch (error) {
    return false;
  }
}

async function deleteFile(filePath) {
  try {
    const fullPath = path.resolve(process.cwd(), filePath);

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
    return true;
  } catch (error) {
    return false;
  }
}

async function deleteDirectory(dirPath) {
  try {
    const fullPath = path.resolve(process.cwd(), dirPath);

    if (fs.existsSync(fullPath)) {
      fs.rmSync(fullPath, { recursive: true, force: true });
    }
    return true;
  } catch (error) {
    return false;
  }
}

async function rename(oldPath, newPath) {
  try {
    const fullOldPath = path.resolve(process.cwd(), oldPath);
    const fullNewPath = path.resolve(process.cwd(), newPath);

    if (fs.existsSync(fullOldPath)) {
      fs.renameSync(fullOldPath, fullNewPath);
    }
    return true;
  } catch (error) {
    return false;
  }
}

async function moveFile(sourcePath, destinationPath) {
  try {
    const fullSourcePath = path.resolve(process.cwd(), sourcePath);
    const fullDestPath = path.resolve(process.cwd(), destinationPath);
    const destDirPath = path.dirname(fullDestPath);

    if (!fs.existsSync(destDirPath)) {
      fs.mkdirSync(destDirPath, { recursive: true });
    }

    if (fs.existsSync(fullSourcePath)) {
      fs.renameSync(fullSourcePath, fullDestPath);
    }
    return true;
  } catch (error) {
    return false;
  }
}

async function getFileInfo(filePath) {
  try {
    const fullPath = path.resolve(process.cwd(), filePath);

    if (!fs.existsSync(fullPath)) {
      return null;
    }

    const stats = fs.statSync(fullPath);
    return {
      path: fullPath,
      size: stats.size,
      birthtime: stats.birthtime,
      mtime: stats.mtime,
      ctime: stats.ctime,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
    };
  } catch (error) {
    return null;
  }
}

async function getFileNameList(dirPath) {
  try {
    const fullPath = path.resolve(process.cwd(), dirPath);
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory()) {
      return [];
    }
    const files = fs
      .readdirSync(fullPath)
      .filter((file) => file !== "ai-history" && file !== "ai-log");
    return files;
  } catch (error) {
    return [];
  }
}

async function clearDirectory(dirPath) {
  try {
    const fullPath = path.resolve(process.cwd(), dirPath);

    if (!fs.existsSync(fullPath)) {
      return false;
    }

    if (!fs.statSync(fullPath).isDirectory()) {
      return false;
    }

    const files = fs.readdirSync(fullPath);

    for (const file of files) {
      const filePath = path.join(fullPath, file);
      if (fs.statSync(filePath).isDirectory()) {
        fs.rmSync(filePath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(filePath);
      }
    }

    return true;
  } catch (error) {
    return false;
  }
}

const descriptions = [
  {
    type: "function",
    function: {
      name: "createFile",
      description:
        "创建一个包含指定内容的新文件，返回布尔值表示操作是否成功。如果目录不存在会自动创建目录结构。",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string" },
          content: { type: "string" },
        },
        required: ["filePath", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "modifyFile",
      description:
        "修改指定文件的内容，返回布尔值表示操作是否成功。如果文件不存在则返回false。",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string" },
          content: { type: "string" },
        },
        required: ["filePath", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "readFile",
      description:
        "读取指定文件的内容，返回文件内容字符串。如果文件不存在或读取失败则返回null。",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string" },
        },
        required: ["filePath"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "appendToFile",
      description:
        "向指定文件追加内容，返回布尔值表示操作是否成功。如果文件不存在则返回false。",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string" },
          content: { type: "string" },
        },
        required: ["filePath", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fileExists",
      description: "检查指定文件是否存在，返回布尔值。",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string" },
        },
        required: ["filePath"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createDirectory",
      description:
        "创建一个新目录，返回布尔值表示操作是否成功。支持递归创建目录结构。",
      parameters: {
        type: "object",
        properties: {
          dirPath: { type: "string" },
        },
        required: ["dirPath"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deleteFile",
      description:
        "删除指定文件，返回布尔值表示操作是否成功。如果文件不存在也会返回true。",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string" },
        },
        required: ["filePath"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deleteDirectory",
      description:
        "删除指定目录，返回布尔值表示操作是否成功。支持递归删除目录及其内容。如果目录不存在也会返回true。",
      parameters: {
        type: "object",
        properties: {
          dirPath: { type: "string" },
        },
        required: ["dirPath"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "rename",
      description:
        "重命名文件或目录，返回布尔值表示操作是否成功。如果原文件不存在也会返回true。",
      parameters: {
        type: "object",
        properties: {
          oldPath: { type: "string" },
          newPath: { type: "string" },
        },
        required: ["oldPath", "newPath"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "moveFile",
      description:
        "移动文件，返回布尔值表示操作是否成功。如果目标目录不存在会自动创建。如果源文件不存在也会返回true。",
      parameters: {
        type: "object",
        properties: {
          sourcePath: { type: "string" },
          destinationPath: { type: "string" },
        },
        required: ["sourcePath", "destinationPath"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getFileInfo",
      description:
        "获取指定文件的信息，返回文件信息对象。如果文件不存在或获取失败则返回null。返回对象包含path、size、birthtime、mtime、ctime、isFile、isDirectory等属性。",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string" },
        },
        required: ["filePath"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getFileNameList",
      description:
        "获取指定目录下的所有文件名，返回文件名数组。如果目录不存在或不是目录则返回空数组。",
      parameters: {
        type: "object",
        properties: {
          dirPath: { type: "string" },
        },
        required: ["dirPath"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "clearDirectory",
      description:
        "清空指定目录的内容，返回布尔值表示操作是否成功。如果目录不存在或不是目录则返回false。",
      parameters: {
        type: "object",
        properties: {
          dirPath: { type: "string" },
        },
        required: ["dirPath"],
      },
    },
  },
];

const functions = {
  createFile,
  modifyFile,
  readFile,
  appendToFile,
  fileExists,
  createDirectory,
  deleteFile,
  deleteDirectory,
  rename,
  moveFile,
  getFileInfo,
  getFileNameList,
  clearDirectory,
};

module.exports = {
  name: 'FileExtension',
  extensionDescription: "提供文件和目录的创建、读取、修改、删除、移动、重命名、信息获取等文件系统操作功能",
  descriptions,
  functions,
};
