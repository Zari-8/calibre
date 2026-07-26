function safeFileName(value) {
  return String(value || 'calibre-report').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function rowsToCsv(rows) {
  return rows.map(row => row.map(csvCell).join(',')).join('\n');
}

export function exportFitCsv(report) {
  const rows = [
    ['CALIBRE SYSTEM FIT REPORT'],
    ['Generated', report.generatedAt],
    ['Player', report.player.name],
    ['Team', report.team.name],
    ['Overall fit score', `${report.score}%`],
    ['Verdict', report.verdict],
  ];
  // Raw trait alignment / specialist caveat — same fields the on-screen
  // report already shows (System Fit v3/v4). Only worth a row when there's
  // something to say; keeps the CSV clean for reports where they're absent.
  if (report.rawAlignment != null && Math.abs(report.rawAlignment - report.score) >= 5) {
    rows.push(['Raw trait alignment (pre-adjustment)', `${report.rawAlignment}%`]);
  }
  if (report.specialistNote) {
    rows.push(['Specialist profile note', report.specialistNote]);
  }
  if (report.valuation) {
    rows.push(['Confidence', `${report.valuation.confidence}/100`]);
    rows.push(['Estimated fee band', `€${report.valuation.fairRange.low}m - €${report.valuation.fairRange.high}m`]);
    rows.push(['Calibre Value', `€${report.valuation.estimatedValue}m`]);
  }
  if (report.decisionWorkflow) {
    rows.push(
      [],
      ['DECISION WORKFLOW'],
      ['Recommendation', report.decisionWorkflow.recommendation],
      ['Owner', report.decisionWorkflow.owner],
      ['Next action', report.decisionWorkflow.nextAction],
      ['Decision deadline', report.decisionWorkflow.deadline],
    );
  }
  rows.push(
    [],
    ['FIT BREAKDOWN'],
    ['Metric', 'Score'],
    ...report.breakdown.map(item => [item.label, item.value]),
    [],
  );
  if (report.roleFit?.length) {
    rows.push(
      ['ROLE FIT'],
      ['Role', 'Score'],
      ...report.roleFit.map(item => [item.label, item.value]),
      [],
    );
  }
  rows.push(
    ['ROLE FIT PULSE'],
    ['Metric', 'Score'],
    ...report.rolePulse.map(item => [item.label, item.value]),
    [],
    ['BEST-FIT TEAMS'],
    ['Rank', 'Team', 'League', 'Formation', 'Score', 'Verdict'],
    ...report.alternativeFits.map((team, index) => [index + 1, team.name, team.league, team.formation, team.score, team.verdict]),
    [],
    ['DETAILED ANALYSIS'],
    ['Strengths', ...report.strengths],
    ['Risks', ...report.risks],
    ['Conclusion', report.conclusion],
  );
  const file = `${safeFileName(report.player.name)}-${safeFileName(report.team.short)}-system-fit.csv`;
  downloadBlob(new Blob([rowsToCsv(rows)], { type: 'text/csv;charset=utf-8;' }), file);
}

// Compare-4: report.players (2-4 entries, each with a real .score) is the
// generalized field; report.primary/challenger/primaryScore/challengerScore
// stay populated too (first two players) for anything still reading the old
// 2-player fields. Building the CSV off `players` means a 2-player report
// renders identically to before, and 3-4 player reports just add columns.
export function exportComparisonCsv(report) {
  const players = report.players || [report.primary, report.challenger];
  const rows = [
    ['CALIBRE PLAYER COMPARISON REPORT'],
    ['Generated', report.generatedAt],
    ['Team', report.team.name],
    ...players.map((p, i) => [`Player ${String.fromCharCode(65 + i)}`, p.name, `${p.score}%`]),
    [],
    ['Dimension', ...players.map(p => p.name)],
    ...report.dimensions.map(item => [item.label, ...(item.values || [item.primary, item.challenger])]),
    [],
    ['Verdict', report.verdict],
  ];
  const file = `${players.map(p => safeFileName(p.name)).join('-vs-')}-${safeFileName(report.team.short)}.csv`;
  downloadBlob(new Blob([rowsToCsv(rows)], { type: 'text/csv;charset=utf-8;' }), file);
}

function addWrapped(doc, text, x, y, width, options = {}) {
  const lines = doc.splitTextToSize(text, width);
  doc.text(lines, x, y, options);
  return y + (lines.length * 5.2);
}

function addHeader(doc, title, subtitle) {
  doc.setFillColor(5, 5, 7);
  doc.rect(0, 0, 210, 34, 'F');
  doc.setTextColor(170, 255, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('CALIBRE', 14, 15);
  doc.setTextColor(235, 238, 240);
  doc.setFontSize(12);
  doc.text(title, 14, 24);
  doc.setTextColor(125, 132, 144);
  doc.setFontSize(8);
  doc.text(subtitle, 14, 30);
}

// Adds a new page (with the same footer treatment) if there isn't enough
// room left for the next block, so growing the report with more sections
// (role fit, best-fit teams) doesn't just run text off the bottom of page 1.
function ensureSpace(doc, y, needed) {
  if (y + needed <= 280) return y;
  doc.addPage();
  return 20;
}

function addSectionHeading(doc, text, y) {
  y = ensureSpace(doc, y, 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(20, 22, 24);
  doc.text(text, 14, y);
  return y + 7;
}

export async function exportFitPdf(report) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  addHeader(doc, 'SYSTEM FIT REPORT', `${report.player.name} -> ${report.team.name}`);
  let y = 46;
  doc.setTextColor(20, 22, 24);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.text(`${report.score}%`, 14, y);
  doc.setFontSize(13);
  doc.text(report.verdict.toUpperCase(), 42, y - 1);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 105, 112);
  doc.text(`${report.player.position} | ${report.player.archetype} | ${report.team.formation} ${report.team.philosophy}`, 42, y + 5);
  y += 17;
  // Raw trait alignment + specialist caveat — mirrors the callouts already
  // shown on-screen in System Fit; only printed when there's a meaningful
  // gap or a flag to report, same rule the UI uses.
  if (report.rawAlignment != null && Math.abs(report.rawAlignment - report.score) >= 5) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(120, 125, 132);
    y = addWrapped(doc, `Raw trait alignment: ${report.rawAlignment}/100 before the ${report.rawAlignment < report.score ? 'proven-fit adjustment for his current club' : 'adaptation-risk adjustment for a new destination'} above.`, 14, y, 174);
    y += 2;
  }
  if (report.specialistNote) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(163, 122, 20);
    y = addWrapped(doc, `Specialist profile: ${report.specialistNote}`, 14, y, 174);
    y += 2;
  }
  // Confidence + fee band and Decision Workflow — white background, dark
  // text, same as every other block in this PDF (no fills). Printouts don't
  // hold a black background reliably (browser/driver print settings strip
  // it, and it's a lot of ink even when they don't), so this stays plain
  // text on the page's default white, matching the rest of the document.
  if (report.valuation) {
    y = ensureSpace(doc, y, 16);
    y += 3;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(20, 22, 24);
    doc.text(`Confidence: ${report.valuation.confidence}/100`, 14, y);
    doc.text(`Est. fee band: €${report.valuation.fairRange.low}m – €${report.valuation.fairRange.high}m`, 105, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 125, 132);
    doc.text(`Calibre Value €${report.valuation.estimatedValue}m`, 14, y);
    y += 4;
  }
  if (report.decisionWorkflow) {
    const dw = report.decisionWorkflow;
    y += 3;
    y = addSectionHeading(doc, 'DECISION WORKFLOW', y);
    doc.setFontSize(9);
    [['Recommendation', dw.recommendation], ['Owner', dw.owner], ['Decision deadline', dw.deadline]].forEach(([label, value]) => {
      y = ensureSpace(doc, y, 8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(20, 22, 24);
      doc.text(label, 14, y);
      doc.setFont('helvetica', 'bold');
      doc.text(String(value), 180, y, { align: 'right' });
      doc.setDrawColor(224, 228, 231);
      doc.line(14, y + 2, 180, y + 2);
      y += 8;
    });
    y = ensureSpace(doc, y, 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(65, 70, 76);
    y = addWrapped(doc, `Next action: ${dw.nextAction}`, 14, y, 174);
    y += 2;
  }
  y += 3;
  y = addSectionHeading(doc, 'FIT BREAKDOWN', y);
  doc.setFontSize(9);
  report.breakdown.forEach(item => {
    y = ensureSpace(doc, y, 8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(20, 22, 24);
    doc.text(item.label, 14, y);
    doc.setFont('helvetica', 'bold');
    doc.text(String(item.value), 180, y, { align: 'right' });
    doc.setDrawColor(224, 228, 231);
    doc.line(14, y + 2, 180, y + 2);
    y += 8;
  });
  if (report.roleFit?.length) {
    y += 3;
    y = addSectionHeading(doc, 'ROLE FIT', y);
    doc.setFontSize(9);
    report.roleFit.forEach(item => {
      y = ensureSpace(doc, y, 8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(20, 22, 24);
      doc.text(item.label, 14, y);
      doc.setFont('helvetica', 'bold');
      doc.text(String(item.value), 180, y, { align: 'right' });
      doc.setDrawColor(224, 228, 231);
      doc.line(14, y + 2, 180, y + 2);
      y += 8;
    });
  }
  if (report.alternativeFits?.length) {
    y += 3;
    y = addSectionHeading(doc, 'BEST-FIT CLUB RANKING', y);
    doc.setFontSize(9);
    report.alternativeFits.slice(0, 6).forEach((team, index) => {
      y = ensureSpace(doc, y, 8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(20, 22, 24);
      doc.text(`${index + 1}. ${team.name} (${team.league}, ${team.formation})`, 14, y);
      doc.setFont('helvetica', 'bold');
      doc.text(`${team.score}%`, 180, y, { align: 'right' });
      doc.setDrawColor(224, 228, 231);
      doc.line(14, y + 2, 180, y + 2);
      y += 8;
    });
  }
  y += 3;
  y = addSectionHeading(doc, 'DETAILED ANALYSIS', y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(65, 70, 76);
  y = ensureSpace(doc, y, 12);
  y = addWrapped(doc, report.conclusion, 14, y, 174);
  y += 7;
  y = ensureSpace(doc, y, 10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 22, 24);
  doc.text('Strengths', 14, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(65, 70, 76);
  report.strengths.forEach(item => { y = ensureSpace(doc, y, 10); y = addWrapped(doc, `- ${item}`, 14, y, 174); y += 2; });
  y += 4;
  y = ensureSpace(doc, y, 10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 22, 24);
  doc.text('Risks', 14, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(65, 70, 76);
  report.risks.forEach(item => { y = ensureSpace(doc, y, 10); y = addWrapped(doc, `- ${item}`, 14, y, 174); y += 2; });
  doc.setFontSize(8);
  doc.setTextColor(130, 135, 142);
  doc.text(`Generated ${new Date(report.generatedAt).toLocaleString()} | Calibre Pro report`, 14, 287);
  doc.save(`${safeFileName(report.player.name)}-${safeFileName(report.team.short)}-system-fit.pdf`);
}

export async function exportComparisonPdf(report) {
  const players = report.players || [report.primary, report.challenger];
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  addHeader(doc, 'PLAYER COMPARISON REPORT', `${players.map(p => p.name).join(' vs ')} | ${report.team.name}`);
  let y = 49;
  doc.setTextColor(20, 22, 24);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(players.length > 2 ? 14 : 18);
  players.forEach(p => {
    doc.text(`${p.name}: ${p.score}%`, 14, y);
    y += players.length > 2 ? 7 : 10;
  });
  y += 15;
  y = ensureSpace(doc, y, 14);
  doc.setFontSize(11);
  doc.setTextColor(20, 22, 24);
  doc.text('PROFILE COMPARISON', 14, y);
  y += 8;
  doc.setFontSize(players.length > 2 ? 8 : 9);
  // Value columns spread evenly across the printable width (14mm-196mm) —
  // right-aligned under each player's initials so this scales cleanly from
  // 2 to 4 players instead of the old fixed 146mm/180mm pair.
  const colX = players.map((_, i) => 196 - (players.length - 1 - i) * ((196 - 100) / Math.max(1, players.length - 1)));
  report.dimensions.forEach(item => {
    y = ensureSpace(doc, y, 9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(20, 22, 24);
    doc.text(item.label.toUpperCase(), 14, y);
    const values = item.values || [item.primary, item.challenger];
    values.forEach((v, i) => {
      doc.setFont('helvetica', 'bold');
      doc.text(String(v), colX[i], y, { align: 'right' });
    });
    doc.setDrawColor(224, 228, 231);
    doc.line(14, y + 2, 196, y + 2);
    y += 9;
  });
  y += 5;
  y = ensureSpace(doc, y, 20);
  doc.setFontSize(11);
  doc.setTextColor(20, 22, 24);
  doc.text('VERDICT', 14, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(65, 70, 76);
  doc.setFontSize(9);
  addWrapped(doc, report.verdict, 14, y, 174);
  doc.setFontSize(8);
  doc.setTextColor(130, 135, 142);
  doc.text(`Generated ${new Date(report.generatedAt).toLocaleString()} | Calibre Pro report`, 14, 287);
  doc.save(`${players.map(p => safeFileName(p.name)).join('-vs-')}-${safeFileName(report.team.short)}.pdf`);
}
