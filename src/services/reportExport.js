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
    [],
    ['FIT BREAKDOWN'],
    ['Metric', 'Score'],
    ...report.breakdown.map(item => [item.label, item.value]),
    [],
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
  ];
  const file = `${safeFileName(report.player.name)}-${safeFileName(report.team.short)}-system-fit.csv`;
  downloadBlob(new Blob([rowsToCsv(rows)], { type: 'text/csv;charset=utf-8;' }), file);
}

export function exportComparisonCsv(report) {
  const rows = [
    ['CALIBRE PLAYER COMPARISON REPORT'],
    ['Generated', report.generatedAt],
    ['Team', report.team.name],
    ['Player A', report.primary.name, `${report.primaryScore}%`],
    ['Player B', report.challenger.name, `${report.challengerScore}%`],
    [],
    ['Dimension', report.primary.name, report.challenger.name],
    ...report.dimensions.map(item => [item.label, item.primary, item.challenger]),
    [],
    ['Verdict', report.verdict],
  ];
  const file = `${safeFileName(report.primary.name)}-vs-${safeFileName(report.challenger.name)}-${safeFileName(report.team.short)}.csv`;
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
  doc.setTextColor(20, 22, 24);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('FIT BREAKDOWN', 14, y);
  y += 7;
  doc.setFontSize(9);
  report.breakdown.forEach(item => {
    doc.setFont('helvetica', 'normal');
    doc.text(item.label, 14, y);
    doc.setFont('helvetica', 'bold');
    doc.text(String(item.value), 180, y, { align: 'right' });
    doc.setDrawColor(224, 228, 231);
    doc.line(14, y + 2, 180, y + 2);
    y += 8;
  });
  y += 3;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('DETAILED ANALYSIS', 14, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(65, 70, 76);
  y = addWrapped(doc, report.conclusion, 14, y, 174);
  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 22, 24);
  doc.text('Strengths', 14, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(65, 70, 76);
  report.strengths.forEach(item => { y = addWrapped(doc, `- ${item}`, 14, y, 174); y += 2; });
  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 22, 24);
  doc.text('Risks', 14, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(65, 70, 76);
  report.risks.forEach(item => { y = addWrapped(doc, `- ${item}`, 14, y, 174); y += 2; });
  doc.setFontSize(8);
  doc.setTextColor(130, 135, 142);
  doc.text(`Generated ${new Date(report.generatedAt).toLocaleString()} | Calibre Pro report`, 14, 287);
  doc.save(`${safeFileName(report.player.name)}-${safeFileName(report.team.short)}-system-fit.pdf`);
}

export async function exportComparisonPdf(report) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  addHeader(doc, 'PLAYER COMPARISON REPORT', `${report.primary.name} vs ${report.challenger.name} | ${report.team.name}`);
  let y = 49;
  doc.setTextColor(20, 22, 24);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(`${report.primary.name}: ${report.primaryScore}%`, 14, y);
  doc.text(`${report.challenger.name}: ${report.challengerScore}%`, 14, y + 10);
  y += 25;
  doc.setFontSize(11);
  doc.text('PROFILE COMPARISON', 14, y);
  y += 8;
  doc.setFontSize(9);
  report.dimensions.forEach(item => {
    doc.setFont('helvetica', 'normal');
    doc.text(item.label.toUpperCase(), 14, y);
    doc.setFont('helvetica', 'bold');
    doc.text(String(item.primary), 146, y, { align: 'right' });
    doc.text(String(item.challenger), 180, y, { align: 'right' });
    doc.setDrawColor(224, 228, 231);
    doc.line(14, y + 2, 180, y + 2);
    y += 9;
  });
  y += 5;
  doc.setFontSize(11);
  doc.text('VERDICT', 14, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(65, 70, 76);
  doc.setFontSize(9);
  addWrapped(doc, report.verdict, 14, y, 174);
  doc.setFontSize(8);
  doc.setTextColor(130, 135, 142);
  doc.text(`Generated ${new Date(report.generatedAt).toLocaleString()} | Calibre Pro report`, 14, 287);
  doc.save(`${safeFileName(report.primary.name)}-vs-${safeFileName(report.challenger.name)}-${safeFileName(report.team.short)}.pdf`);
}
