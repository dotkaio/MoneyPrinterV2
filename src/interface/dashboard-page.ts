export const dashboardPage = String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>MoneyPrinter — Local control center</title>
    <style>
      :root {
        --ink: #18211d;
        --muted: #68736d;
        --line: #dfe4df;
        --canvas: #f3f4ef;
        --surface: #ffffff;
        --surface-soft: #f8f9f6;
        --accent: #176b4d;
        --accent-soft: #daf1e7;
        --warn: #9c5b14;
        --warn-soft: #fff0d7;
        --danger: #a83f3f;
        --danger-soft: #fbe3e3;
        --shadow: 0 18px 50px rgba(24, 33, 29, 0.08);
        font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont,
          "Segoe UI", sans-serif;
      }

      * { box-sizing: border-box; }
      html { scroll-behavior: smooth; }
      body {
        margin: 0;
        min-width: 320px;
        color: var(--ink);
        background:
          radial-gradient(circle at 75% -10%, rgba(111, 191, 154, 0.18), transparent 33rem),
          var(--canvas);
      }
      button { font: inherit; }

      .shell { min-height: 100vh; display: grid; grid-template-columns: 248px 1fr; }
      .sidebar {
        position: sticky;
        top: 0;
        height: 100vh;
        padding: 26px 18px;
        border-right: 1px solid rgba(24, 33, 29, 0.1);
        background: rgba(248, 249, 246, 0.9);
        backdrop-filter: blur(18px);
      }
      .brand { display: flex; align-items: center; gap: 12px; padding: 0 8px 28px; }
      .brand-mark {
        width: 38px; height: 38px; display: grid; place-items: center;
        border-radius: 12px; color: white; font-weight: 800;
        background: var(--ink); box-shadow: 0 8px 20px rgba(24, 33, 29, 0.18);
      }
      .brand-name { font-size: 15px; font-weight: 760; letter-spacing: -0.02em; }
      .brand-subtitle { margin-top: 2px; color: var(--muted); font-size: 11px; }
      .nav-label { padding: 0 10px 8px; color: #8b948f; font-size: 10px; font-weight: 750; letter-spacing: 0.11em; text-transform: uppercase; }
      .nav { display: grid; gap: 4px; }
      .nav a {
        display: flex; align-items: center; gap: 11px; padding: 10px 12px;
        border-radius: 10px; color: #52605a; font-size: 13px; font-weight: 620;
        text-decoration: none;
      }
      .nav a:hover, .nav a.active { color: var(--ink); background: #e8ebe6; }
      .nav-icon { width: 20px; text-align: center; color: #76827c; }
      .sidebar-footer {
        position: absolute; right: 18px; bottom: 22px; left: 18px;
        padding: 13px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface);
      }
      .local-row { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; }
      .local-dot { width: 8px; height: 8px; border-radius: 50%; background: #2ca676; box-shadow: 0 0 0 4px #dff4eb; }
      .local-copy { margin-top: 7px; color: var(--muted); font-size: 10px; line-height: 1.45; }

      .main { min-width: 0; padding: 24px 34px 54px; }
      .topbar { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-bottom: 30px; }
      .eyebrow { color: var(--muted); font-size: 11px; font-weight: 720; letter-spacing: 0.08em; text-transform: uppercase; }
      .topbar h1 { margin: 5px 0 0; font-size: 20px; letter-spacing: -0.035em; }
      .actions { display: flex; gap: 9px; }
      .button {
        display: inline-flex; align-items: center; justify-content: center; gap: 8px;
        min-height: 38px; padding: 0 14px; border: 1px solid var(--line); border-radius: 10px;
        color: var(--ink); background: var(--surface); cursor: pointer; font-size: 12px; font-weight: 700;
        box-shadow: 0 2px 7px rgba(24, 33, 29, 0.04);
      }
      .button:hover { border-color: #bcc6c0; transform: translateY(-1px); }
      .button.primary { color: white; border-color: var(--ink); background: var(--ink); }
      .button:disabled { opacity: 0.6; cursor: wait; transform: none; }

      .hero {
        position: relative; overflow: hidden; display: grid; grid-template-columns: 1.5fr 0.7fr; gap: 30px;
        min-height: 218px; padding: 34px; border: 1px solid rgba(24, 33, 29, 0.08); border-radius: 20px;
        color: #f7fbf8; background: #183a2f; box-shadow: var(--shadow);
      }
      .hero::after {
        content: ""; position: absolute; width: 330px; height: 330px; right: -75px; top: -110px;
        border: 1px solid rgba(255,255,255,0.12); border-radius: 50%; box-shadow: 0 0 0 52px rgba(255,255,255,0.035), 0 0 0 105px rgba(255,255,255,0.02);
      }
      .hero-copy { position: relative; z-index: 1; max-width: 610px; }
      .hero-kicker { display: flex; align-items: center; gap: 8px; color: #b9dfce; font-size: 11px; font-weight: 750; letter-spacing: 0.08em; text-transform: uppercase; }
      .hero h2 { margin: 14px 0 12px; max-width: 600px; font-size: clamp(29px, 4vw, 44px); line-height: 1.02; letter-spacing: -0.055em; }
      .hero p { max-width: 570px; margin: 0; color: #bed2ca; font-size: 13px; line-height: 1.65; }
      .hero-meta { position: relative; z-index: 1; align-self: end; padding: 16px; border: 1px solid rgba(255,255,255,0.12); border-radius: 14px; background: rgba(255,255,255,0.07); backdrop-filter: blur(8px); }
      .hero-meta-label { color: #a8cabc; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; }
      .hero-meta-value { margin-top: 8px; font-size: 13px; font-weight: 750; }
      .hero-meta-copy { margin-top: 5px; color: #afc7bd; font-size: 10px; line-height: 1.45; }

      .metrics { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; margin-top: 14px; }
      .metric { padding: 18px; border: 1px solid var(--line); border-radius: 14px; background: rgba(255,255,255,0.78); }
      .metric-label { color: var(--muted); font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
      .metric-value { margin-top: 8px; font-size: 27px; font-weight: 760; letter-spacing: -0.045em; }
      .metric-detail { margin-top: 3px; color: #8b948f; font-size: 10px; }

      .section { scroll-margin-top: 20px; margin-top: 34px; }
      .section-head { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
      .section h3 { margin: 0; font-size: 17px; letter-spacing: -0.03em; }
      .section-copy { margin-top: 4px; color: var(--muted); font-size: 11px; }
      .timestamp { color: #8d9691; font-size: 10px; }

      .panel { border: 1px solid var(--line); border-radius: 16px; background: var(--surface); box-shadow: 0 5px 20px rgba(24, 33, 29, 0.035); }
      .account-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
      .account-card { padding: 18px; }
      .account-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
      .platform { display: flex; align-items: center; gap: 10px; min-width: 0; }
      .platform-mark { width: 34px; height: 34px; display: grid; place-items: center; flex: 0 0 auto; border-radius: 10px; color: white; background: var(--ink); font-size: 11px; font-weight: 800; text-transform: uppercase; }
      .account-name { overflow: hidden; font-size: 13px; font-weight: 750; text-overflow: ellipsis; white-space: nowrap; }
      .account-platform { margin-top: 3px; color: var(--muted); font-size: 10px; text-transform: capitalize; }
      .account-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 18px; padding-top: 14px; border-top: 1px solid #edf0ec; }
      .meta-label { color: #929b96; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
      .meta-value { overflow: hidden; margin-top: 4px; color: #46534d; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }

      .badge { display: inline-flex; align-items: center; gap: 5px; padding: 5px 8px; border-radius: 999px; font-size: 9px; font-weight: 750; text-transform: capitalize; white-space: nowrap; }
      .badge::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
      .tone-ok { color: var(--accent); background: var(--accent-soft); }
      .tone-warn { color: var(--warn); background: var(--warn-soft); }
      .tone-danger { color: var(--danger); background: var(--danger-soft); }
      .tone-neutral { color: #65706a; background: #edf0ed; }

      .split { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(290px, 0.65fr); gap: 14px; }
      .list { overflow: hidden; }
      .list-row { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(100px, 0.6fr) minmax(110px, 0.6fr); align-items: center; gap: 12px; min-height: 62px; padding: 12px 16px; border-bottom: 1px solid #edf0ec; }
      .list-row:last-child { border-bottom: 0; }
      .row-title { overflow: hidden; font-size: 12px; font-weight: 720; text-overflow: ellipsis; white-space: nowrap; }
      .row-copy { margin-top: 4px; color: var(--muted); font-size: 10px; }
      .row-end { color: var(--muted); font-size: 10px; text-align: right; }
      .safety { display: grid; gap: 10px; padding: 15px; }
      .safety-row { display: flex; align-items: center; justify-content: space-between; gap: 15px; padding: 13px; border-radius: 11px; background: var(--surface-soft); }
      .safety-title { font-size: 11px; font-weight: 720; }
      .safety-copy { margin-top: 4px; color: var(--muted); font-size: 9px; }

      .preflight-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; padding: 14px; }
      .check { min-width: 0; padding: 13px; border: 1px solid #e8ece8; border-radius: 11px; background: var(--surface-soft); }
      .check-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
      .check-name { overflow: hidden; font-size: 11px; font-weight: 720; text-overflow: ellipsis; white-space: nowrap; }
      .check-detail { overflow: hidden; margin-top: 8px; color: var(--muted); font-size: 9px; line-height: 1.4; text-overflow: ellipsis; white-space: nowrap; }
      .empty { padding: 34px 20px; color: var(--muted); text-align: center; }
      .empty-mark { width: 38px; height: 38px; display: grid; place-items: center; margin: 0 auto 10px; border-radius: 12px; background: #eef1ed; color: #7b8780; font-weight: 800; }
      .empty strong { display: block; color: #4b5751; font-size: 12px; }
      .empty span { display: block; margin-top: 5px; font-size: 10px; }
      .error-banner { display: none; margin-bottom: 14px; padding: 12px 14px; border-radius: 11px; color: var(--danger); background: var(--danger-soft); font-size: 11px; }

      @media (max-width: 1020px) {
        .shell { grid-template-columns: 78px 1fr; }
        .sidebar { padding-inline: 12px; }
        .brand-copy, .nav-label, .nav a span:last-child, .sidebar-footer { display: none; }
        .brand { justify-content: center; padding-inline: 0; }
        .nav a { justify-content: center; }
        .account-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .metrics { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      }
      @media (max-width: 760px) {
        .shell { display: block; }
        .sidebar { position: static; width: auto; height: auto; display: flex; align-items: center; padding: 12px 16px; border-right: 0; border-bottom: 1px solid var(--line); }
        .brand { padding: 0; }
        .nav { display: flex; margin-left: auto; }
        .nav a { padding: 8px; }
        .main { padding: 20px 16px 40px; }
        .topbar { align-items: flex-start; }
        .hero { grid-template-columns: 1fr; padding: 26px; }
        .hero-meta { display: none; }
        .metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .account-grid, .split, .preflight-grid { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-mark">MP</div>
          <div class="brand-copy">
            <div class="brand-name">MoneyPrinter</div>
            <div class="brand-subtitle">Local control center</div>
          </div>
        </div>
        <div class="nav-label">Workspace</div>
        <nav class="nav" aria-label="Dashboard sections">
          <a class="active" href="#overview"><span class="nav-icon">⌂</span><span>Overview</span></a>
          <a href="#accounts"><span class="nav-icon">◎</span><span>Accounts</span></a>
          <a href="#activity"><span class="nav-icon">↗</span><span>Activity</span></a>
          <a href="#system"><span class="nav-icon">◇</span><span>System</span></a>
        </nav>
        <div class="sidebar-footer">
          <div class="local-row"><span class="local-dot"></span>Local mode</div>
          <div class="local-copy">Bound to this Mac only. Credentials remain in Keychain.</div>
        </div>
      </aside>

      <main class="main">
        <header class="topbar">
          <div><div class="eyebrow">Workspace</div><h1>Control center</h1></div>
          <div class="actions">
            <button class="button" id="preflight-button">Run preflight</button>
            <button class="button primary" id="refresh-button">Refresh data</button>
          </div>
        </header>

        <div class="error-banner" id="error-banner" role="alert"></div>

        <section id="overview">
          <div class="hero">
            <div class="hero-copy">
              <div class="hero-kicker"><span class="local-dot"></span>Local-first operations</div>
              <h2>Your content operation, in one place.</h2>
              <p>Monitor connected channels, durable jobs, schedules, and safety gates without exposing account credentials or leaving your machine.</p>
            </div>
            <div class="hero-meta">
              <div class="hero-meta-label">Publishing posture</div>
              <div class="hero-meta-value" id="hero-safety">Loading…</div>
              <div class="hero-meta-copy">External actions remain guarded by explicit safety switches.</div>
            </div>
          </div>
          <div class="metrics" id="metrics"></div>
        </section>

        <section class="section" id="accounts">
          <div class="section-head">
            <div><h3>Connected accounts</h3><div class="section-copy">Publishing identities and reusable authentication status.</div></div>
            <div class="timestamp" id="last-updated">Loading…</div>
          </div>
          <div class="account-grid" id="accounts-grid"></div>
        </section>

        <section class="section" id="activity">
          <div class="section-head"><div><h3>Operations</h3><div class="section-copy">Recent durable work and active automation.</div></div></div>
          <div class="split">
            <div class="panel list" id="jobs-list"></div>
            <div class="panel safety" id="safety-panel"></div>
          </div>
        </section>

        <section class="section" id="schedules">
          <div class="section-head"><div><h3>Schedules</h3><div class="section-copy">Recurring jobs managed by the local worker.</div></div></div>
          <div class="panel list" id="schedules-list"></div>
        </section>

        <section class="section" id="system">
          <div class="section-head"><div><h3>System readiness</h3><div class="section-copy">Run preflight to inspect local tools, models, and provider configuration.</div></div></div>
          <div class="panel" id="preflight-panel"><div class="empty"><div class="empty-mark">✓</div><strong>Ready when you are</strong><span>Run preflight for a live dependency check.</span></div></div>
        </section>
      </main>
    </div>

    <script>
      const byId = (id) => document.getElementById(id);
      const element = (tag, className, text) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
      };
      const clear = (node) => { while (node.firstChild) node.removeChild(node.firstChild); };
      const tone = (state) => {
        if (["connected", "succeeded", "ok", "enabled"].includes(state)) return "tone-ok";
        if (["failed", "error", "expired", "failure"].includes(state)) return "tone-danger";
        if (["warning", "retrying", "running", "queued"].includes(state)) return "tone-warn";
        return "tone-neutral";
      };
      const badge = (label, state) => element("span", "badge " + tone(state || label), label);
      const timeLabel = (value) => {
        if (!value) return "—";
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? value : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
      };
      const empty = (title, copy, mark) => {
        const node = element("div", "empty");
        node.append(element("div", "empty-mark", mark), element("strong", "", title), element("span", "", copy));
        return node;
      };
      const showError = (message) => {
        const banner = byId("error-banner"); banner.textContent = message; banner.style.display = "block";
      };
      const hideError = () => { byId("error-banner").style.display = "none"; };

      function renderMetrics(data) {
        const metrics = [
          ["Accounts", data.counts.accounts, data.counts.connectedAccounts + " connected"],
          ["Content", data.counts.contentItems, "items tracked"],
          ["Active jobs", data.counts.activeJobs, "queued or running"],
          ["Schedules", data.counts.schedules, "enabled"],
          ["Publishing", data.safety.livePublishing ? "Live" : "Safe", data.safety.livePublishing ? "external actions on" : "external actions off"],
        ];
        const root = byId("metrics"); clear(root);
        metrics.forEach(([label, value, detail]) => {
          const card = element("div", "metric");
          card.append(element("div", "metric-label", label), element("div", "metric-value", String(value)), element("div", "metric-detail", detail));
          root.append(card);
        });
      }

      function renderAccounts(accounts) {
        const root = byId("accounts-grid"); clear(root);
        if (!accounts.length) { root.append(empty("No accounts yet", "Add one with the account command, then connect it from auth.", "+")); return; }
        accounts.forEach((account) => {
          const card = element("article", "panel account-card");
          const top = element("div", "account-top");
          const platform = element("div", "platform");
          const label = account.platform.slice(0, 2);
          const copy = element("div");
          copy.append(element("div", "account-name", account.displayName || account.nickname), element("div", "account-platform", account.platform));
          platform.append(element("div", "platform-mark", label), copy);
          top.append(platform, badge(account.connectionState.replace("-", " "), account.connectionState));
          const meta = element("div", "account-meta");
          [["Niche", account.niche], ["Language", account.language]].forEach(([name, value]) => {
            const item = element("div"); item.append(element("div", "meta-label", name), element("div", "meta-value", value)); meta.append(item);
          });
          card.append(top, meta); root.append(card);
        });
      }

      function renderJobs(jobs) {
        const root = byId("jobs-list"); clear(root);
        if (!jobs.length) { root.append(empty("No job activity", "Queued and completed worker jobs will appear here.", "↗")); return; }
        jobs.forEach((job) => {
          const row = element("div", "list-row");
          const copy = element("div"); copy.append(element("div", "row-title", job.type), element("div", "row-copy", "Attempt " + job.attemptCount + " of " + job.maximumAttempts));
          row.append(copy, badge(job.state, job.state), element("div", "row-end", timeLabel(job.updatedAt))); root.append(row);
        });
      }

      function renderSchedules(schedules) {
        const root = byId("schedules-list"); clear(root);
        if (!schedules.length) { root.append(empty("No schedules", "Recurring workflows will show their next run here.", "◷")); return; }
        schedules.forEach((schedule) => {
          const row = element("div", "list-row");
          const copy = element("div"); copy.append(element("div", "row-title", schedule.name), element("div", "row-copy", schedule.jobType + " · " + schedule.cronExpression + " · " + schedule.timezone));
          row.append(copy, badge(schedule.enabled ? "enabled" : "disabled", schedule.enabled ? "enabled" : "disabled"), element("div", "row-end", timeLabel(schedule.nextRunAt))); root.append(row);
        });
      }

      function renderSafety(safety) {
        const root = byId("safety-panel"); clear(root);
        [["Live publishing", safety.livePublishing, "Controls external social publishing"], ["Outreach sending", safety.outreachSending, "Controls external email delivery"]].forEach(([name, enabled, copy]) => {
          const row = element("div", "safety-row"); const text = element("div");
          text.append(element("div", "safety-title", name), element("div", "safety-copy", copy));
          row.append(text, badge(enabled ? "enabled" : "guarded", enabled ? "enabled" : "warning")); root.append(row);
        });
        byId("hero-safety").textContent = safety.livePublishing ? "Live publishing enabled" : "Guarded by default";
      }

      function renderPreflight(results) {
        const root = byId("preflight-panel"); clear(root);
        const grid = element("div", "preflight-grid");
        results.forEach((result) => {
          const check = element("div", "check"); const head = element("div", "check-head");
          head.append(element("div", "check-name", result.name), badge(result.status, result.status));
          check.append(head, element("div", "check-detail", result.detail)); grid.append(check);
        });
        root.append(grid);
      }

      async function loadOverview() {
        const button = byId("refresh-button"); button.disabled = true; hideError();
        try {
          const response = await fetch("/api/overview", { cache: "no-store" });
          if (!response.ok) throw new Error("Overview request failed with HTTP " + response.status);
          const data = await response.json();
          renderMetrics(data); renderAccounts(data.accounts); renderJobs(data.jobs); renderSchedules(data.schedules); renderSafety(data.safety);
          byId("last-updated").textContent = "Updated " + timeLabel(data.generatedAt);
        } catch (error) { showError(error instanceof Error ? error.message : String(error)); }
        finally { button.disabled = false; }
      }

      async function loadPreflight() {
        const button = byId("preflight-button"); button.disabled = true; button.textContent = "Checking…"; hideError();
        try {
          const response = await fetch("/api/preflight", { cache: "no-store" });
          if (!response.ok) throw new Error("Preflight request failed with HTTP " + response.status);
          renderPreflight(await response.json());
        } catch (error) { showError(error instanceof Error ? error.message : String(error)); }
        finally { button.disabled = false; button.textContent = "Run preflight"; }
      }

      byId("refresh-button").addEventListener("click", loadOverview);
      byId("preflight-button").addEventListener("click", loadPreflight);
      loadOverview();
      window.setInterval(loadOverview, 15000);
    </script>
  </body>
</html>`;
