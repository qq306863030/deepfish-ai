import EventEmitterSuper from 'eventemitter-super'

const ee = new EventEmitterSuper()
ee.on('test', async (data) => {
    await setTime(data)
})
function setTime(data) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            console.log(2, data)
            resolve(data)
        }, 1000)
    })
}


async function test() {
    console.log(1)
    await ee.emitPromise('test', 'hello')
    console.log(3)
}

test()