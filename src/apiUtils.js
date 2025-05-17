import fetch from "node-fetch";

const apiPost = async (url, token, data) => {
    return await fetch(url, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data)
    });
}

const apiGet = async (url, token) => {
    return fetch(url, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`,
        }
    });
}

export { apiPost, apiGet };