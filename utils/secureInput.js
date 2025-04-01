export function sanitizeInput(text) {
    if (!text) return "";
    return text
        .normalize("NFKC")
        .replace(/[\u200B-\u200D\uFEFF\u2060-\u206F]/g, "")
        .replace(/[\p{Cf}]/gu, "")
        .replace(/\s+/g, " ")
        .trim();
}

export const forbiddenPatterns = [
    /forget\s+(about|everything|the\s+above|all)/i,
    /ignore\s+(the\s+previous|all|everything|the\s+above)/i,
    /as\s+an\s+ai(\s+language\s+model)?/i,
    /act\s+as/i,
    /pretend\s+to/i,
    /jailbroken/i,
    /developer\s+mode/i,
    /simulate/i,
    /role\s*:/i,
    /system\s*:/i,
    /you\s+are\s+an\s+AI/i,
    /bypass\s+filter/i,
    /ignore\s+all\s+rules/i
];

const forbiddenWords = [
    "forget", "ignore", "prompt", "as an ai", "jailbroken",
    "system", "role:", "write me", "act as", "pretend to", "developer mode",
    "simulate", "bypass filter", "ignore all rules"
];

export function hasAdvancedInjection(text) {
    if (!text) return false;
    const clean = sanitizeInput(text).toLowerCase();
    return forbiddenWords.some(word => clean.includes(word)) || forbiddenPatterns.some(p => p.test(clean));
}

export function isTooLong(text, max = 100) {
    return sanitizeInput(text).length > max;
}
