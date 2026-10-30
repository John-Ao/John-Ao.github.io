// Public manifests contain only the published characters. Complete manifests stay local.
export function isLocalHost(host) {
 return host==='localhost'||host==='[::1]'||host==='::1'||/^127\./.test(host)||/^192\.168\./.test(host)||/^10\./.test(host)||/^172\.(1[6-9]|2\d|3[01])\./.test(host);
}
export async function loadCatalog(url) {
 const published=new URLSearchParams(location.search).get('published')==='1';
 if(!published&&isLocalHost(location.hostname)) {
  const response=await fetch(url.replace(/\.json$/,'.local.json'),{cache:'no-cache'});
  if(response.ok)return response.json();
  if(response.status!==404)throw new Error(`本地目录加载失败：${response.status}`);
 }
 const response=await fetch(url,{cache:'no-cache'});
 if(!response.ok)throw new Error(`资源目录加载失败：${response.status}`);
 return response.json();
}
