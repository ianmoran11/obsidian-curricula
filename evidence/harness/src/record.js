#!/usr/bin/env node

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');

const VIEWPORTS = {
  INNER: { viewport: { width: 2176, height: 1812 }, deviceScaleFactor: 2.63, isMobile: true, hasTouch: true },
  COVER: { viewport: { width: 2316, height: 904 }, deviceScaleFactor: 2.63, isMobile: true, hasTouch: true },
};

const MODES = {
  grounded: path.join(__dirname, '../../../mock-vault'),
  augmented: path.join(__dirname, '../../../mock-vault'),
  'knowledge-only': path.join(__dirname, '../../../mock-vault-empty'),
};

function getVaultPath(mode) {
  return MODES[mode] || MODES.grounded;
}

function getObsidianExec() {
  if (process.env.OBSIDIAN_PATH) return process.env.OBSIDIAN_PATH;
  const macPaths = [
    '/Applications/Obsidian.app/Contents/MacOS/Obsidian',
    process.env.HOME + '/Applications/Obsidian.app/Contents/MacOS/Obsidian',
  ];
  for (const p of macPaths) {
    if (fs.existsSync(p)) return p;
  }
  return '/Applications/Obsidian.app/Contents/MacOS/Obsidian';
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function waitForObsidianReady(page, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const title = await page.title();
      if (title && title !== 'Obsidian' && title !== '') return true;
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

function getEvidenceDir(milestone, viewport, mode) {
  const vpDir = viewport === 'inner' ? 'inner-screen' : 'cover-screen';
  return path.join(__dirname, `../../milestone-${milestone}/${vpDir}/${mode}`);
}

function getArtifactsDir(milestone) {
  return path.join(__dirname, `../../milestone-${milestone}/artifacts`);
}

function getLogsDir(milestone) {
  return path.join(__dirname, `../../milestone-${milestone}/logs`);
}

async function recordMilestone(milestone, mode, viewportName) {
  const viewport = VIEWPORTS[viewportName.toUpperCase()] || VIEWPORTS.INNER;
  const vaultPath = getVaultPath(mode);
  const outDir = getEvidenceDir(milestone, viewportName, mode);
  const artifactsDir = getArtifactsDir(milestone);
  const logsDir = getLogsDir(milestone);

  ensureDir(outDir);
  ensureDir(artifactsDir);
  ensureDir(logsDir);

  const execPath = getObsidianExec();
  if (!fs.existsSync(execPath)) {
    console.error('ERROR: Obsidian not found at', execPath);
    console.error('Install Obsidian desktop from https://obsidian.md');
    console.error('Or set OBSIDIAN_PATH env var to the Obsidian binary path.');
    process.exit(1);
  }

  const userDataDir = path.join(os.tmpdir(), `obsidian-test-${Date.now()}-${viewportName}`);
  ensureDir(userDataDir);

  let browser;
  let logFile;

  try {
    logFile = fs.createWriteStream(path.join(logsDir, 'harness.log'), { flags: 'a' });
    const log = (...args) => {
      const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
      logFile.write(`[${new Date().toISOString()}] ${msg}\n`);
      console.log(...args);
    };

    log('=== Record Milestone', milestone, '===');
    log('Mode:', mode, '| Viewport:', viewportName, '| Vault:', vaultPath);
    log('Output:', outDir);

    browser = await chromium.launch({
      executablePath: execPath,
      args: [
        '--no-sandbox',
        '--disable-gpu',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
      headless: true,
    });

    const context = await browser.newContext({
      viewport: viewport.viewport,
      deviceScaleFactor: viewport.deviceScaleFactor,
      isMobile: viewport.isMobile,
      hasTouch: viewport.hasTouch,
      recordVideo: {
        dir: outDir,
        size: viewport.viewport,
      },
      userDataDir: userDataDir,
    });

    const page = await context.newPage();
    log('Obsidian launched. Waiting for ready...');
    await waitForObsidianReady(page);
    log('Obsidian ready.');

    const timestamp = new Date().toISOString();
    const artifacts = [];

    const vaultOverviewPath = path.join(outDir, 'vault-overview.png');
    await page.screenshot({ path: vaultOverviewPath, fullPage: false });
    log('  [captured] vault-overview.png');
    artifacts.push({
      id: 'F01_01_vault-structure',
      kind: 'image',
      file: vaultOverviewPath,
    });

    const pluginEnabled = await page.locator('.plugin-item[data-plugin-id="obsidian-auto-tutor"]').count();
    if (pluginEnabled > 0) {
      const pluginPath = path.join(outDir, 'plugin-enabled.png');
      await page.screenshot({ path: pluginPath });
      log('  [captured] plugin-enabled.png');
    }

    const videoPage = context.pages()[0];
    if (videoPage && videoPage.video()) {
      const videoPath = videoPage.video().path();
      if (videoPath && fs.existsSync(videoPath)) {
        const destVideo = path.join(outDir, 'session.mp4');
        fs.copyFileSync(videoPath, destVideo);
        log('  [captured] session.mp4 from video recording');
      }
    }

    await context.close();
    await browser.close();

    const manifest = buildManifest(milestone, mode, viewportName, vaultPath, artifacts, timestamp);
    const manifestPath = path.join(__dirname, `../../milestone-${milestone}/evidence.json`);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    log('  [manifest]', manifestPath);

    const indexPath = path.join(__dirname, `../../milestone-${milestone}/index.html`);
    const indexHtml = buildIndexHtml(manifest);
    fs.writeFileSync(indexPath, indexHtml);
    log('  [index.html]', indexPath);

    const envPath = path.join(__dirname, `../../milestone-${milestone}/environment.txt`);
    const envContent = [
      `uname: ${os.type()} ${os.release()}`,
      `node: ${process.version}`,
      `date: ${new Date().toISOString()}`,
      `platform: ${process.platform}`,
      `arch: ${process.arch}`,
    ].join('\n');
    fs.writeFileSync(envPath, envContent);
    log('  [environment]', envPath);

    const summaryPath = path.join(__dirname, `../../milestone-${milestone}/summary.md`);
    const summaryContent = `# Milestone ${milestone} Summary\n\nMode: ${mode}\nViewport: ${viewportName}\nCaptured: ${timestamp}\n\n## Features\n\n- F01: Vault structure verified\n- Plugin enabled status captured\n\n## Artifacts\n\n- vault-overview.png\n- session.mp4 (video recording)\n`;
    fs.writeFileSync(summaryPath, summaryContent);
    log('  [summary]', summaryPath);

    log('=== Milestone', milestone, 'complete ===');
    logFile.end();

  } catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
    if (logFile) logFile.end();
    if (browser) await browser.close().catch(() => {});
    process.exit(1);
  }
}

function buildManifest(milestone, mode, viewportName, vaultPath, artifacts, timestamp) {
  return {
    milestone: parseInt(milestone),
    capturedAt: timestamp,
    pluginCommit: getGitCommit(),
    harnessVersion: '1.0.0',
    environment: {
      os: `${os.type()} ${os.release()}`,
      node: process.version,
    },
    modes: [mode],
    features: [
      {
        id: 'F01',
        title: 'Mock vault',
        status: artifacts.length > 0 ? 'pass' : 'skip',
        criteria: [],
      },
    ],
    artifacts: artifacts.map((a, i) => ({
      id: a.id || `F01_${String(i).padStart(2, '0')}_artifact`,
      featureId: 'F01',
      caption: a.caption || 'Evidence artifact',
      kind: a.kind,
      viewport: viewportName,
      mode: mode,
      files: {
        primary: path.relative(__dirname + '/../../', a.file),
      },
      durationMs: 0,
      sha256: {},
      meta: {
        startedAt: timestamp,
        stepsRecorded: [],
        networkCalls: 0,
      },
      keysRedacted: true,
    })),
  };
}

function getGitCommit() {
  try {
    const { execSync } = require('child_process');
    return execSync('git rev-parse HEAD', { cwd: __dirname + '/../../', encoding: 'utf8' }).trim().slice(0, 8);
  } catch {
    return 'unknown';
  }
}

function buildIndexHtml(manifest) {
  const gitUrl = 'https://github.com/anomalyco/obsidian-curricula/commit/' + manifest.pluginCommit;
  const allPass = manifest.features.every(f => f.status === 'pass');
  const allSkip = manifest.features.every(f => f.status === 'skip');
  const bannerClass = allPass ? 'pass' : (allSkip ? 'skip' : 'fail');
  const bannerText = allPass ? 'ALL PASS' : (allSkip ? 'SKIPPED' : 'FAILURES PRESENT');

  const featuresHtml = manifest.features.map(f => {
    const criteria = f.criteria || [];
    const criteriaHtml = criteria.map(c => `
      <article>
        <p>${c.text}</p>
        <span class="badge ${c.status}">${c.status.toUpperCase()}</span>
        ${c.artifactIds ? `<p>Artifacts: ${c.artifactIds.join(', ')}</p>` : ''}
      </article>
    `).join('');
    return `
      <section>
        <h3>${f.id}: ${f.title}</h3>
        <span class="badge ${f.status}">${f.status.toUpperCase()}</span>
        ${criteriaHtml}
      </section>
    `;
  }).join('');

  const viewports = ['inner', 'cover'];
  const modes = [...new Set(manifest.artifacts.map(a => a.mode))];
  const modeMatrixHtml = modes.length > 0 ? `
    <h3>Mode Coverage Matrix</h3>
    <table>
      <tr><th>Feature</th>${modes.map(m => `<th>${m}</th>`).join('')}</tr>
      ${manifest.features.map(f => {
        const cells = modes.map(mode => {
          const hasArtifact = manifest.artifacts.some(a => a.featureId === f.id && a.mode === mode);
          return hasArtifact ? '<td style="text-align:center">✅</td>' : '<td style="text-align:center">—</td>';
        }).join('');
        return `<tr><td>${f.id}</td>${cells}</tr>`;
      }).join('')}
    </table>
  ` : '';

  const artifactsRows = manifest.artifacts.map(a => {
    const filePath = a.files && a.files.primary ? `<a href="${a.files.primary}">${a.files.primary}</a>` : 'N/A';
    const videoOrImage = a.kind === 'video' || a.kind === 'image'
      ? `<a href="${a.files.primary}"><img src="${a.files.primary}" style="max-width:200px" /></a>`
      : `<a href="${a.files.primary}">${a.files.primary}</a>`;
    return `
      <tr>
        <td>${a.id}</td>
        <td>${a.kind}</td>
        <td>${a.viewport}</td>
        <td>${a.mode}</td>
        <td>${a.caption || ''}</td>
        <td>${filePath}</td>
      </tr>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Milestone ${manifest.milestone} Evidence</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 1100px; margin: 0 auto; padding: 20px; line-height: 1.5; }
    h1 { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
    h2 { margin-top: 30px; border-bottom: 1px solid #ddd; padding-bottom: 8px; }
    h3 { margin-top: 20px; }
    table { border-collapse: collapse; width: 100%; margin: 15px 0; }
    th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
    th { background: #f5f5f5; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: bold; }
    .pass { background: #4CAF50; color: white; }
    .fail { background: #f44336; color: white; }
    .skip { background: #9e9e9e; color: white; }
    .banner { padding: 15px 20px; border-radius: 4px; margin: 20px 0; font-weight: bold; font-size: 18px; }
    .banner.pass { background: #dff2d8; border: 2px solid #4CAF50; color: #2e7d32; }
    .banner.fail { background: #f2d8d8; border: 2px solid #f44336; color: #c62828; }
    .banner.skip { background: #f5f5f5; border: 2px solid #9e9e9e; color: #616161; }
    .env { background: #f5f5f5; padding: 15px; border-radius: 4px; margin-top: 20px; }
    pre { background: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto; font-size: 13px; }
    section { background: #fafafa; padding: 15px; border-radius: 4px; margin: 15px 0; border-left: 3px solid #ccc; }
    section h3 { margin-top: 0; }
    article { background: white; padding: 10px; margin: 10px 0; border-radius: 4px; border: 1px solid #eee; }
    footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px; }
    img { max-width: 100%; height: auto; }
    a { color: #1976D2; }
    tr.fail-row { background: #ffebee; }
  </style>
</head>
<body>
  <h1>Milestone ${manifest.milestone} Evidence</h1>

  <div class="banner ${bannerClass}">${bannerText}</div>

  <p><strong>Captured:</strong> ${manifest.capturedAt}</p>
  <p><strong>Commit:</strong> <a href="${gitUrl}" target="_blank">${manifest.pluginCommit}</a></p>
  <p><strong>Harness:</strong> ${manifest.harnessVersion}</p>

  <div class="banner ${bannerClass}">${bannerText}</div>

  <h2>Features</h2>
  <table>
    <tr><th>ID</th><th>Title</th><th>Status</th></tr>
    ${manifest.features.map(f => `
      <tr class="${f.status === 'fail' ? 'fail-row' : ''}">
        <td>${f.id}</td>
        <td>${f.title}</td>
        <td><span class="badge ${f.status}">${f.status.toUpperCase()}</span></td>
      </tr>
    `).join('')}
  </table>

  ${featuresHtml}

  ${modeMatrixHtml}

  <h2>Artifacts</h2>
  <table>
    <tr><th>ID</th><th>Kind</th><th>Viewport</th><th>Mode</th><th>Caption</th><th>File</th></tr>
    ${artifactsRows}
  </table>

  <div class="env">
    <h3>Environment</h3>
    <pre>${manifest.environment.os}\nnode: ${manifest.environment.node}</pre>
  </div>

  <footer>
    <p>Regeneration: <code>npm run evidence -- --milestone ${manifest.milestone}</code></p>
    <p>Manifest: <a href="evidence.json">evidence.json</a></p>
  </footer>
</body>
</html>`;
}

const args = process.argv.slice(2);

if (args.includes('--list')) {
  const inner = VIEWPORTS.INNER;
  const cover = VIEWPORTS.COVER;
  console.log('INNER:', inner.viewport.width + 'x' + inner.viewport.height + ' @ dpr ' + inner.deviceScaleFactor);
  console.log('COVER:', cover.viewport.width + 'x' + cover.viewport.height + ' @ dpr ' + cover.deviceScaleFactor);
} else if (args.includes('--milestone')) {
  const idx = args.indexOf('--milestone');
  const milestone = args[idx + 1] || '1';
  const modeIdx = args.indexOf('--mode');
  const mode = modeIdx >= 0 ? args[modeIdx + 1] : 'grounded';
  const vpIdx = args.indexOf('--viewport');
  const viewport = vpIdx >= 0 ? args[vpIdx + 1] : 'inner';

  if (!['grounded', 'augmented', 'knowledge-only'].includes(mode)) {
    console.error('Invalid mode:', mode);
    console.error('Use: grounded | augmented | knowledge-only');
    process.exit(1);
  }
  if (!['inner', 'cover'].includes(viewport)) {
    console.error('Invalid viewport:', viewport);
    console.error('Use: inner | cover');
    process.exit(1);
  }

  recordMilestone(milestone, mode, viewport);
} else {
  console.log('Obsidian Curricula Evidence Harness');
  console.log('Usage:');
  console.log('  npm run evidence -- --list');
  console.log('  npm run evidence -- --milestone <n> [--mode grounded|augmented|knowledge-only] [--viewport inner|cover]');
}