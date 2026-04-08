// PostgresStorageEngine — Password reset token methods
// Split from postgres_storage_engine.cpp for maintainability

#include "storage/postgres_storage_engine.h"
#include "common/utils.h"
#include "common/logger.h"

namespace outpost {

bool PostgresStorageEngine::create_reset_token(const std::string& token,
                                                const std::string& user_id,
                                                int64_t expires_at) {
    std::lock_guard<std::mutex> conn_lock(conn_mutex_);
    if (!conn_) return false;

    // Delete any existing token for this user first
    {
        const char* del = "DELETE FROM password_reset_tokens WHERE user_id = $1;";
        const char* dp[] = { user_id.c_str() };
        PGresult* dr = PQexecParams(conn_, del, 1, nullptr, dp, nullptr, nullptr, 0);
        PQclear(dr);
    }

    const char* sql = "INSERT INTO password_reset_tokens (token, user_id, expires_at) "
                      "VALUES ($1, $2, $3);";
    std::string ea = std::to_string(expires_at);
    const char* params[] = { token.c_str(), user_id.c_str(), ea.c_str() };
    PGresult* res = PQexecParams(conn_, sql, 3, nullptr, params, nullptr, nullptr, 0);
    bool ok = (PQresultStatus(res) == PGRES_COMMAND_OK);
    if (!ok) LOG_WARN("create_reset_token failed: {}", PQerrorMessage(conn_));
    PQclear(res);
    return ok;
}

std::optional<PostgresStorageEngine::ResetTokenRecord>
PostgresStorageEngine::get_reset_token(const std::string& token) {
    std::lock_guard<std::mutex> conn_lock(conn_mutex_);
    if (!conn_) return std::nullopt;

    std::string now = std::to_string(now_ms());
    const char* sql = "SELECT token, user_id, expires_at "
                      "FROM password_reset_tokens "
                      "WHERE token = $1 AND expires_at > $2;";
    const char* params[] = { token.c_str(), now.c_str() };
    PGresult* res = PQexecParams(conn_, sql, 2, nullptr, params, nullptr, nullptr, 0);

    if (PQresultStatus(res) != PGRES_TUPLES_OK || PQntuples(res) == 0) {
        PQclear(res);
        return std::nullopt;
    }

    ResetTokenRecord rec;
    rec.token      = PQgetvalue(res, 0, 0);
    rec.user_id    = PQgetvalue(res, 0, 1);
    rec.expires_at = std::stoll(PQgetvalue(res, 0, 2));
    PQclear(res);
    return rec;
}

bool PostgresStorageEngine::delete_reset_token(const std::string& token) {
    std::lock_guard<std::mutex> conn_lock(conn_mutex_);
    if (!conn_) return false;

    const char* sql = "DELETE FROM password_reset_tokens WHERE token = $1;";
    const char* params[] = { token.c_str() };
    PGresult* res = PQexecParams(conn_, sql, 1, nullptr, params, nullptr, nullptr, 0);
    bool ok = (PQresultStatus(res) == PGRES_COMMAND_OK);
    PQclear(res);
    return ok;
}

void PostgresStorageEngine::cleanup_expired_reset_tokens() {
    std::lock_guard<std::mutex> conn_lock(conn_mutex_);
    if (!conn_) return;

    std::string now = std::to_string(now_ms());
    const char* sql = "DELETE FROM password_reset_tokens WHERE expires_at <= $1;";
    const char* params[] = { now.c_str() };
    PGresult* res = PQexecParams(conn_, sql, 1, nullptr, params, nullptr, nullptr, 0);
    PQclear(res);
}

} // namespace outpost
