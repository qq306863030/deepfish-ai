const { EventEmitterSuper } = require('eventemitter-super')

const ee = new EventEmitterSuper()
ee.on('test', async (data) => {
    await setTime(data)
})
function setTime(data) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve(data)
        }, 1000)
    })
}


async function test() {
    console.log(1)
    await ee.emit('test', 'hello')
    console.log(3)
}

test()