/*
 * Abertura das páginas na demonstração: mostra a faixa "Ambiente de demonstração",
 * garante que o service worker (o "servidor" da demonstração) está ativo e só então carrega a tela.
 */
(() => {
  const s = document.currentScript;
  const base = document.querySelector('meta[name="mdp-base"]').content;
  const faixa = document.createElement('div');
  faixa.setAttribute('role', 'note');
  faixa.style.cssText = 'background:#9C7F45;color:#fff;font:600 13px/1.4 "Segoe UI",system-ui,sans-serif;padding:7px 14px;display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap;text-align:center;position:relative;z-index:100';
  faixa.innerHTML = '<span>Ambiente de demonstração · dados fictícios guardados só neste navegador · login demonstrativo, não é proteção real</span>' +
    '<button type="button" style="font:inherit;font-size:12px;background:transparent;color:#fff;border:1px solid rgba(255,255,255,.7);border-radius:6px;padding:2px 8px;cursor:pointer">Reiniciar demonstração</button>';
  document.body.prepend(faixa);
  const aviso = (t) => { const r = document.getElementById('raiz'); if (r) r.innerHTML = `<div style="padding:40px 20px;text-align:center;color:#444;font-family:system-ui">${t}</div>`; };

  faixa.querySelector('button').addEventListener('click', async () => {
    if (!navigator.serviceWorker?.controller) return location.reload();
    faixa.querySelector('button').textContent = 'Reiniciando…';
    await fetch(base + 'api/__demo/reiniciar', { method: 'POST', headers: { 'X-MDP': '1' } }).catch(() => {});
    location.href = location.pathname;
  });

  if (!('serviceWorker' in navigator)) { aviso('Este navegador não suporta a demonstração. Abra no Chrome, Edge, Firefox ou Safari atualizados, fora da janela anônima.'); return; }
  (async () => {
    aviso('Preparando a demonstração…');
    await navigator.serviceWorker.register(base + 'sw.js', { scope: base });
    if (!navigator.serviceWorker.controller) {
      await new Promise((ok) => {
        navigator.serviceWorker.addEventListener('controllerchange', ok, { once: true });
        setTimeout(ok, 8000);
      });
    }
    if (!navigator.serviceWorker.controller) { location.reload(); return; }
    const r = await fetch(base + 'api/__demo/pronto').catch(() => null);
    if (!r || !r.ok) { aviso('Não foi possível iniciar a demonstração. Recarregue a página.'); return; }
    const app = document.createElement('script');
    app.src = s.dataset.app;
    document.body.appendChild(app);
  })().catch(() => aviso('Não foi possível iniciar a demonstração. Recarregue a página.'));
})();
