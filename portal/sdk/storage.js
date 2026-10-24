const database = () => new Promise((resolve, reject) => {
  const r = indexedDB.open('portal-identities-v1', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('identities');
  r.onsuccess = () => resolve(r.result); r.onerror = () => reject(new Error('需要允许浏览器存储，以便刷新后恢复身份'));
});
export async function stored(key, value) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('identities', value === undefined ? 'readonly' : 'readwrite'), store = tx.objectStore('identities');
    const request = value === undefined ? store.get(key) : value === null ? store.delete(key) : store.put(value, key);
    tx.oncomplete = () => { db.close(); resolve(request.result); }; tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
