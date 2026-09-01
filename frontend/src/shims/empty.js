// Browser stub for node:fs / node:https — pptxgenjs imports these lazily at
// runtime only when running under Node (isNode guard), never in the browser.
// Webpack aliases resolve to this module so the client bundle can build.
export default {};
