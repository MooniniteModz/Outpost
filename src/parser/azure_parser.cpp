#include "parser/azure_parser.h"
#include "common/utils.h"
#include "common/logger.h"

#include <algorithm>
#include <ctime>
#include <sstream>

namespace outpost {

std::optional<Event> AzureParser::parse(const RawMessage& raw) {
    std::string data = raw.as_string();

    // Detect Azure Sign-In events: either tagged by the http_poller or
    // identified by Graph API /auditLogs/signIns field signatures.
    bool is_signin = data.find("\"_outpost_event_type\":\"azure_signin\"") != std::string::npos;
    if (!is_signin) {
        is_signin = data.find("\"userPrincipalName\"") != std::string::npos &&
                    data.find("\"createdDateTime\"") != std::string::npos;
    }

    if (!is_signin) {
        // Azure Activity logs have operationName and resourceId
        if (data.find("\"operationName\"") == std::string::npos) {
            return std::nullopt;
        }
        if (data.find("\"resourceId\"") == std::string::npos &&
            data.find("\"resourceUri\"") == std::string::npos) {
            return std::nullopt;
        }
    }

    try {
        auto j = nlohmann::json::parse(data);

        Event event;
        event.received_at = now_ms();
        event.source_type = SourceType::Azure;
        event.raw         = data;
        event.source_host = "Azure";

        // Use Azure's own eventDataId for deduplication (avoids duplicate rows
        // when the wider lookback window re-fetches the same event).
        std::string azure_event_id = j.value("eventDataId", "");
        event.event_id = azure_event_id.empty() ? generate_uuid() : "az-act-" + azure_event_id;

        if (is_signin) {
            return parse_signin(j, event);
        }

        // ── Activity Log parsing (existing logic) ──
        std::string operation = j.value("operationName", "");
        std::string caller    = j.value("caller", "");
        std::string resource  = j.value("resourceId", j.value("resourceUri", ""));
        std::string status    = "";
        std::string level     = j.value("level", "");

        if (j.contains("status")) {
            if (j["status"].is_object()) {
                status = j["status"].value("value", "");
            } else if (j["status"].is_string()) {
                status = j["status"].get<std::string>();
            }
        }
        if (status.empty()) {
            status = j.value("resultType", "");
        }

        event.user        = caller;
        event.resource    = resource;

        // ── Timestamp ──
        std::string ts = j.value("eventTimestamp", j.value("time", ""));
        if (!ts.empty()) {
            std::tm tm{};
            std::istringstream ss(ts);
            ss >> std::get_time(&tm, "%Y-%m-%dT%H:%M:%S");
            if (!ss.fail()) {
                event.timestamp = static_cast<int64_t>(timegm(&tm)) * 1000;
            }
        }
        if (event.timestamp == 0) event.timestamp = event.received_at;

        // ── Source IP (from claims or httpRequest) ──
        if (j.contains("httpRequest")) {
            event.src_ip = j["httpRequest"].value("clientIpAddress", "");
        }
        if (event.src_ip.empty() && j.contains("claims")) {
            event.src_ip = j["claims"].value("ipaddr", "");
        }

        // ── Classification ──
        event.category = categorize_operation(operation);
        event.action   = simplify_operation(operation);
        event.severity = map_level(level);

        if (status == "Succeeded" || status == "Started" || status == "Accepted") {
            event.outcome = Outcome::Success;
        } else if (status == "Failed") {
            event.outcome = Outcome::Failure;
        } else {
            event.outcome = Outcome::Unknown;
        }

        event.metadata = j;

        if (!resource.empty()) {
            auto sub_start = resource.find("/subscriptions/");
            if (sub_start != std::string::npos) {
                sub_start += 15;
                auto sub_end = resource.find('/', sub_start);
                if (sub_end != std::string::npos) {
                    event.metadata["SubscriptionId"] = resource.substr(sub_start, sub_end - sub_start);
                }
            }
        }

        return event;

    } catch (const std::exception& ex) {
        LOG_DEBUG("Azure parser JSON error: {}", ex.what());
        return std::nullopt;
    }
}

std::optional<Event> AzureParser::parse_signin(const nlohmann::json& j, Event& event) {
    // Microsoft Graph /auditLogs/signIns response fields:
    //   userDisplayName, userPrincipalName, ipAddress,
    //   location: { city, state, countryOrRegion, geoCoordinates: { latitude, longitude } },
    //   status: { errorCode, failureReason },
    //   clientAppUsed, deviceDetail, appDisplayName,
    //   riskLevelDuringSignIn, conditionalAccessStatus

    // Use the Graph API's stable 'id' to deduplicate across polls
    std::string graph_id = j.value("id", "");
    if (!graph_id.empty()) event.event_id = "az-signin-" + graph_id;

    event.user     = j.value("userPrincipalName", j.value("userDisplayName", ""));
    event.src_ip   = j.value("ipAddress", "");
    event.action   = "user_signin";
    event.category = Category::Auth;
    event.resource = j.value("appDisplayName", "");
    event.user_agent = j.value("clientAppUsed", "");

    // ── Timestamp ──
    std::string ts = j.value("createdDateTime", "");
    if (!ts.empty()) {
        std::tm tm{};
        std::istringstream ss(ts);
        ss >> std::get_time(&tm, "%Y-%m-%dT%H:%M:%S");
        if (!ss.fail()) {
            event.timestamp = static_cast<int64_t>(timegm(&tm)) * 1000;
        }
    }
    if (event.timestamp == 0) event.timestamp = event.received_at;

    // ── Outcome from status.errorCode ──
    if (j.contains("status") && j["status"].is_object()) {
        int error_code = j["status"].value("errorCode", -1);
        if (error_code == 0) {
            event.outcome  = Outcome::Success;
            event.severity = Severity::Info;
        } else {
            event.outcome  = Outcome::Failure;
            event.severity = Severity::Warning;
        }
    }

    // ── Risk level ──
    std::string risk = j.value("riskLevelDuringSignIn", "none");
    if (risk == "high")   event.severity = Severity::Critical;
    else if (risk == "medium") event.severity = Severity::Error;
    else if (risk == "low")    event.severity = Severity::Warning;

    // ── Store metadata with geolocation for the globe ──
    event.metadata = j;

    // Extract geolocation into top-level metadata keys
    // (required by get_geo_points() SQL: metadata->>'latitude', metadata->>'longitude')
    if (j.contains("location") && j["location"].is_object()) {
        auto& loc = j["location"];
        std::string city    = loc.value("city", "");
        std::string state   = loc.value("state", "");
        std::string country = loc.value("countryOrRegion", "");

        if (!city.empty())    event.metadata["city"] = city;
        if (!state.empty())   event.metadata["state"] = state;
        if (!country.empty()) event.metadata["country"] = country;
        event.metadata["geo_type"] = "login";

        if (loc.contains("geoCoordinates") && loc["geoCoordinates"].is_object()) {
            auto& geo = loc["geoCoordinates"];
            if (geo.contains("latitude") && geo.contains("longitude")) {
                double lat = geo.value("latitude", 0.0);
                double lng = geo.value("longitude", 0.0);
                if (lat != 0.0 || lng != 0.0) {
                    event.metadata["latitude"]  = std::to_string(lat);
                    event.metadata["longitude"] = std::to_string(lng);
                }
            }
        }

        // Build a readable label: "New York, NY, US"
        std::string label;
        if (!city.empty()) label = city;
        if (!state.empty()) {
            if (!label.empty()) label += ", ";
            label += state;
        }
        if (!country.empty()) {
            if (!label.empty()) label += ", ";
            label += country;
        }
        if (!label.empty()) event.metadata["location"] = label;
    }

    // Device details
    if (j.contains("deviceDetail") && j["deviceDetail"].is_object()) {
        auto& dev = j["deviceDetail"];
        std::string os = dev.value("operatingSystem", "");
        std::string browser = dev.value("browser", "");
        if (!os.empty()) event.metadata["device_os"] = os;
        if (!browser.empty()) event.metadata["device_browser"] = browser;
    }

    // Remove internal tag
    event.metadata.erase("_outpost_event_type");

    return event;
}

Category AzureParser::categorize_operation(const std::string& op) {
    // Authorization / IAM
    if (op.find("Authorization") != std::string::npos ||
        op.find("roleAssignment") != std::string::npos ||
        op.find("roleDefinition") != std::string::npos ||
        op.find("policyAssignment") != std::string::npos) {
        return Category::Auth;
    }

    // Network
    if (op.find("Network") != std::string::npos ||
        op.find("networkSecurityGroup") != std::string::npos ||
        op.find("publicIPAddress") != std::string::npos ||
        op.find("loadBalancer") != std::string::npos ||
        op.find("virtualNetwork") != std::string::npos) {
        return Category::Network;
    }

    // Compute / endpoint
    if (op.find("Compute") != std::string::npos ||
        op.find("virtualMachine") != std::string::npos) {
        return Category::Endpoint;
    }

    return Category::Cloud;
}

std::string AzureParser::simplify_operation(const std::string& operation) {
    // Azure ops look like: "Microsoft.Compute/virtualMachines/write"
    // Simplify to: "vm_write" or similar
    std::string op = operation;

    // Remove provider prefix (Microsoft.Xxx/)
    auto first_slash = op.find('/');
    if (first_slash != std::string::npos) {
        op = op.substr(first_slash + 1);
    }

    // Replace slashes with underscores, lowercase
    std::transform(op.begin(), op.end(), op.begin(), [](char c) {
        if (c == '/') return '_';
        return static_cast<char>(std::tolower(c));
    });

    return op;
}

Severity AzureParser::map_level(const std::string& level) {
    if (level == "Critical") return Severity::Critical;
    if (level == "Error")    return Severity::Error;
    if (level == "Warning")  return Severity::Warning;
    if (level == "Informational" || level == "Information") return Severity::Info;
    return Severity::Info;
}

} // namespace outpost
