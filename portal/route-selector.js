import { routes, selectedRoute, selectRoute, onRouteChange } from './sdk/routes.js';
const select = document.getElementById('portalRoute');
const status = document.getElementById('routeStatus');
for (const route of routes()) select.add(new Option(route.label, route.id));
select.value = selectedRoute().id;
select.addEventListener('change', () => selectRoute(select.value));
onRouteChange(() => {
  select.value = selectedRoute().id;
  status.textContent = '线路已切换。使用邀请指定线路的其他标签页不受影响。失败的登录操作请重试；注册页未加载时请刷新页面。';
});
