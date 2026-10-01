import {
    alertNode,
    badge,
    describeError,
    element,
    setButtonBusy
} from "./ui.js";

const OWNER_ROLE = "Owner";
const DORKS_MODE = "dorks-and-dice";
const POLL_INTERVAL_MS = 2000;

export function installCorpusReconciliationMaintenance(app) {
    const canRun = app.hostContext.siteMode === DORKS_MODE
        && (app.session.globalRoles ?? []).includes(OWNER_ROLE);
    if (!canRun) return;

    const renderActiveView = app.renderActiveView.bind(app);
    app.renderActiveView = async container => {
        await renderActiveView(container);
        if (app.activeView === "source-admin") {
            await renderCorpusReconciliationMaintenance(app, container);
        }
    };
}

async function renderCorpusReconciliationMaintenance(app, container) {
    const card = element("div", { className: "card card-body mt-3" });
    const heading = element("div", { className: "d-flex flex-wrap gap-2 align-items-center mb-2" },
        element("h4", { className: "h6 mb-0", text: "Historical corpus reconciliation" }));
    const description = element("p", {
        className: "mb-2",
        text: "Owner-only temporary maintenance. Migrates legacy 5e.tools fluff into companion content, resolves pending companion attachments, and rebuilds canonical reference histories while Rules Core remains online."
    });
    const detail = element("p", {
        className: "small text-body-secondary mb-3",
        text: "The job runs outside the browser request and is serialized by Rules Core. Closing this page does not cancel it. Once the durable backfill marker is recorded, the action can not be started again from this control."
    });
    const statusHost = element("div", { className: "mb-3" });
    const actionHost = element("div", { className: "d-flex flex-wrap gap-2" });
    const startButton = element("button", {
        type: "button",
        className: "btn btn-warning",
        text: "Reconcile existing corpus"
    });
    actionHost.append(startButton);
    card.append(heading, description, detail, statusHost, actionHost);
    container.append(card);

    let pollToken = 0;

    async function refreshStatus(scheduleNext = true) {
        const token = ++pollToken;
        try {
            const status = await app.api.operation("getCorpusReconciliationStatus");
            if (token !== pollToken) return;
            applyStatus(status);
            if (status.state === "running" && scheduleNext && card.isConnected && app.activeView === "source-admin") {
                window.setTimeout(() => refreshStatus(true), POLL_INTERVAL_MS);
            }
        } catch (error) {
            if (token !== pollToken) return;
            statusHost.replaceChildren(alertNode("danger", describeError(error)));
            startButton.disabled = false;
        }
    }

    function applyStatus(status) {
        renderStatus(statusHost, status);
        const running = status.state === "running";
        const completed = status.state === "completed";
        startButton.disabled = running || completed;
        startButton.textContent = running
            ? "Reconciliation running…"
            : completed
                ? "Corpus reconciled"
                : "Reconcile existing corpus";
    }

    startButton.addEventListener("click", async () => {
        setButtonBusy(startButton, true, "Starting…");
        statusHost.replaceChildren();
        try {
            const status = await app.api.operation("startCorpusReconciliation");
            applyStatus(status);
            if (status.state === "running") {
                window.setTimeout(() => refreshStatus(true), POLL_INTERVAL_MS);
            }
        } catch (error) {
            statusHost.replaceChildren(alertNode("danger", describeError(error)));
        } finally {
            setButtonBusy(startButton, false);
            await refreshStatus(true);
        }
    });

    await refreshStatus(true);
}

function renderStatus(container, status) {
    const state = status?.state ?? "not-run";
    const tone = state === "completed" ? "success"
        : state === "running" ? "warning"
            : state === "failed" ? "danger"
                : "secondary";
    const label = state === "completed" ? "Completed"
        : state === "running" ? "Running"
            : state === "failed" ? "Failed"
                : "Not run";

    const row = element("div", { className: "d-flex flex-wrap gap-2 align-items-center" },
        badge(label, tone));
    if (status?.startedAt) {
        row.append(element("span", {
            className: "small text-body-secondary",
            text: `Started ${formatTimestamp(status.startedAt)}`
        }));
    }
    if (status?.completedAt) {
        row.append(element("span", {
            className: "small text-body-secondary",
            text: `Completed ${formatTimestamp(status.completedAt)}`
        }));
    }

    container.replaceChildren(row);
    if (status?.error) {
        container.append(alertNode("danger", status.error));
    } else if (state === "running") {
        container.append(element("div", {
            className: "small text-body-secondary mt-2",
            text: "Rules Core remains available while the historical reconciliation runs."
        }));
    } else if (state === "completed") {
        container.append(element("div", {
            className: "small text-body-secondary mt-2",
            text: "The durable reference-history and companion-content backfill marker has been recorded."
        }));
    }
}

function formatTimestamp(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}
