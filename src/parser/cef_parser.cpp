#include "parser/cef_parser.h"
#include "common/utils.h"
#include "common/logger.h"

#include <algorithm>
#include <cctype>
#include <ctime>
#include <sstream>
#include <iomanip>

namespace outpost {

std::optional<Event> CefParser::parse(const RawMessage& raw) {
    std::string line = raw.as_string();

    // Find CEF marker — may be at start or after a syslog header
    auto cef_pos = line.find("CEF:");
    if (cef_pos == std::string::npos) return std::nullopt;

    // Reject if this was explicitly hinted as a non-CEF source
    if (raw.source_hint[0] != '\0') {
        std::string hint(raw.source_hint);
        if (hint != "cef" && hint != "syslog" && hint != "") {
            return std::nullopt;
        }
    }

    std::string cef = line.substr(cef_pos);

    // CEF:version|vendor|product|devversion|sigid|name|severity|extension
    // Find the first pipe to skip the version field
    auto first_pipe = cef.find('|');
    if (first_pipe == std::string::npos) return std::nullopt;

    // Split header (everything before extension) on unescaped pipes
    // There are exactly 7 header fields + extension
    auto parts = split_header(cef);
    if (parts.size() < 7) return std::nullopt;

    // parts[0] = "CEF:0"
    // parts[1] = DeviceVendor
    // parts[2] = DeviceProduct
    // parts[3] = DeviceVersion
    // parts[4] = SignatureID
    // parts[5] = Name
    // parts[6] = Severity
    // parts[7] = Extension (if present)

    std::string vendor    = parts[1];
    std::string product   = parts[2];
    std::string sig_id    = parts[4];
    std::string name      = parts[5];
    std::string cef_sev   = parts[6];
    std::string extension = parts.size() > 7 ? parts[7] : "";

    Event event;
    event.event_id    = generate_uuid();
    event.received_at = now_ms();
    event.timestamp   = event.received_at;
    event.source_type = SourceType::CEF;
    event.source_host = raw.source_addr;
    event.raw         = line;
    event.severity    = map_severity(cef_sev);
    event.action      = name;

    event.metadata["cef_vendor"]    = vendor;
    event.metadata["cef_product"]   = product;
    event.metadata["cef_signature"] = sig_id;
    event.metadata["cef_name"]      = name;
    event.metadata["cef_severity"]  = cef_sev;

    // Parse the syslog header prefix (if present) for hostname and timestamp
    if (cef_pos > 0) {
        std::string prefix = line.substr(0, cef_pos);
        // Strip syslog priority <NNN>
        size_t p = 0;
        if (!prefix.empty() && prefix[0] == '<') {
            auto gt = prefix.find('>');
            if (gt != std::string::npos) p = gt + 1;
        }
        // Try RFC 3164 timestamp: "Mon DD HH:MM:SS "
        if (p + 16 < prefix.size()) {
            std::tm tm{};
            std::istringstream ss(prefix.substr(p, 15));
            ss >> std::get_time(&tm, "%b %d %H:%M:%S");
            if (!ss.fail()) {
                auto now_t = std::chrono::system_clock::to_time_t(
                    std::chrono::system_clock::now());
                std::tm now_tm{};
                gmtime_r(&now_t, &now_tm);
                tm.tm_year = now_tm.tm_year;
                event.timestamp = static_cast<int64_t>(timegm(&tm)) * 1000;
                p += 16;
            }
        }
        // Hostname: next token
        auto sp = prefix.find(' ', p);
        if (sp != std::string::npos) {
            event.source_host = prefix.substr(p, sp - p);
        }
    }

    // Parse extension key=value pairs
    if (!extension.empty()) {
        auto ext = parse_extension(extension);

        // ── Network fields ──
        if (ext.count("src"))   event.src_ip = ext["src"];
        if (ext.count("shost") && event.src_ip.empty()) event.src_ip = ext["shost"];
        if (ext.count("dst"))   event.dst_ip = ext["dst"];
        if (ext.count("dhost") && event.dst_ip.empty()) event.dst_ip = ext["dhost"];
        if (ext.count("spt"))   { try { event.src_port = static_cast<uint16_t>(std::stoi(ext["spt"])); } catch (...) {} }
        if (ext.count("dpt"))   { try { event.dst_port = static_cast<uint16_t>(std::stoi(ext["dpt"])); } catch (...) {} }

        // ── Identity ──
        if (ext.count("suser"))  event.user = ext["suser"];
        if (ext.count("duser") && event.user.empty()) event.user = ext["duser"];
        if (ext.count("requestClientApplication")) event.user_agent = ext["requestClientApplication"];

        // ── Resource / message ──
        if (ext.count("msg"))     event.resource = ext["msg"];
        if (ext.count("request")) event.metadata["request"] = ext["request"];
        if (ext.count("requestMethod")) event.metadata["http_method"] = ext["requestMethod"];

        // ── Timestamp from extension (rt = receipt time, start = event start) ──
        // rt is epoch milliseconds; start is epoch milliseconds or ISO 8601
        if (ext.count("rt")) {
            try {
                int64_t rt = std::stoll(ext["rt"]);
                // rt > 1e12 means it's already in ms; otherwise treat as seconds
                event.timestamp = (rt > 1000000000000LL) ? rt : rt * 1000;
            } catch (...) {}
        } else if (ext.count("start")) {
            try {
                int64_t ts = std::stoll(ext["start"]);
                event.timestamp = (ts > 1000000000000LL) ? ts : ts * 1000;
            } catch (...) {
                // Try ISO 8601
                std::tm tm{};
                std::istringstream ss(ext["start"]);
                ss >> std::get_time(&tm, "%Y-%m-%dT%H:%M:%S");
                if (!ss.fail()) event.timestamp = static_cast<int64_t>(timegm(&tm)) * 1000;
            }
        }

        // ── Outcome ──
        if (ext.count("outcome")) {
            std::string o = ext["outcome"];
            std::transform(o.begin(), o.end(), o.begin(), ::tolower);
            if (o == "success" || o == "allow" || o == "0") event.outcome = Outcome::Success;
            else if (o == "failure" || o == "deny" || o == "block") event.outcome = Outcome::Failure;
        }

        // ── Category inference from vendor/product ──
        std::string prod_lower = product;
        std::transform(prod_lower.begin(), prod_lower.end(), prod_lower.begin(), ::tolower);
        if (prod_lower.find("firewall") != std::string::npos ||
            prod_lower.find("ids") != std::string::npos ||
            prod_lower.find("ips") != std::string::npos ||
            prod_lower.find("ngfw") != std::string::npos) {
            event.category = Category::Network;
        } else if (prod_lower.find("auth") != std::string::npos ||
                   prod_lower.find("iam") != std::string::npos ||
                   prod_lower.find("sso") != std::string::npos) {
            event.category = Category::Auth;
        } else if (prod_lower.find("endpoint") != std::string::npos ||
                   prod_lower.find("edr") != std::string::npos ||
                   prod_lower.find("av") != std::string::npos) {
            event.category = Category::Endpoint;
        } else {
            event.category = Category::System;
        }

        // Store all extension fields in metadata
        for (auto& [k, v] : ext) {
            event.metadata[k] = v;
        }
    }

    return event;
}

// ── Split CEF header on unescaped pipe characters ──
// CEF spec: \| is a literal pipe inside a field value.
// We split on a maximum of 7 pipes to preserve the extension as-is.
std::vector<std::string> CefParser::split_header(const std::string& s) {
    std::vector<std::string> parts;
    std::string current;
    int pipes = 0;
    for (size_t i = 0; i < s.size(); ++i) {
        if (s[i] == '\\' && i + 1 < s.size() && s[i + 1] == '|') {
            current += '|';
            ++i;
        } else if (s[i] == '|' && pipes < 7) {
            parts.push_back(current);
            current.clear();
            ++pipes;
        } else {
            current += s[i];
        }
    }
    parts.push_back(current);
    return parts;
}

// ── Parse CEF extension key=value pairs ──
// Values may contain spaces; keys are delimited by the next "word=" pattern.
// CEF escapes: \= (literal =), \\ (literal \), \n (newline), \r (CR)
std::map<std::string, std::string> CefParser::parse_extension(const std::string& ext) {
    std::map<std::string, std::string> result;

    // First pass: find all key= positions (word at start or after whitespace, followed by =)
    std::vector<size_t> key_starts;
    std::vector<std::string> keys;

    for (size_t i = 0; i < ext.size(); ++i) {
        bool at_boundary = (i == 0 || std::isspace((unsigned char)ext[i - 1]));
        if (!at_boundary) continue;

        size_t j = i;
        while (j < ext.size() && (std::isalnum((unsigned char)ext[j]) || ext[j] == '_')) ++j;

        if (j > i && j < ext.size() && ext[j] == '=') {
            key_starts.push_back(i);
            keys.push_back(ext.substr(i, j - i));
        }
    }

    // Second pass: extract values between consecutive key positions
    for (size_t k = 0; k < keys.size(); ++k) {
        size_t val_start = key_starts[k] + keys[k].size() + 1; // skip key=

        size_t val_end;
        if (k + 1 < keys.size()) {
            val_end = key_starts[k + 1];
            // Trim trailing whitespace (the space before the next key)
            while (val_end > val_start && std::isspace((unsigned char)ext[val_end - 1])) --val_end;
        } else {
            val_end = ext.size();
        }

        std::string raw_val = ext.substr(val_start, val_end - val_start);

        // Unescape CEF escape sequences
        std::string value;
        value.reserve(raw_val.size());
        for (size_t j = 0; j < raw_val.size(); ++j) {
            if (raw_val[j] == '\\' && j + 1 < raw_val.size()) {
                switch (raw_val[j + 1]) {
                    case '=':  value += '=';  ++j; break;
                    case '\\': value += '\\'; ++j; break;
                    case 'n':  value += '\n'; ++j; break;
                    case 'r':  value += '\r'; ++j; break;
                    default:   value += raw_val[j]; break;
                }
            } else {
                value += raw_val[j];
            }
        }

        result[keys[k]] = value;
    }

    return result;
}

// ── Map CEF severity to internal Severity enum ──
// CEF severity is 0-10 (or textual: Low/Medium/High/Very-High/Unknown)
Severity CefParser::map_severity(const std::string& cef_sev) {
    // Try numeric first
    try {
        int n = std::stoi(cef_sev);
        if (n <= 3)  return Severity::Info;
        if (n <= 5)  return Severity::Warning;
        if (n <= 7)  return Severity::Error;
        if (n <= 8)  return Severity::Critical;
        return Severity::Emergency;
    } catch (...) {}

    // Textual
    std::string s = cef_sev;
    std::transform(s.begin(), s.end(), s.begin(), ::tolower);
    if (s == "low")       return Severity::Info;
    if (s == "medium")    return Severity::Warning;
    if (s == "high")      return Severity::Error;
    if (s == "very-high") return Severity::Critical;
    return Severity::Info;
}

} // namespace outpost
