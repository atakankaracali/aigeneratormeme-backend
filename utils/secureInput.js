export function sanitizeInput(text) {
    if (!text) return "";
    return text
        .normalize("NFKC")
        .replace(/[\u200B-\u200D\uFEFF\u2060-\u206F]/g, "")
        .replace(/[\p{Cf}]/gu, "");
}

export const forbiddenPatterns = [
    /forget\s+(about|everything|the\s+above)/i,
    /ignore\s+(the\s+previous|all\s+above|everything)/i,
    /as\s+an\s+ai/i,
    /act\s+as/i,
    /pretend\s+to/i,
    /jailbroken/i,
    /developer\s+mode/i,
    /simulate/i,
    /role\s*:/i,
    /system\s*:/i
];

export function hasAdvancedInjection(text) {
    if (!text) return false;
    const clean = sanitizeInput(text).toLowerCase();
    const forbiddenWords = [
        "forget", "ignore", "prompt", "as an ai", "jailbroken",
        "system", "role:", "write me", "act as", "pretend to", "developer mode", "simulate"
    ];

    if (forbiddenWords.some(word => clean.includes(word))) return true;
    if (forbiddenPatterns.some(p => p.test(clean))) return true;
    return false;
}

export function isTooLong(text, max = 100) {
    return sanitizeInput(text).length > max;
}
