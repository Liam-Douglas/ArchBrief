/* ArchBrief v5 — certifications.js */
/* Maps learning path progress to certification readiness */

function getCertProgress() {
  const d = getTutor();
  const prog = d.moduleProgress || {};

  return Object.entries(CERTIFICATIONS).map(([id, cert]) => {
    const total     = cert.modules.length;
    const completed = cert.modules.filter(m => prog[m] && prog[m] !== 'not-started').length;
    const mastered  = cert.modules.filter(m => prog[m] === 'mastered').length;
    const pct       = Math.round((completed / total) * 100);
    return { id, ...cert, total, completed, mastered, pct };
  });
}

function renderCertBadge(cert) {
  const color = cert.color || 'var(--g)';
  return `<div class="cert-row">
    <div class="cert-name">${cert.name.split('—')[0].trim()}</div>
    <div class="cert-track">
      <div class="progress-track">
        <div class="progress-fill" style="width:${cert.pct}%;background:${color}"></div>
      </div>
    </div>
    <div class="cert-pct" style="color:${color}">${cert.pct}%</div>
  </div>`;
}
