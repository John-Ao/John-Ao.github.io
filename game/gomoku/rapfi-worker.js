/* Persistent threaded Rapfi, with a disposable single-thread compatibility path. */
importScripts('game.js?v=rapfi-2', 'rapfi-protocol.js?v=rapfi-2');
let engine, initialization, multi = false, initialized = false, nnue = false;
let pending = null, pumping = false, protocol = null, currentId = null, publish = false;
let idlePromise = null, acknowledgeIdle = null, failed = false;
const send = (message,id=currentId) => self.postMessage({...message,id});
function fail(error) {
    if (failed) return;
    failed = true; publish = false;
    send({error:error.message || String(error)},pending?.id ?? currentId);
}

// A tokenized native barrier acknowledges completion of search callbacks and
// cleanup. This small protocol extension leaves Rapfi search/evaluation intact.
let barrierSerial = 0;
function waitForIdle() {
    if (!multi) return Promise.resolve();
    if (idlePromise) return idlePromise;
    const token = ++barrierSerial;
    idlePromise = new Promise((resolve,reject) => {
        const timer = setTimeout(() => {
            acknowledgeIdle = null;
            reject(new Error('Rapfi 停止搜索超时'));
        },15000);
        acknowledgeIdle = received => {
            if (received !== token) return;
            clearTimeout(timer); acknowledgeIdle = null; resolve();
        };
        engine.sendCommand('YXSTOP');
        engine.sendCommand('YXISREADY '+token);
    }).finally(() => {idlePromise=null;});
    return idlePromise;
}
function stdout(line) {
    try {
        if (/Evaluator set to mix9svq/i.test(line)) nnue = true;
        const ready = /^MESSAGE READY (\d+)$/.exec(line);
        if (ready) {acknowledgeIdle?.(Number(ready[1]));return;}
        if (/^ERROR\b|failed to (?:load|initialized)|Evaluator .* disabled:/i.test(line)) throw new Error(line);
        if (publish) protocol?.receive(line);
    } catch(error) {fail(error);}
}
async function initialize(data) {
    multi = !!data.multi;
    // simd also accepts the existing Node tactical harness messages.
    const name = data.variant || (data.simd ? 'rapfi-single-simd128' : 'rapfi-single');
    const loaderURL = new URL(`vendor/rapfi/${name}.js?v=rapfi-2`,self.location.href).href;
    importScripts(`vendor/rapfi/${name}.js?v=rapfi-2`);
    engine = await Rapfi({
        wasmBinary:data.wasmBinary,
        mainScriptUrlOrBlob:loaderURL,
        getPreloadedPackage: (_name,size) => {
            if (size !== data.engineData.byteLength) throw new Error('Rapfi 模型文件不完整');
            return data.engineData;
        },
        locateFile: path => new URL('vendor/rapfi/'+path+'?v=rapfi-2',self.location.href).href,
        onReceiveStdout:stdout,
        onReceiveStderr: line => {if (line) console.error(line);},
        onAbort: reason => fail(new Error('Rapfi 初始化失败：'+String(reason)))
    });
    await waitForIdle();
    if (!nnue) throw new Error('Rapfi 未成功加载 NNUE 模型');
}
async function pump() {
    if (pumping || failed) return;
    pumping = true;
    try {
        while (pending && !failed) {
            const data = pending;
            currentId = data.id;
            initialization ||= initialize(data);
            await initialization;
            await waitForIdle();
            if (pending !== data || failed) continue;
            pending = null;
            currentId = data.id;
            protocol = createRapfiProtocol(Gomoku,data.moves,data.options.rule,
                message => send(message,data.id),{threads:data.options.threads || 1,initialized});
            if (protocol.terminal) {send({done:true,results:[]});continue;}
            send({status:'ready',engine:'Rapfi',evaluation:'NNUE',threads:data.options.threads || 1,multi,reused:initialized});
            publish = true;
            for (const command of protocol.commands) engine.sendCommand(command);
            initialized = true;
        }
    } catch(error) {fail(error);}
    finally {pumping=false;}
}
self.onmessage = ({data}) => {
    publish = false;
    if (data.type === 'stop') {
        pending = null;
        if (engine && multi) waitForIdle().catch(fail);
    } else {
        pending = data;
        pump();
    }
};
