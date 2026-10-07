/* Bundled NNUE assets are fetched once. Threaded engines survive position changes. */
function createRapfiClient(onReport, onError, onStatus) {
    'use strict';
    let worker = null, generation = 0, assets = null, wanted = false;
    const validate = bytes => typeof WebAssembly !== 'undefined' && WebAssembly.validate(new Uint8Array(bytes));
    const simd = validate([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,10,1,8,0,65,0,253,15,253,98,11]);
    let multi = false;
    try {
        multi = globalThis.crossOriginIsolated === true && typeof SharedArrayBuffer !== 'undefined' &&
            validate([0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,2,1,0,5,4,1,3,1,1,10,11,1,9,0,65,0,254,16,2,0,26,11]) &&
            new WebAssembly.Memory({initial:1,maximum:1,shared:true}).buffer instanceof SharedArrayBuffer;
    } catch { /* Cross-origin isolation or shared WASM memory unavailable. */ }
    const relaxed = multi && simd && validate([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,15,1,13,0,65,1,253,15,65,2,253,15,253,128,2,11]);
    const variant = 'rapfi-' + (multi ? 'multi' : 'single') + (simd ? '-simd128' : '') + (relaxed ? '-relaxed' : '');
    const threads = multi ? Math.max(1, Math.min(256, Math.floor((globalThis.navigator?.hardwareConcurrency || 2) / 2))) : 1;
    async function bytes(name) {
        const response = await fetch('vendor/rapfi/'+name+'?v=rapfi-2');
        if (!response.ok) throw new Error('无法加载 Rapfi 文件：'+name);
        return response.arrayBuffer();
    }
    function dispose() {
        wanted = false;
        generation++;
        if (worker) worker.terminate();
        worker = null;
    }
    function stop() {
        wanted = false;
        generation++;
        if (multi) worker?.postMessage({type:'stop'});
        else { worker?.terminate(); worker = null; }
    }
    async function start(moves,rule) {
        stop();
        wanted = true;
        const id = generation;
        onStatus?.('loading');
        try {
            if (typeof WebAssembly === 'undefined') throw new Error('当前浏览器不支持 WebAssembly');
            assets ||= Promise.all([bytes('rapfi.data'),bytes(variant+'.wasm')]).catch(error=>{assets=null;throw error;});
            const [engineData,wasmBinary] = await assets;
            if (id !== generation) return;
            let fresh = false;
            if (!worker) {
                fresh = true;
                const active = worker = new Worker('rapfi-worker.js?v=rapfi-2');
                active.onmessage = ({data}) => {
                    if (worker !== active) return;
                    if (data.error) {const notify = wanted; dispose();if (notify) onError(data.error);return;}
                    if (data.id !== generation) return;
                    if (data.status) {onStatus?.(data.status);return;}
                    onReport(data);
                    if (data.done) onStatus?.('done');
                };
                active.onerror = () => {
                    if (worker !== active) return;
                    const notify = wanted; dispose();if (notify) onError('Rapfi 后台运行失败');
                };
            }
            // Only the first message needs model bytes. The threaded instance,
            // weights and transposition table remain alive for subsequent moves.
            worker.postMessage({type:'start',id,moves,options:{rule,threads},
                ...(fresh ? {engineData,wasmBinary,variant,multi} : {})});
        } catch(error) {
            if (id !== generation) return;
            dispose();onError(error.message || String(error));
        }
    }
    return {start,stop,dispose};
}
if (typeof module !== 'undefined') module.exports = createRapfiClient;
