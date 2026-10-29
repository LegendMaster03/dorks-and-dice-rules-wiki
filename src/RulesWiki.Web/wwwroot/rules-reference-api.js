// Direct native contract. No source revisions, authored concepts, or campaign projections.
export function installNativeReferenceApi(api) {
    api.getNativeRulesets = () => api.operation("getNativeRulesets");
    api.searchNativeRules = (rulesetId, options = {}) =>
        api.operation("searchNativeRules", [rulesetId, options]);
    api.getNativeRule = (rulesetId, ruleId) =>
        api.operation("getNativeRule", [rulesetId, ruleId]);
    return api;
}
