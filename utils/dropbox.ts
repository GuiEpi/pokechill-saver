const APP_KEY = import.meta.env.VITE_DROPBOX_APP_KEY;
const SAVE_PATH = "/pokechill-save.json";

// PKCE helpers
function generateRandomString(length: number): string {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(plain: string): Promise<ArrayBuffer> {
    const encoder = new TextEncoder();
    return crypto.subtle.digest("SHA-256", encoder.encode(plain));
}

function base64UrlEncode(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    bytes.forEach((b) => (binary += String.fromCharCode(b)));
    return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

export async function getAuthUrl(): Promise<{
    url: string;
    codeVerifier: string;
}> {
    const redirectUrl = browser.identity.getRedirectURL();
    const codeVerifier = generateRandomString(64);
    const codeChallenge = base64UrlEncode(await sha256(codeVerifier));

    const params = new URLSearchParams({
        client_id: APP_KEY,
        response_type: "code",
        redirect_uri: redirectUrl,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        token_access_type: "offline",
    });

    return {
        url: `https://www.dropbox.com/oauth2/authorize?${params.toString()}`,
        codeVerifier,
    };
}

export async function exchangeCodeForToken(
    code: string,
    codeVerifier: string,
): Promise<{ access_token: string; refresh_token: string }> {
    const redirectUrl = browser.identity.getRedirectURL();

    const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            code,
            grant_type: "authorization_code",
            client_id: APP_KEY,
            redirect_uri: redirectUrl,
            code_verifier: codeVerifier,
        }),
    });

    if (!res.ok) throw new Error(`Token exchange failed: ${res.statusText}`);
    return res.json();
}

export async function refreshAccessToken(
    refreshToken: string,
): Promise<string> {
    const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: refreshToken,
            client_id: APP_KEY,
        }),
    });

    if (!res.ok) throw new Error(`Token refresh failed: ${res.statusText}`);
    const data = await res.json();
    return data.access_token;
}

async function getValidToken(): Promise<string> {
    const stored = await browser.storage.local.get([
        "dropbox_access_token",
        "dropbox_refresh_token",
    ]);
    if (!stored.dropbox_access_token) throw new Error("Not authenticated");

    // Try using current token, refresh if needed
    try {
        const test = await fetch(
            "https://api.dropboxapi.com/2/users/get_current_account",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${stored.dropbox_access_token}`,
                },
            },
        );
        if (test.ok) return stored.dropbox_access_token as string;
    } catch {
        // Token expired, try refresh
    }

    if (!stored.dropbox_refresh_token) throw new Error("No refresh token");
    const newToken = await refreshAccessToken(stored.dropbox_refresh_token as string);
    await browser.storage.local.set({ dropbox_access_token: newToken });
    return newToken;
}

export async function uploadSave(gameData: string): Promise<void> {
    const token = await getValidToken();

    const res = await fetch("https://content.dropboxapi.com/2/files/upload", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/octet-stream",
            "Dropbox-API-Arg": JSON.stringify({
                path: SAVE_PATH,
                mode: "overwrite",
                mute: true,
            }),
        },
        body: gameData,
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Upload failed: ${err}`);
    }
}

export async function downloadSave(): Promise<string | null> {
    const token = await getValidToken();

    const res = await fetch("https://content.dropboxapi.com/2/files/download", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Dropbox-API-Arg": JSON.stringify({ path: SAVE_PATH }),
        },
    });

    if (res.status === 409) return null; // File not found
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Download failed: ${err}`);
    }

    return res.text();
}

export async function isAuthenticated(): Promise<boolean> {
    const stored = await browser.storage.local.get(["dropbox_access_token"]);
    return !!stored.dropbox_access_token;
}

export async function logout(): Promise<void> {
    await browser.storage.local.remove([
        "dropbox_access_token",
        "dropbox_refresh_token",
    ]);
}
