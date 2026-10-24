// Public configuration. Set this to your deployed Worker's HTTPS origin.
export const config = Object.freeze({
    apiBase: 'https://github-pages-portal.johnao73thu.workers.dev',
    // Optional navigation catalogue only; not an access-control registry.
    games: { quoridor: '/game/quoridor/', tacta: '/game/tacta/' }
});
