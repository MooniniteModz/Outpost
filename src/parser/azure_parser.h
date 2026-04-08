#pragma once

#include "parser/parser.h"
#include <nlohmann/json.hpp>

namespace outpost {

/// ────────────────────────────────────────────────────────────────
/// AzureParser: parses Azure Activity Log and Entra ID Sign-In events.
///
/// Activity Log events (from Azure Monitor API):
///   operationName, caller, resourceId, status, category, level
///
/// Sign-In events (from Microsoft Graph /auditLogs/signIns):
///   userPrincipalName, ipAddress, location (with geoCoordinates),
///   status, clientAppUsed, deviceDetail, riskLevelDuringSignIn
///   → Geolocation extracted into metadata for globe display
/// ────────────────────────────────────────────────────────────────
class AzureParser : public Parser {
public:
    std::optional<Event> parse(const RawMessage& raw) override;
    const char* name() const override { return "azure"; }

private:
    std::optional<Event> parse_signin(const nlohmann::json& j, Event& event);
    Category categorize_operation(const std::string& operation_name);
    std::string simplify_operation(const std::string& operation_name);
    Severity map_level(const std::string& level);
};

} // namespace outpost
