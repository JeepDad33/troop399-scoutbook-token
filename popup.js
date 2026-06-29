function setConnectionStatus(status, message) {

    const connection = document.getElementById("connection");

    connection.classList.remove("green", "red", "yellow", "blue");
    connection.classList.add(status);
    connection.textContent = message;

}

function clearFields() {

    document.getElementById("username").textContent = "-";
    document.getElementById("expires").textContent = "-";
    document.getElementById("goodUntil").textContent = "-";
    document.getElementById("clipboard").textContent = "-";

}

document.addEventListener("DOMContentLoaded", async () => {

    setConnectionStatus("blue", "Checking Scoutbook...");

    const allowedDomains = [
        "https://advancements.scouting.org",
        "https://my.scouting.org",
        "https://api.scouting.org",
        "https://auth.scouting.org"
    ];

    let [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
    });

    if (!allowedDomains.some(domain => tab.url.startsWith(domain))) {

        setConnectionStatus("red", "Not a Scoutbook page");
        clearFields();
        return;

    }

    chrome.scripting.executeScript({

        target: {
            tabId: tab.id
        },

        func: () => {

            const cu =
                localStorage.currentUser ||
                localStorage.LOGIN_DATA;

            let token = null;

            if (cu) {
                token = JSON.parse(cu).token;
            }

            if (!token && localStorage.token) {
                token = localStorage.token.replace(/^"|"$/g, "");
            }

            if (!token) {

                return {
                    connected: false
                };

            }

            function decodeJwt(token) {

                const base64Url = token.split(".")[1];

                const base64 = base64Url
                    .replace(/-/g, "+")
                    .replace(/_/g, "/");

                const jsonPayload = decodeURIComponent(

                    atob(base64)
                        .split("")
                        .map(c =>
                            "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)
                        )
                        .join("")

                );

                return JSON.parse(jsonPayload);

            }

            try {

                const jwt = decodeJwt(token);

                return {

                    connected: true,
                    username: jwt.user,
                    expires: jwt.exp,
                    token: token

                };

            }
            catch {

                return {

                    connected: false,
                    invalid: true

                };

            }

        }

    }).then(async results => {

        const data = results[0].result;

        if (data.invalid) {

            setConnectionStatus("red", "Invalid session token");
            clearFields();
            return;

        }

        if (!data.connected) {

            setConnectionStatus("red", "Not logged into Scoutbook");
            clearFields();
            return;

        }

        document.getElementById("username").textContent = data.username;

        const expires = new Date(data.expires * 1000);

        document.getElementById("goodUntil").textContent =
            expires.toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit"
            });

        const seconds =
            data.expires - Math.floor(Date.now() / 1000);

        let text;

        if (seconds <= 0) {

            text = "Expired";
            setConnectionStatus("red", "Session expired");

        }
        else if (seconds <= 300) {

            const m = Math.floor(seconds / 60);
            const s = seconds % 60;

            text = `${m}m ${s}s`;

            setConnectionStatus("yellow", "Session expires soon");

        }
        else if (seconds >= 3600) {

            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);

            text = `${h}h ${m}m`;

            setConnectionStatus("green", "Connected to Scoutbook");

        }
        else if (seconds >= 60) {

            const m = Math.floor(seconds / 60);

            text = `${m}m`;

            setConnectionStatus("green", "Connected to Scoutbook");

        }
        else {

            text = `${seconds}s`;

            setConnectionStatus("yellow", "Session expires soon");

        }

        document.getElementById("expires").textContent = text;

        try {

            await navigator.clipboard.writeText(data.token);

            document.getElementById("clipboard").textContent =
                "✓ Token copied to clipboard";

        }
        catch {

            document.getElementById("clipboard").textContent =
                "✕ Unable to copy token";

            setConnectionStatus("red", "Clipboard unavailable");

        }

    }).catch(error => {

        console.error(error);

        setConnectionStatus("red", "Unexpected error");
        clearFields();

    });

});