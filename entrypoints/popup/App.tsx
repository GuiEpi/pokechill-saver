import { useState, useEffect, useCallback } from "react";
import "./App.css";

type Status = "idle" | "loading" | "success" | "error";

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
        setMessage("Connecting to Dropbox...");
        try {
            const res = await browser.runtime.sendMessage({
                type: "DROPBOX_AUTH",
            });
            if (res.success) {
                setConnected(true);
                showMessage("Connected to Dropbox!", "success");
            } else {
                const error = res.error || "";
                if (
                    error.includes("not approve") ||
                    error.includes("cancelled") ||
                    error.includes("canceled")
                ) {
                    showMessage(
                        "Please approve access to Dropbox to continue.",
                        "error",
                    );
                } else {
                    showMessage(error || "Connection failed", "error");
                }
            }
        } catch (err) {
            const msg = String(err);
            if (
                msg.includes("not approve") ||
                msg.includes("cancelled") ||
                msg.includes("canceled")
            ) {
                showMessage(
                    "Please approve access to Dropbox to continue.",
                    "error",
                );
            } else {
                showMessage(`Connection failed: ${msg}`, "error");
            }
        }
    };

    const handleDisconnect = async () => {
        await browser.runtime.sendMessage({ type: "DROPBOX_LOGOUT" });
        setConnected(false);
        showMessage("Disconnected", "success");
    };

    const getPokeChillTab = async (): Promise<number | null> => {
        const tabs = await browser.tabs.query({
            url: "https://play-pokechill.github.io/*",
        });
        return tabs[0]?.id ?? null;
    };

    const handleSave = async () => {
        setStatus("loading");
        setMessage("Saving game data...");
        try {
            const tabId = await getPokeChillTab();
            if (!tabId) {
                showMessage(
                    "pokechill tab not found. Open the game first!",
                    "error",
                );
                return;
            }

            const gameRes = await browser.tabs.sendMessage(tabId, {
                type: "GET_GAME_DATA",
            });
            if (!gameRes.success || !gameRes.data) {
                showMessage("No game data found in pokechill", "error");
                return;
            }

            const saveRes = await browser.runtime.sendMessage({
                type: "DROPBOX_SAVE",
                data: gameRes.data,
            });

            if (saveRes.success) {
                setLastSync(saveRes.lastSync || Date.now());
                showMessage("Game saved to Dropbox!", "success");
            } else {
                showMessage(saveRes.error || "Save failed", "error");
            }
        } catch (err) {
            showMessage(`Save failed: ${err}`, "error");
        }
    };

    const handleLoad = async () => {
        setStatus("loading");
        setMessage("Loading game data...");
        try {
            const tabId = await getPokeChillTab();
            if (!tabId) {
                showMessage(
                    "pokechill tab not found. Open the game first!",
                    "error",
                );
                return;
            }

            const loadRes = await browser.runtime.sendMessage({
                type: "DROPBOX_LOAD",
            });
            if (!loadRes.success) {
                showMessage(loadRes.error || "Load failed", "error");
                return;
            }
            if (!loadRes.data) {
                showMessage("No save found on Dropbox", "error");
                return;
            }

            const setRes = await browser.tabs.sendMessage(tabId, {
                type: "SET_GAME_DATA",
                data: loadRes.data,
            });

            if (setRes.success) {
                showMessage(
                    "Game data loaded! Refresh the game page.",
                    "success",
                );
            } else {
                showMessage(setRes.error || "Failed to set game data", "error");
            }
        } catch (err) {
            showMessage(`Load failed: ${err}`, "error");
        }
    };

    if (checking) {
        return (
            <div className="container">
                <p className="checking">Checking connection...</p>
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
                    Connect Dropbox
                </button>
            ) : (
                <div className="actions">
                    <div className="connected-badge">
                        Dropbox Connected
                        {lastSync && (
                            <span className="last-sync">
                                Last sync: {formatSync(lastSync)}
                            </span>
                        )}
                    </div>
                    <button
                        className="btn btn-save"
                        onClick={handleSave}
                        disabled={status === "loading"}
                    >
                        Save to Dropbox
                    </button>
                    <button
                        className="btn btn-load"
                        onClick={handleLoad}
                        disabled={status === "loading"}
                    >
                        Load from Dropbox
                    </button>
                    <button
                        className="btn btn-disconnect"
                        onClick={handleDisconnect}
                        disabled={status === "loading"}
                    >
                        Disconnect
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
