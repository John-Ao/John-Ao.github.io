// apiBase is the canonical backend identity; routes only change the network path.
export const config = Object.freeze({
    apiBase: 'https://github-pages-portal.johnao73thu.workers.dev',
    routes: [
        { id: 'direct', label: 'Cloudflare 直连', url: 'https://github-pages-portal.johnao73thu.workers.dev' },
        { id: 'relay', label: '美国服务器备用', url: 'https://45.76.9.45' }
    ],
    // Optional navigation catalogue only; not an access-control registry.
    games: { quoridor: '/game/quoridor/', tacta: '/game/tacta/' }
});
