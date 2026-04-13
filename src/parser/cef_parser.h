#pragma once

#include "parser/parser.h"
#include <map>
#include <string>
#include <vector>

namespace outpost {

/// ────────────────────────────────────────────────────────────────
/// CefParser: parses Common Event Format (CEF) log messages.
///
/// CEF format (ArcSight standard, widely supported):
///   CEF:version|DeviceVendor|DeviceProduct|DeviceVersion|SignatureID|Name|Severity|Extension
///
/// Handles:
///   - Raw CEF (starts with "CEF:")
///   - Syslog-wrapped CEF (<PRI>timestamp host CEF:...)
///   - CEF arriving via HEC with sourcetype "cef"
///
/// Extension key mapping:
///   src/shost → src_ip     dst/dhost → dst_ip
///   spt       → src_port   dpt       → dst_port
///   suser/duser → user     act       → action
///   rt/start   → timestamp msg       → resource
/// ────────────────────────────────────────────────────────────────
class CefParser : public Parser {
public:
    std::optional<Event> parse(const RawMessage& raw) override;
    const char* name() const override { return "cef"; }

private:
    /// Split CEF header on unescaped pipes
    std::vector<std::string> split_header(const std::string& s);

    /// Parse CEF extension key=value pairs (values may contain spaces)
    std::map<std::string, std::string> parse_extension(const std::string& ext);

    /// Map CEF numeric/text severity (0-10 or Low/Medium/High) to Severity enum
    Severity map_severity(const std::string& cef_sev);
};

} // namespace outpost
