// PostgresStorageEngine — Geospatial query methods

#include "storage/postgres_storage_engine.h"
#include "common/logger.h"
#include "common/utils.h"

namespace outpost {

std::vector<PostgresStorageEngine::GeoPoint> PostgresStorageEngine::get_geo_points(
    const std::string& source_filter,
    const std::string& severity_filter)
{
    std::lock_guard<std::mutex> conn_lock(conn_mutex_);
    std::vector<GeoPoint> results;
    if (!conn_) return results;

    // 7-day look-back window (ms)
    int64_t cutoff = now_ms() - (7LL * 86400 * 1000);
    std::string cutoff_str = std::to_string(cutoff);

    // Build optional filter clauses. $1 is always the cutoff timestamp.
    std::string extra_where;
    std::vector<std::string> owned_params;
    std::vector<const char*> param_ptrs;

    owned_params.push_back(cutoff_str);
    param_ptrs.push_back(owned_params.back().c_str());

    int next_param = 2;

    if (!source_filter.empty() && source_filter != "all") {
        extra_where += " AND source_type = $" + std::to_string(next_param++);
        owned_params.push_back(source_filter);
        param_ptrs.push_back(owned_params.back().c_str());
    }
    if (!severity_filter.empty() && severity_filter != "all") {
        extra_where += " AND severity = $" + std::to_string(next_param++);
        owned_params.push_back(severity_filter);
        param_ptrs.push_back(owned_params.back().c_str());
    }

    // Group events by rounded lat/lng (1 decimal ≈ 11 km), city, and source_type.
    // Pick the worst severity per cluster via MIN on a numeric rank.
    // Label format: "City, Country — source_type" (Globe3D splits on the em-dash).
    // COALESCE checks top-level first, then nested metadata sub-object.
    // Top-level is written by the parser worker geo-enrichment path.
    // Nested is written by HEC events that wrap geo inside "metadata":{}.
    std::string sql =
        "SELECT "
        "  ROUND(COALESCE(metadata->>'latitude',  metadata->'metadata'->>'latitude' )::NUMERIC, 1)::FLOAT AS lat, "
        "  ROUND(COALESCE(metadata->>'longitude', metadata->'metadata'->>'longitude')::NUMERIC, 1)::FLOAT AS lng, "
        "  COALESCE(NULLIF(COALESCE(metadata->>'city',    metadata->'metadata'->>'city'),    ''), src_ip, 'Unknown') AS city, "
        "  COALESCE(NULLIF(COALESCE(metadata->>'country', metadata->'metadata'->>'country'), ''), '')                AS country, "
        "  source_type, "
        "  COUNT(*)                                              AS cnt, "
        "  MIN(CASE severity "
        "        WHEN 'critical' THEN 1 "
        "        WHEN 'error'    THEN 2 "
        "        WHEN 'warning'  THEN 3 "
        "        WHEN 'notice'   THEN 4 "
        "        ELSE                 5 END)                     AS sev_rank "
        "FROM events "
        "WHERE COALESCE(metadata->>'latitude',  metadata->'metadata'->>'latitude')  IS NOT NULL "
        "  AND COALESCE(metadata->>'longitude', metadata->'metadata'->>'longitude') IS NOT NULL "
        "  AND timestamp >= $1 "
        + extra_where +
        " GROUP BY "
        "  ROUND(COALESCE(metadata->>'latitude',  metadata->'metadata'->>'latitude' )::NUMERIC, 1), "
        "  ROUND(COALESCE(metadata->>'longitude', metadata->'metadata'->>'longitude')::NUMERIC, 1), "
        "  COALESCE(NULLIF(COALESCE(metadata->>'city',    metadata->'metadata'->>'city'),    ''), src_ip, 'Unknown'), "
        "  COALESCE(NULLIF(COALESCE(metadata->>'country', metadata->'metadata'->>'country'), ''), ''), "
        "  source_type "
        "ORDER BY cnt DESC "
        "LIMIT 1000;";

    PGresult* res = PQexecParams(
        conn_, sql.c_str(),
        static_cast<int>(param_ptrs.size()),
        nullptr, param_ptrs.data(),
        nullptr, nullptr, 0);

    if (PQresultStatus(res) != PGRES_TUPLES_OK) {
        LOG_ERROR("get_geo_points query failed: {}", PQerrorMessage(conn_));
        PQclear(res);
        return results;
    }

    static const char* sev_names[] = { "", "critical", "error", "warning", "notice", "info" };

    int rows = PQntuples(res);
    for (int i = 0; i < rows; ++i) {
        const char* lat_s = PQgetvalue(res, i, 0);
        const char* lng_s = PQgetvalue(res, i, 1);
        if (!lat_s || !lng_s || lat_s[0] == '\0' || lng_s[0] == '\0') continue;

        GeoPoint pt;
        try {
            pt.latitude  = std::stod(lat_s);
            pt.longitude = std::stod(lng_s);
        } catch (...) { continue; }

        std::string city    = PQgetvalue(res, i, 2);
        std::string country = PQgetvalue(res, i, 3);
        pt.source    = PQgetvalue(res, i, 4);     // col 4: source_type
        pt.count     = std::stoll(PQgetvalue(res, i, 5)); // col 5: cnt

        // "City, Country — source_type"
        pt.label = city;
        if (!country.empty() && country != city) pt.label += ", " + country;
        pt.label += " \xe2\x80\x94 " + pt.source;   // UTF-8 em-dash

        pt.point_type = "event";

        // Map worst-severity rank back to name (col 6: sev_rank)
        int sev_rank = std::stoi(PQgetvalue(res, i, 6));
        if (sev_rank < 1 || sev_rank > 5) sev_rank = 5;
        pt.severity = sev_names[sev_rank];

        // Anything warning-or-worse → "alert"; otherwise "online"
        pt.status = (sev_rank <= 3) ? "alert" : "online";

        results.push_back(std::move(pt));
    }

    PQclear(res);
    return results;
}

} // namespace outpost
