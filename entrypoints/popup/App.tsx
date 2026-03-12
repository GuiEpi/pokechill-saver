import { useState, useEffect, useCallback } from "react";
import "./App.css";

type Status = "idle" | "loading" | "success" | "error";

type MessageKey = Parameters<typeof browser.i18n.getMessage>[0];

const t = (key: MessageKey, ...args: string[]) =>
    browser.i18n.getMessage(key, args) || key;

function App() {
    const [connected, setConnected] = useState(false);
    const [status, setStatus] = useState<Status>("idle");
    const [message, setMessage] = useState("");
    const [checking, setChecking] = useState(true);
    const [lastSync, setLastSync] = useState<number | null>(null);

    const formatSync = (ts: number) => {
        const date = new Date(ts);
        return date.toLocaleString();
    };

    const checkAuth = useCallback(async () => {
        setChecking(true);
        const res = await browser.runtime.sendMessage({
            type: "DROPBOX_STATUS",
        });
        setConnected(res.authenticated);
        if (res.lastSync) setLastSync(res.lastSync);
        setChecking(false);
    }, []);

    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    const showMessage = (msg: string, s: Status) => {
        setMessage(msg);
        setStatus(s);
        if (s === "success") setTimeout(() => setStatus("idle"), 3000);
    };

    const handleConnect = async () => {
        setStatus("loading");
        setMessage(t("connecting_dropbox"));
        try {
            const res = await browser.runtime.sendMessage({
                type: "DROPBOX_AUTH",
            });
            if (res.success) {
                setConnected(true);
                showMessage(t("connected_success"), "success");
            } else {
                const error = res.error || "";
                if (
                    error.includes("not approve") ||
                    error.includes("cancelled") ||
                    error.includes("canceled")
                ) {
                    showMessage(t("approve_access"), "error");
                } else {
                    showMessage(error || t("connection_failed"), "error");
                }
            }
        } catch (err) {
            const msg = String(err);
            if (
                msg.includes("not approve") ||
                msg.includes("cancelled") ||
                msg.includes("canceled")
            ) {
                showMessage(t("approve_access"), "error");
            } else {
                showMessage(`${t("connection_failed")}: ${msg}`, "error");
            }
        }
    };

    const handleDisconnect = async () => {
        await browser.runtime.sendMessage({ type: "DROPBOX_LOGOUT" });
        setConnected(false);
        showMessage(t("disconnected"), "success");
    };

    const getPokeChillTab = async (): Promise<number | null> => {
        const tabs = await browser.tabs.query({
            url: "https://play-pokechill.github.io/*",
        });
        return tabs[0]?.id ?? null;
    };

    const handleSave = async () => {
        setStatus("loading");
        setMessage(t("saving_game_data"));
        try {
            const tabId = await getPokeChillTab();
            if (!tabId) {
                showMessage(t("tab_not_found"), "error");
                return;
            }

            const gameRes = await browser.tabs.sendMessage(tabId, {
                type: "GET_GAME_DATA",
            });
            if (!gameRes.success || !gameRes.data) {
                showMessage(t("no_game_data"), "error");
                return;
            }

            const saveRes = await browser.runtime.sendMessage({
                type: "DROPBOX_SAVE",
                data: gameRes.data,
            });

            if (saveRes.success) {
                setLastSync(saveRes.lastSync || Date.now());
                showMessage(t("game_saved"), "success");
            } else {
                showMessage(saveRes.error || t("save_failed"), "error");
            }
        } catch (err) {
            showMessage(`${t("save_failed")}: ${err}`, "error");
        }
    };

    const handleLoad = async () => {
        setStatus("loading");
        setMessage(t("loading_game_data"));
        try {
            const tabId = await getPokeChillTab();
            if (!tabId) {
                showMessage(t("tab_not_found"), "error");
                return;
            }

            const loadRes = await browser.runtime.sendMessage({
                type: "DROPBOX_LOAD",
            });
            if (!loadRes.success) {
                showMessage(loadRes.error || t("load_failed"), "error");
                return;
            }
            if (!loadRes.data) {
                showMessage(t("no_save_found"), "error");
                return;
            }

            const setRes = await browser.tabs.sendMessage(tabId, {
                type: "SET_GAME_DATA",
                data: loadRes.data,
            });

            if (setRes.success) {
                showMessage(t("game_loaded"), "success");
            } else {
                showMessage(setRes.error || t("set_data_failed"), "error");
            }
        } catch (err) {
            showMessage(`${t("load_failed")}: ${err}`, "error");
        }
    };

    if (checking) {
        return (
            <div className="container">
                <p className="checking">{t("checking")}</p>
            </div>
        );
    }

    return (
        <div className="container">
            <h1>pokechill-saver</h1>

            {!connected ? (
                <button
                    className="btn btn-connect"
                    onClick={handleConnect}
                    disabled={status === "loading"}
                >
                    {t("connect_dropbox")}
                </button>
            ) : (
                <div className="actions">
                    <div className="connected-badge">
                        {t("dropbox_connected")}
                        {lastSync && (
                            <span className="last-sync">
                                {t("last_sync", formatSync(lastSync))}
                            </span>
                        )}
                    </div>
                    <button
                        className="btn btn-save"
                        onClick={handleSave}
                        disabled={status === "loading"}
                    >
                        {t("save_to_dropbox")}
                    </button>
                    <button
                        className="btn btn-load"
                        onClick={handleLoad}
                        disabled={status === "loading"}
                    >
                        {t("load_from_dropbox")}
                    </button>
                    <button
                        className="btn btn-disconnect"
                        onClick={handleDisconnect}
                        disabled={status === "loading"}
                    >
                        {t("disconnect")}
                    </button>
                </div>
            )}

            {message && (
                <p className={`message message-${status}`}>{message}</p>
            )}

            <div className="footer">
                <a
                    href="https://github.com/guiepi/pokechill-saver"
                    target="_blank"
                    rel="noreferrer"
                >
                    GitHub
                </a>
            </div>
        </div>
    );
}

export default App;
