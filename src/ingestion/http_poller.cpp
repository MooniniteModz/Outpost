#include "ingestion/http_poller.h"
#include "common/logger.h"
#include "common/utils.h"

#include <httplib.h>
#include <nlohmann/json.hpp>
#include <sstream>
#include <iomanip>

namespace outpost {

#ifndef CPPHTTPLIB_OPENSSL_SUPPORT
// Stub implementations when SSL is not available
HttpPoller::HttpPoller(RingBuffer<>& buffer, const HttpPollerConfig& config)
    : buffer_(buffer), config_(config) {}
HttpPoller::~HttpPoller() { stop(); }
void HttpPoller::start() {
    if (config_.m365_enabled || config_.azure_enabled) {
        LOG_WARN("HTTP poller: M365/Azure polling requires OpenSSL. Rebuild with -DOPENSSL_FOUND=ON");
    }
}
void HttpPoller::stop() {}
void HttpPoller::reconfigure(const HttpPollerConfig& new_config) {
    stop();
    config_ = new_config;
    start();
}
std::string HttpPoller::get_access_token(const OAuthConfig&, const std::string&) { return ""; }
void HttpPoller::m365_poll_loop() {}
void HttpPoller::azure_poll_loop() {}
void HttpPoller::push_event(const std::string&, uint16_t) {}

#else
// Full implementation with SSL support

HttpPoller::HttpPoller(RingBuffer<>& buffer, const HttpPollerConfig& config)
    : buffer_(buffer), config_(config) {}

HttpPoller::~HttpPoller() {
    stop();
}

void HttpPoller::start() {
    if (running_.exchange(true)) return;

    if (config_.m365_enabled) {
        LOG_INFO("M365 poller starting (interval: {}s)", config_.m365_poll_interval_sec);
        m365_thread_ = std::thread(&HttpPoller::m365_poll_loop, this);
    }

    if (config_.azure_enabled) {
        LOG_INFO("Azure poller starting (interval: {}s)", config_.azure_poll_interval_sec);
        azure_thread_ = std::thread(&HttpPoller::azure_poll_loop, this);
    }
}

void HttpPoller::stop() {
    if (!running_.exchange(false)) return;

    if (m365_thread_.joinable()) m365_thread_.join();
    if (azure_thread_.joinable()) azure_thread_.join();

    LOG_INFO("HTTP pollers stopped. M365 events: {}, Azure events: {}",
             m365_count_.load(), azure_count_.load());
}

void HttpPoller::reconfigure(const HttpPollerConfig& new_config) {
    stop();
    config_ = new_config;
    m365_token_.clear();
    azure_token_.clear();
    graph_token_.clear();
    start();
}

// ── URL encoding for OAuth2 form bodies ──

static std::string http_url_encode(const std::string& s) {
    std::ostringstream out;
    for (unsigned char c : s) {
        if (std::isalnum(c) || c == '-' || c == '_' || c == '.' || c == '~') {
            out << c;
        } else {
            out << '%' << std::uppercase << std::hex
                << std::setw(2) << std::setfill('0') << static_cast<int>(c);
        }
    }
    return out.str();
}

// ── OAuth2 Client Credentials Flow ──

std::string HttpPoller::get_access_token(const OAuthConfig& oauth, const std::string& resource) {
    std::string endpoint = oauth.token_endpoint;
    if (endpoint.empty()) {
        endpoint = "https://login.microsoftonline.com/" + oauth.tenant_id + "/oauth2/v2.0/token";
    }

    // Parse scheme, host and path from endpoint
    std::string scheme, host, path;
    {
        auto proto = endpoint.find("://");
        if (proto == std::string::npos) return "";
        scheme = endpoint.substr(0, proto);
        auto start = proto + 3;
        auto slash = endpoint.find('/', start);
        if (slash == std::string::npos) return "";
        host = endpoint.substr(start, slash - start);
        path = endpoint.substr(slash);
    }

    // Use HTTPS client when endpoint is https (required for Microsoft identity)
    httplib::Client client(scheme == "https" ? "https://" + host : host);
    client.set_connection_timeout(10);
    client.set_read_timeout(10);

    std::string body = "grant_type=client_credentials"
                       "&client_id="     + http_url_encode(oauth.client_id) +
                       "&client_secret=" + http_url_encode(oauth.client_secret) +
                       "&scope="         + http_url_encode(resource);

    auto res = client.Post(path, body, "application/x-www-form-urlencoded");
    if (!res || res->status != 200) {
        LOG_ERROR("OAuth2 token request failed: {}",
                  res ? std::to_string(res->status) : "connection error");
        return "";
    }

    try {
        auto j = nlohmann::json::parse(res->body);
        return j.value("access_token", "");
    } catch (...) {
        LOG_ERROR("Failed to parse OAuth2 token response");
        return "";
    }
}

// ── M365 Management Activity API ──

void HttpPoller::m365_poll_loop() {
    const auto& oauth = config_.m365_oauth;
    const std::string scope = "https://manage.office.com/.default";
    const std::string base_host = "manage.office.com";

    // Content types to subscribe to
    const std::vector<std::string> content_types = {
        "Audit.AzureActiveDirectory",
        "Audit.Exchange",
        "Audit.SharePoint",
        "Audit.General"
    };

    LOG_INFO("M365 poller starting for tenant {}", oauth.tenant_id);

    while (running_.load(std::memory_order_relaxed)) {
        // ── Get/refresh token ──
        auto now = std::chrono::steady_clock::now();
        if (m365_token_.empty() || now >= m365_token_expiry_) {
            m365_token_ = get_access_token(oauth, scope);
            m365_token_expiry_ = now + std::chrono::minutes(55);
            if (m365_token_.empty()) {
                LOG_ERROR("M365: Failed to obtain access token, retrying in 30s");
                for (int i = 0; i < 300 && running_.load(); ++i)
                    std::this_thread::sleep_for(std::chrono::milliseconds(100));
                continue;
            }
            LOG_INFO("M365: Obtained access token");
        }

        httplib::Client client("https://" + base_host);
        client.set_connection_timeout(15);
        client.set_read_timeout(30);
        httplib::Headers headers = {
            {"Authorization", "Bearer " + m365_token_}
        };

        // ── Poll each content type ──
        for (const auto& content_type : content_types) {
            if (!running_.load()) break;

            // Construct time window: last poll_interval to now
            auto end_time = std::chrono::system_clock::now();
            auto start_time = end_time - std::chrono::seconds(config_.m365_poll_interval_sec + 10);

            auto format_time = [](std::chrono::system_clock::time_point tp) -> std::string {
                auto t = std::chrono::system_clock::to_time_t(tp);
                std::tm tm{};
                gmtime_r(&t, &tm);
                std::ostringstream ss;
                ss << std::put_time(&tm, "%Y-%m-%dT%H:%M:%S");
                return ss.str();
            };

            std::string path = "/api/v1.0/" + oauth.tenant_id +
                               "/activity/feed/subscriptions/content"
                               "?contentType=" + content_type +
                               "&startTime=" + format_time(start_time) +
                               "&endTime=" + format_time(end_time);

            auto res = client.Get(path, headers);
            if (!res || res->status != 200) {
                if (res && res->status == 404) {
                    // Subscription might not exist; try to start it
                    std::string sub_path = "/api/v1.0/" + oauth.tenant_id +
                                           "/activity/feed/subscriptions/start"
                                           "?contentType=" + content_type;
                    client.Post(sub_path, headers, "", "application/json");
                    LOG_INFO("M365: Started subscription for {}", content_type);
                } else {
                    LOG_WARN("M365: Failed to list content for {}: {}",
                             content_type, res ? std::to_string(res->status) : "error");
                }
                continue;
            }

            // Response is a JSON array of content blob URIs
            try {
                auto content_list = nlohmann::json::parse(res->body);
                if (!content_list.is_array()) continue;

                for (const auto& item : content_list) {
                    if (!running_.load()) break;

                    std::string content_uri = item.value("contentUri", "");
                    if (content_uri.empty()) continue;

                    // Fetch the actual audit events from the content URI
                    // The URI is a full URL; parse host and path
                    auto proto_end = content_uri.find("://");
                    if (proto_end == std::string::npos) continue;
                    auto host_start = proto_end + 3;
                    auto path_start = content_uri.find('/', host_start);
                    if (path_start == std::string::npos) continue;

                    std::string blob_host = content_uri.substr(host_start, path_start - host_start);
                    std::string blob_path = content_uri.substr(path_start);

                    httplib::Client blob_client(blob_host);
                    blob_client.set_connection_timeout(10);
                    blob_client.set_read_timeout(30);

                    auto blob_res = blob_client.Get(blob_path, headers);
                    if (!blob_res || blob_res->status != 200) continue;

                    // Response is a JSON array of individual audit events
                    auto events = nlohmann::json::parse(blob_res->body);
                    if (!events.is_array()) continue;

                    for (const auto& evt : events) {
                        push_event(evt.dump(), 443, "m365");
                        m365_count_.fetch_add(1, std::memory_order_relaxed);
                    }
                }
            } catch (const std::exception& ex) {
                LOG_WARN("M365: Error processing content for {}: {}", content_type, ex.what());
            }
        }

        // ── Wait for next poll interval ──
        for (int i = 0; i < config_.m365_poll_interval_sec * 10 && running_.load(); ++i) {
            std::this_thread::sleep_for(std::chrono::milliseconds(100));
        }
    }
}

// ── Azure Activity Log + Sign-in Log API ──

void HttpPoller::azure_poll_loop() {
    const auto& oauth = config_.azure_oauth;
    const std::string arm_scope   = "https://management.azure.com/.default";
    const std::string graph_scope = "https://graph.microsoft.com/.default";

    LOG_INFO("Azure poller starting (subscription: {}, tenant: {})",
             config_.azure_subscription_id, oauth.tenant_id);

    auto format_time = [](std::chrono::system_clock::time_point tp) -> std::string {
        auto t = std::chrono::system_clock::to_time_t(tp);
        std::tm tm{};
        gmtime_r(&t, &tm);
        std::ostringstream ss;
        ss << std::put_time(&tm, "%Y-%m-%dT%H:%M:%SZ");
        return ss.str();
    };

    while (running_.load(std::memory_order_relaxed)) {
        auto now = std::chrono::steady_clock::now();

        // ── Part 1: Azure Activity Log (ARM management events) ──
        if (!config_.azure_subscription_id.empty()) {
            if (azure_token_.empty() || now >= azure_token_expiry_) {
                azure_token_ = get_access_token(oauth, arm_scope);
                azure_token_expiry_ = now + std::chrono::minutes(55);
                if (azure_token_.empty()) {
                    LOG_ERROR("Azure: Failed to obtain ARM access token — check client_id/secret/tenant");
                } else {
                    LOG_INFO("Azure: Obtained ARM access token");
                }
            }

            if (!azure_token_.empty()) {
                httplib::Client client("https://management.azure.com");
                client.set_connection_timeout(15);
                client.set_read_timeout(30);
                httplib::Headers headers = {{"Authorization", "Bearer " + azure_token_}};

                // Look back at least 15 min — Activity Log has a 3-5 min indexing delay
                auto end_time   = std::chrono::system_clock::now();
                int  lookback   = std::max(config_.azure_poll_interval_sec * 2, 900);
                auto start_time = end_time - std::chrono::seconds(lookback);

                // Build $filter with proper URL encoding.
                // Spaces → %20, single quotes → %27, colons in timestamps → %3A.
                // Raw spaces in a URL query string are technically invalid and Azure
                // ARM may reject or truncate the request at the first unencoded space.
                auto encode_filter_ts = [](const std::string& ts) -> std::string {
                    std::string out;
                    for (char c : ts) {
                        if (c == ':') out += "%3A";
                        else          out += c;
                    }
                    return out;
                };
                std::string filter =
                    "$filter=eventTimestamp%20ge%20%27" + encode_filter_ts(format_time(start_time)) +
                    "%27%20and%20eventTimestamp%20le%20%27" + encode_filter_ts(format_time(end_time)) + "%27";
                std::string path = "/subscriptions/" + config_.azure_subscription_id +
                                   "/providers/microsoft.insights/eventtypes/management/values"
                                   "?api-version=2015-04-01&" + filter;

                auto res = client.Get(path, headers);
                if (!res) {
                    LOG_WARN("Azure: Activity log request failed (connection error)");
                } else if (res->status == 401 || res->status == 403) {
                    LOG_WARN("Azure: Activity log auth error (HTTP {}) — ensure the service principal "
                             "has Reader role on subscription {}", res->status, config_.azure_subscription_id);
                    azure_token_.clear();
                } else if (res->status != 200) {
                    LOG_WARN("Azure: Activity log HTTP {}: {}", res->status,
                             res->body.substr(0, 200));
                } else {
                    try {
                        auto body   = nlohmann::json::parse(res->body);
                        auto& values = body["value"];
                        if (values.is_array() && !values.empty()) {
                            LOG_INFO("Azure: Retrieved {} activity log event(s)", values.size());
                            for (const auto& evt : values) {
                                push_event(evt.dump(), 443, "azure");
                                azure_count_.fetch_add(1, std::memory_order_relaxed);
                            }
                        } else {
                            LOG_DEBUG("Azure: Activity log returned 0 events for last {}s window", lookback);
                        }
                    } catch (const std::exception& ex) {
                        LOG_WARN("Azure: Error parsing activity log response: {}", ex.what());
                    }
                }
            }
        }

        // ── Part 2: Microsoft Graph — Sign-in logs ──
        // Requires AuditLog.Read.All application permission on the app registration.
        {
            now = std::chrono::steady_clock::now();
            if (graph_token_.empty() || now >= graph_token_expiry_) {
                graph_token_ = get_access_token(oauth, graph_scope);
                graph_token_expiry_ = now + std::chrono::minutes(55);
                if (graph_token_.empty()) {
                    LOG_WARN("Azure: Failed to obtain Graph token — sign-in logs unavailable. "
                             "Grant AuditLog.Read.All (Application) permission in Azure AD.");
                } else {
                    LOG_INFO("Azure: Obtained Graph API token — sign-in log polling active");
                }
            }

            if (!graph_token_.empty()) {
                httplib::Client graph_client("https://graph.microsoft.com");
                graph_client.set_connection_timeout(15);
                graph_client.set_read_timeout(30);
                httplib::Headers gh = {{"Authorization", "Bearer " + graph_token_}};

                // Microsoft Graph sign-in logs can have a propagation delay of up to
                // 1-2 hours, so use a 30-minute minimum lookback window.  Duplicate
                // events are suppressed by the "az-signin-<id>" event_id dedup key.
                auto end_time   = std::chrono::system_clock::now();
                int  lookback   = std::max(config_.azure_poll_interval_sec + 30, 1800);
                auto start_time = end_time - std::chrono::seconds(lookback);

                // Format timestamp then URL-encode colons for Graph OData $filter.
                // Do NOT embed %3A inside put_time — it treats % as a format specifier.
                auto format_graph_time = [](std::chrono::system_clock::time_point tp) -> std::string {
                    auto t = std::chrono::system_clock::to_time_t(tp);
                    std::tm tm{};
                    gmtime_r(&t, &tm);
                    std::ostringstream ss;
                    ss << std::put_time(&tm, "%Y-%m-%dT%H:%M:%S");
                    std::string ts = ss.str();
                    // Encode colons so they survive in the URL path
                    std::string out;
                    out.reserve(ts.size() + 6);
                    for (char c : ts) {
                        if (c == ':') out += "%3A";
                        else          out += c;
                    }
                    return out;
                };

                // NOTE: $orderby cannot be combined with $filter on signIns — omit it.
                std::string graph_path =
                    "/v1.0/auditLogs/signIns"
                    "?$top=100"
                    "&$filter=createdDateTime%20ge%20" + format_graph_time(start_time) + "Z";

                LOG_INFO("Azure: Graph GET https://graph.microsoft.com{}", graph_path);

                auto gres = graph_client.Get(graph_path, gh);
                if (!gres) {
                    LOG_WARN("Azure: Graph sign-in request failed (connection error)");
                } else if (gres->status == 401 || gres->status == 403) {
                    LOG_WARN("Azure: Graph sign-in auth error (HTTP {}) — grant "
                             "AuditLog.Read.All Application permission in Azure AD portal",
                             gres->status);
                    LOG_WARN("Azure: Graph error body: {}", gres->body.substr(0, 500));
                    graph_token_.clear();
                } else if (gres->status != 200) {
                    LOG_WARN("Azure: Graph sign-in HTTP {}: {}", gres->status,
                             gres->body.substr(0, 500));
                } else {
                    LOG_INFO("Azure: Graph response HTTP 200, body size={} bytes, preview: {}",
                             gres->body.size(),
                             gres->body.substr(0, 300));
                    try {
                        auto gbody = nlohmann::json::parse(gres->body);
                        if (gbody.contains("value") && gbody["value"].is_array()) {
                            auto& sign_ins = gbody["value"];
                            LOG_INFO("Azure: Graph returned {} sign-in record(s) in value[]", sign_ins.size());
                            if (!sign_ins.empty()) {
                                // Log first record so we can see field names
                                LOG_INFO("Azure: First sign-in record: {}",
                                         sign_ins[0].dump().substr(0, 600));
                                for (const auto& evt : sign_ins) {
                                    push_event(evt.dump(), 443, "azure");
                                    azure_count_.fetch_add(1, std::memory_order_relaxed);
                                }
                                LOG_INFO("Azure: Pushed {} sign-in event(s) to buffer", sign_ins.size());
                            } else {
                                LOG_INFO("Azure: Graph sign-ins value[] is empty — no logins in last {}s window", lookback);
                            }
                        } else {
                            LOG_WARN("Azure: Graph response missing 'value' array — raw: {}",
                                     gres->body.substr(0, 400));
                        }
                    } catch (const std::exception& ex) {
                        LOG_WARN("Azure: Error parsing Graph sign-in response: {}", ex.what());
                        LOG_WARN("Azure: Raw body: {}", gres->body.substr(0, 400));
                    }
                }
            }
        }

        // ── Wait for next poll interval ──
        for (int i = 0; i < config_.azure_poll_interval_sec * 10 && running_.load(); ++i) {
            std::this_thread::sleep_for(std::chrono::milliseconds(100));
        }
    }
}

void HttpPoller::push_event(const std::string& json_event, uint16_t source_port, const std::string& hint) {
    if (json_event.size() >= RawMessage::MAX_SIZE) {
        LOG_WARN("HTTP poller: event too large ({} bytes), truncating", json_event.size());
    }

    RawMessage msg;
    msg.set(json_event.c_str(), json_event.size(), source_port, "api.microsoft.com",
            hint.empty() ? nullptr : hint.c_str());

    if (!buffer_.try_push(msg)) {
        buffer_.record_drop();
    }
}

#endif // CPPHTTPLIB_OPENSSL_SUPPORT

} // namespace outpost
