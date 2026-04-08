// ApiServer — Auth routes (login, logout, session) with rate limiting
// Split from server.cpp for maintainability

#include "api/server.h"
#include "common/utils.h"
#include "common/logger.h"
#include "auth/auth.h"
#include "auth/smtp.h"

#include <nlohmann/json.hpp>
#include <mutex>
#include <map>

namespace outpost {

static std::string extract_bearer_auth(const httplib::Request& req) {
    auto it = req.headers.find("Authorization");
    if (it == req.headers.end()) return "";
    const auto& val = it->second;
    if (val.substr(0, 7) == "Bearer ") return val.substr(7);
    return "";
}

// ── Login rate limiter ──
struct LoginAttempt {
    int    count    = 0;
    int64_t first_attempt = 0;
    int64_t locked_until  = 0;
};
static std::mutex rate_mutex;
static std::map<std::string, LoginAttempt> login_attempts;

static bool is_rate_limited(const std::string& key, const AuthConfig& config) {
    std::lock_guard<std::mutex> lock(rate_mutex);
    int64_t now = now_ms();
    auto& attempt = login_attempts[key];

    // If locked out, check if lockout has expired
    if (attempt.locked_until > 0 && now < attempt.locked_until) {
        return true;
    }

    // Reset if lockout expired or window expired
    int64_t window_ms = static_cast<int64_t>(config.login_window_sec) * 1000;
    if (attempt.locked_until > 0 && now >= attempt.locked_until) {
        attempt = {};
        return false;
    }
    if (attempt.first_attempt > 0 && (now - attempt.first_attempt) > window_ms) {
        attempt = {};
        return false;
    }

    return false;
}

static void record_failed_login(const std::string& key, const AuthConfig& config) {
    std::lock_guard<std::mutex> lock(rate_mutex);
    int64_t now = now_ms();
    auto& attempt = login_attempts[key];

    if (attempt.count == 0) {
        attempt.first_attempt = now;
    }
    attempt.count++;

    if (attempt.count >= config.max_login_attempts) {
        attempt.locked_until = now + static_cast<int64_t>(config.lockout_duration_sec) * 1000;
        LOG_WARN("Login rate limit triggered for '{}' — locked for {}s", key, config.lockout_duration_sec);
    }
}

static void record_successful_login(const std::string& key) {
    std::lock_guard<std::mutex> lock(rate_mutex);
    login_attempts.erase(key);
}

void ApiServer::register_auth_routes() {

    server_.Post("/api/auth/login", [this](const httplib::Request& req, httplib::Response& res) {
        try {
            auto body = nlohmann::json::parse(req.body);
            std::string username = body.value("username", "");
            std::string password = body.value("password", "");

            if (username.empty() || password.empty()) {
                res.status = 400;
                res.set_content(R"({"error":"Username and password required"})", "application/json");
                return;
            }

            // Rate limiting by username
            if (is_rate_limited(username, auth_config_)) {
                res.status = 429;
                res.set_content(R"({"error":"Too many login attempts. Please try again later."})", "application/json");
                return;
            }

            auto user = storage_.get_user_by_email(username);
            if (!user || !verify_password(password, user->salt, user->password_hash)) {
                record_failed_login(username, auth_config_);
                res.status = 401;
                res.set_content(R"({"error":"Invalid username or password"})", "application/json");
                return;
            }

            record_successful_login(username);

            auto token = generate_session_token();
            int64_t now = now_ms();
            int64_t expires = now + (static_cast<int64_t>(auth_config_.session_ttl_hours) * 3600 * 1000);
            storage_.create_session(token, user->user_id, now, expires);

            // Clean up expired sessions periodically (piggyback on login)
            storage_.cleanup_expired_sessions();

            nlohmann::json result = {
                {"token", token},
                {"expires_at", expires},
                {"username", username},
                {"email", user->email},
                {"role", user->role}
            };
            res.set_content(result.dump(), "application/json");

        } catch (const std::exception& e) {
            res.status = 400;
            res.set_content(nlohmann::json({{"error", e.what()}}).dump(), "application/json");
        }
    });

    server_.Post("/api/auth/logout", [this](const httplib::Request& req, httplib::Response& res) {
        auto token = extract_bearer_auth(req);
        if (!token.empty()) storage_.delete_session(token);
        res.set_content(R"({"status":"ok"})", "application/json");
    });

    // ── Forgot password — generate and email a reset token ──
    server_.Post("/api/auth/forgot-password", [this](const httplib::Request& req, httplib::Response& res) {
        // Always return the same message to avoid revealing whether an email exists
        const char* ok_msg = R"({"status":"ok","message":"If that email is registered, a reset link has been sent."})";

        try {
            auto body = nlohmann::json::parse(req.body);
            std::string email = body.value("email", "");
            if (email.empty()) {
                res.status = 400;
                res.set_content(R"({"error":"Email required"})", "application/json");
                return;
            }

            // Rate limit by email — prefix key to keep separate from login attempts
            std::string rate_key = "reset:" + email;
            if (is_rate_limited(rate_key, auth_config_)) {
                res.set_content(ok_msg, "application/json");
                return;
            }
            record_failed_login(rate_key, auth_config_);

            auto user = storage_.get_user_by_email(email);
            if (!user) {
                // Don't reveal the email doesn't exist
                res.set_content(ok_msg, "application/json");
                return;
            }

            if (!smtp_config_.enabled) {
                LOG_WARN("Password reset requested for {} but SMTP is not configured", email);
                res.set_content(ok_msg, "application/json");
                return;
            }

            // Generate a full 64-hex-char token (32 random bytes); store only its hash
            std::string token = generate_session_token();
            int64_t expires = now_ms() + (60LL * 60 * 1000); // 1 hour
            storage_.create_reset_token(sha256_hex(token), user->user_id, expires);
            storage_.cleanup_expired_reset_tokens();

            std::string base_url = smtp_config_.base_url;
            if (base_url.empty()) base_url = "http://localhost:5173";
            std::string reset_link = base_url + "/reset-password?token=" + token;

            std::string body_text =
                "You requested a password reset for your Firewatch SIEM account.\n\n"
                "Click the link below to set a new password (valid for 1 hour):\n\n"
                + reset_link + "\n\n"
                "If you did not request this, you can safely ignore this email.\n\n"
                "-- Firewatch SIEM";

            send_email(smtp_config_, email, "Firewatch SIEM — Password Reset", body_text);
        } catch (...) {}

        res.set_content(ok_msg, "application/json");
    });

    // ── Reset password — validate token and set new password ──
    server_.Post("/api/auth/reset-password", [this](const httplib::Request& req, httplib::Response& res) {
        try {
            auto body = nlohmann::json::parse(req.body);
            std::string token       = body.value("token", "");
            std::string new_password = body.value("new_password", "");

            if (token.empty() || new_password.empty()) {
                res.status = 400;
                res.set_content(R"({"error":"token and new_password required"})", "application/json");
                return;
            }

            auto rec = storage_.get_reset_token(sha256_hex(token));
            if (!rec) {
                res.status = 400;
                res.set_content(R"({"error":"Invalid or expired reset token"})", "application/json");
                return;
            }

            std::string policy_err = validate_password_policy(new_password, auth_config_);
            if (!policy_err.empty()) {
                res.status = 400;
                res.set_content(nlohmann::json({{"error", policy_err}}).dump(), "application/json");
                return;
            }

            auto salt = generate_salt();
            auto hash = hash_password(new_password, salt);
            storage_.update_user_password(rec->user_id, hash, salt);

            // Invalidate all existing sessions for this user so they must log in fresh
            storage_.delete_sessions_for_user(rec->user_id);

            storage_.delete_reset_token(token);

            LOG_INFO("Password reset completed for user_id={}", rec->user_id);
            res.set_content(R"({"status":"ok","message":"Password updated successfully. Please log in."})", "application/json");
        } catch (const std::exception& e) {
            res.status = 400;
            res.set_content(nlohmann::json({{"error", e.what()}}).dump(), "application/json");
        }
    });

    server_.Get("/api/auth/me", [this](const httplib::Request& req, httplib::Response& res) {
        auto token = extract_bearer_auth(req);
        auto session = storage_.validate_session(token);
        if (!session) {
            res.status = 401;
            res.set_content(R"({"error":"Not authenticated"})", "application/json");
            return;
        }
        nlohmann::json result = {
            {"username", session->username},
            {"email", session->email},
            {"role", session->role},
            {"user_id", session->user_id}
        };
        res.set_content(result.dump(), "application/json");
    });
}

} // namespace outpost
