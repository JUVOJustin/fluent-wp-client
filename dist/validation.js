/**
 * Error thrown when one Standard Schema validator reports issues.
 */
export class WordPressSchemaValidationError extends Error {
    issues;
    constructor(message, issues) {
        super(message);
        this.name = 'WordPressSchemaValidationError';
        this.issues = issues;
    }
}
/**
 * Checks whether one unknown value exposes the Standard Schema API.
 */
export function isStandardSchema(value) {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const standard = value['~standard'];
    if (typeof standard !== 'object' || standard === null) {
        return false;
    }
    return typeof standard.validate === 'function';
}
/**
 * Formats one issue path to keep validation error messages readable.
 */
function formatIssuePath(issue) {
    if (!issue.path || issue.path.length === 0) {
        return 'root';
    }
    return issue.path
        .map((segment) => {
        if (typeof segment === 'object' && segment !== null && 'key' in segment) {
            return String(segment.key);
        }
        return String(segment);
    })
        .join('.');
}
/**
 * Converts validation issues into one concise, human-readable message.
 */
function formatIssues(issues) {
    return issues
        .map((issue) => `${formatIssuePath(issue)}: ${issue.message}`)
        .join('; ');
}
/**
 * Validates one unknown value against a Standard Schema validator.
 */
export async function validateWithStandardSchema(schema, value, context = 'Schema validation failed') {
    let result = schema['~standard'].validate(value);
    if (result instanceof Promise) {
        result = await result;
    }
    if (result.issues) {
        throw new WordPressSchemaValidationError(`${context}: ${formatIssues(result.issues)}`, result.issues);
    }
    return result.value;
}
